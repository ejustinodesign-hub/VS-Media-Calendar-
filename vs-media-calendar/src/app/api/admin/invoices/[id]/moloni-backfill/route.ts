import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { createMoloniInvoice } from "@/lib/moloni"
import { SERVICE_LABELS, ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"
import type { ServiceType } from "@prisma/client"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userRole = (session?.user as any)?.role
  if (!session?.user || userRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const invoice = await prisma.monthlyInvoice.findUnique({
    where: { id },
    include: {
      consultant: {
        select: {
          name: true,
          email: true,
          billingNif: true,
          billingName: true,
          billingAddress: true,
        },
      },
      bookings: {
        where: { paymentType: "FLAT_FEE" },
        include: { services: true },
      },
    },
  })

  if (!invoice) {
    return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 })
  }

  if (invoice.moloniDocumentId) {
    return NextResponse.json({
      error: "Esta fatura já tem documento Moloni.",
      moloniDocumentId: invoice.moloniDocumentId,
    }, { status: 409 })
  }

  const [year, m] = invoice.month.split("-").map(Number)
  const monthStart = new Date(year, m - 1, 1)
  const monthEnd = new Date(year, m, 0, 23, 59, 59)

  const regularSharedIntros = await prisma.deliverable.findMany({
    where: { targetConsultantId: invoice.consultantId, createdAt: { gte: monthStart, lte: monthEnd } },
    include: { booking: { select: { propertyAddress: true } } },
  })
  const backfillSharedIntros =
    invoice.month === "2026-06"
      ? await prisma.deliverable.findMany({
          where: { fileUrl: { startsWith: "backfill:intro-junho-2026:" }, targetConsultantId: invoice.consultantId },
          include: { booking: { select: { propertyAddress: true } } },
        })
      : []
  const seenIntroIds = new Set(regularSharedIntros.map((d) => d.id))
  const sharedIntros = [...regularSharedIntros, ...backfillSharedIntros.filter((d) => !seenIntroIds.has(d.id))]

  const bookingLines = invoice.bookings.flatMap((b) => {
    const items = b.services.map((svc) => ({
      description: `${SERVICE_LABELS[svc.serviceType as ServiceType]} — ${b.propertyAddress}`,
      qty: 1,
      unitPrice: svc.price,
    }))
    if (b.hasTravelFee && b.travelFeeAmount > 0) {
      items.push({
        description: `Taxa de deslocação — ${b.propertyAddress}`,
        qty: 1,
        unitPrice: b.travelFeeAmount,
      })
    }
    if (b.additionalIntros > 0) {
      items.push({
        description: `Intros adicionais (×${b.additionalIntros}) — ${b.propertyAddress}`,
        qty: b.additionalIntros,
        unitPrice: ADDITIONAL_INTRO_PRICE,
      })
    }
    return items
  })

  const sharedIntroLines = sharedIntros.map((d) => ({
    description: d.description ?? `Intro partilhada — ${d.booking?.propertyAddress ?? d.fileName}`,
    qty: 1,
    unitPrice: ADDITIONAL_INTRO_PRICE,
  }))

  const lines = [...bookingLines, ...sharedIntroLines]

  if (lines.length === 0) {
    return NextResponse.json({ error: "Sem linhas para faturar." }, { status: 422 })
  }

  const dueDate = invoice.dueDate ?? new Date(year, m, 10, 23, 59, 59)

  try {
    const moloniDocumentId = await createMoloniInvoice({
      consultant: invoice.consultant,
      month: invoice.month,
      dueDate,
      lines,
    })

    await prisma.monthlyInvoice.update({
      where: { id },
      data: { moloniDocumentId },
    })

    return NextResponse.json({ ok: true, moloniDocumentId })
  } catch (e: any) {
    console.error("[moloni-backfill]", e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
