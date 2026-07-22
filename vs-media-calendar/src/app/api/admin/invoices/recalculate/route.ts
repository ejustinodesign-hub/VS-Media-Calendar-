import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { recomputeMonthlyInvoice, BACKFILL_PREFIX } from "@/lib/invoices"

// POST /api/admin/invoices/recalculate?month=2026-06
// Recalcula do zero as faturas do mês (marcações + intros partilhadas + backfill)
// para todos os consultores com atividade ou fatura nesse mês.
// Faturas PAID nunca são alteradas. Seguro correr múltiplas vezes.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month")
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 })
  }

  const [year, m] = month.split("-").map(Number)
  const monthStart = new Date(year, m - 1, 1)
  const monthEnd = new Date(year, m, 0, 23, 59, 59)

  // Todos os consultores com atividade ou fatura no mês
  const [bookingConsultants, introDeliverables, backfillDeliverables, existingInvoices] = await Promise.all([
    prisma.booking.findMany({
      where: {
        paymentType: "FLAT_FEE",
        status: { in: ["FILE_DELIVERED", "COMPLETED"] },
        scheduledAt: { gte: monthStart, lte: monthEnd },
      },
      select: { consultantId: true },
      distinct: ["consultantId"],
    }),
    prisma.deliverable.findMany({
      where: {
        createdAt: { gte: monthStart, lte: monthEnd },
        NOT: { fileUrl: { startsWith: BACKFILL_PREFIX } },
      },
      select: {
        targetConsultantId: true,
        secondConsultantId: true,
        thirdConsultantId: true,
        fourthConsultantId: true,
      },
    }),
    prisma.deliverable.findMany({
      where: { fileUrl: { startsWith: BACKFILL_PREFIX }, mimeType: `backfill-charged:${month}` },
      select: {
        targetConsultantId: true,
        secondConsultantId: true,
        thirdConsultantId: true,
        fourthConsultantId: true,
      },
    }),
    prisma.monthlyInvoice.findMany({
      where: { month },
      select: { consultantId: true },
    }),
  ])

  const consultantIds = new Set<string>()
  for (const b of bookingConsultants) consultantIds.add(b.consultantId)
  for (const d of introDeliverables) {
    for (const cid of [d.targetConsultantId, d.secondConsultantId, d.thirdConsultantId, d.fourthConsultantId]) {
      if (cid) consultantIds.add(cid)
    }
  }
  for (const d of backfillDeliverables) {
    for (const cid of [d.targetConsultantId, d.secondConsultantId, d.thirdConsultantId, d.fourthConsultantId]) {
      if (cid) consultantIds.add(cid)
    }
  }
  for (const inv of existingInvoices) consultantIds.add(inv.consultantId)

  let updated = 0
  let created = 0
  let skippedPaid = 0

  for (const consultantId of consultantIds) {
    const outcome = await recomputeMonthlyInvoice(consultantId, month)
    if (outcome === "updated") updated++
    else if (outcome === "created") created++
    else if (outcome === "skipped-paid") skippedPaid++
  }

  return NextResponse.json({ month, updated, created, skippedPaid, consultants: consultantIds.size })
}
