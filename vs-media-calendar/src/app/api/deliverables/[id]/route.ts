import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { del } from "@vercel/blob"
import { IVA_RATE, ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"

function round2(n: number) {
  return Math.round(n * 100) / 100
}

interface RouteContext {
  params: Promise<{ id: string }>
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
    include: { booking: { select: { id: true } } },
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
    }
  }

  return NextResponse.json({ success: true })
}
