import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { del } from "@vercel/blob"
import { IVA_RATE, ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"
import { recomputeMonthlyInvoice } from "@/lib/invoices"

function round2(n: number) {
  return Math.round(n * 100) / 100
}

interface RouteContext {
  params: Promise<{ id: string }>
}

// PATCH: admin edita com que consultores uma intro é partilhada.
// Recalcula as faturas do mês do upload para todos os consultores afetados
// (removidos e adicionados), pelo que a cobrança passa a 25€ ÷ nº de consultores.
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { consultantIds } = await req.json()
  if (!Array.isArray(consultantIds) || consultantIds.length < 1 || consultantIds.length > 4) {
    return NextResponse.json({ error: "Indique entre 1 e 4 consultores." }, { status: 400 })
  }
  const unique = [...new Set(consultantIds.filter(Boolean))] as string[]
  if (unique.length !== consultantIds.length) {
    return NextResponse.json({ error: "Consultores duplicados." }, { status: 400 })
  }

  const deliverable = await prisma.deliverable.findUnique({ where: { id } })
  if (!deliverable) {
    return NextResponse.json({ error: "Ficheiro não encontrado" }, { status: 404 })
  }
  if (deliverable.fileUrl.startsWith("backfill:")) {
    return NextResponse.json({ error: "As intros de junho são geridas pelo botão «Repor triplicados»." }, { status: 400 })
  }
  if (!deliverable.targetConsultantId) {
    return NextResponse.json({ error: "Este ficheiro não é uma intro partilhada." }, { status: 400 })
  }

  const validCount = await prisma.user.count({
    where: { id: { in: unique }, role: { in: ["CONSULTANT", "ADMIN"] }, active: true },
  })
  if (validCount !== unique.length) {
    return NextResponse.json({ error: "Consultor não encontrado." }, { status: 404 })
  }

  const before = [
    deliverable.targetConsultantId,
    deliverable.secondConsultantId,
    deliverable.thirdConsultantId,
    deliverable.fourthConsultantId,
  ].filter(Boolean) as string[]

  await prisma.deliverable.update({
    where: { id },
    data: {
      targetConsultantId: unique[0],
      secondConsultantId: unique[1] ?? null,
      thirdConsultantId: unique[2] ?? null,
      fourthConsultantId: unique[3] ?? null,
    },
  })

  const created = deliverable.createdAt
  const month = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`
  const affected = new Set([...before, ...unique])
  const skippedPaid: string[] = []
  for (const consultantId of affected) {
    const outcome = await recomputeMonthlyInvoice(consultantId, month)
    if (outcome === "skipped-paid") skippedPaid.push(consultantId)
  }

  return NextResponse.json({ ok: true, month, recomputed: affected.size, skippedPaid })
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await auth()
  const role = (session?.user as any)?.role
  if (!session?.user || (role !== "VIDEOGRAPHER" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Admins can delete any deliverable; videographers only their own bookings
  const where = role === "ADMIN"
    ? { id }
    : { id, booking: { videographerId: session.user.id } }

  const deliverable = await prisma.deliverable.findFirst({
    where,
    include: { booking: { select: { id: true, consultantId: true, scheduledAt: true } } },
  })

  if (!deliverable) {
    return NextResponse.json({ error: "Ficheiro não encontrado" }, { status: 404 })
  }

  // Delete from Vercel Blob
  try {
    await del(deliverable.fileUrl)
  } catch (e) {
    console.error("Blob delete error:", e)
    // Continue even if blob deletion fails (file may already be gone)
  }

  // Delete DB record
  await prisma.deliverable.delete({ where: { id } })

  // Estornar a cobrança da intro: quando o ficheiro foi partilhado com consultores,
  // cada um foi cobrado 25€ ÷ nº de consultores na fatura do mês do upload.
  // Sem isto, apagar e reenviar uma intro acumulava cobranças na fatura.
  // (Deliverables de backfill junho-2026 são geridos pelo próprio backfill.)
  if (!deliverable.fileUrl.startsWith("backfill:")) {
    const chargedIds = [
      deliverable.targetConsultantId,
      deliverable.secondConsultantId,
      deliverable.thirdConsultantId,
      deliverable.fourthConsultantId,
    ].filter(Boolean) as string[]

    if (chargedIds.length > 0) {
      const net = round2(ADDITIONAL_INTRO_PRICE / chargedIds.length)
      const withIva = round2(net * (1 + IVA_RATE))
      const created = deliverable.createdAt
      const month = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`

      for (const consultantId of chargedIds) {
        const invoice = await prisma.monthlyInvoice.findFirst({ where: { consultantId, month } })
        if (invoice && invoice.status !== "PAID") {
          await prisma.monthlyInvoice.update({
            where: { id: invoice.id },
            data: {
              subtotal: Math.max(0, round2(invoice.subtotal - net)),
              total: Math.max(0, round2(invoice.total - withIva)),
            },
          })
        }
      }
    }
  }

  // If no deliverables remain for the booking, revert booking status to ACCEPTED
  if (deliverable.booking) {
    const remaining = await prisma.deliverable.count({
      where: { bookingId: deliverable.booking.id },
    })
    if (remaining === 0) {
      await prisma.booking.update({
        where: { id: deliverable.booking.id },
        data: { status: "ACCEPTED" },
      })
      // Marcação deixou de estar entregue — se o mês já fechou, tirar a
      // cobrança da fatura (só vídeos entregues são faturados)
      const scheduled = new Date(deliverable.booking.scheduledAt)
      const bookingMonth = `${scheduled.getFullYear()}-${String(scheduled.getMonth() + 1).padStart(2, "0")}`
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      if (bookingMonth < currentMonth) {
        try {
          await recomputeMonthlyInvoice(deliverable.booking.consultantId, bookingMonth)
        } catch (e) {
          console.error("[deliverables/delete] recompute failed:", e)
        }
      }
    }
  }

  return NextResponse.json({ success: true })
}
