import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { recomputeMonthlyInvoice } from "@/lib/invoices"

// PATCH: admin fecha (ou reabre) uma marcação sem depender da entrega do vídeo.
// Concluída conta para faturação — a fatura do mês é recalculada para a
// cobrança entrar (ou sair, ao reabrir). Faturas pagas não são alteradas.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { completed } = await req.json() as { completed: boolean }

  if (typeof completed !== "boolean") {
    return NextResponse.json({ error: "completed tem de ser true ou false" }, { status: 400 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true, consultantId: true, scheduledAt: true, propertyAddress: true,
      status: true, paymentType: true,
      _count: { select: { deliverables: true } },
    },
  })
  if (!booking) return NextResponse.json({ error: "Marcação não encontrada" }, { status: 404 })

  if (booking.status === "CANCELLED" || booking.status === "REJECTED") {
    return NextResponse.json({
      error: "Marcações canceladas ou recusadas não podem ser concluídas.",
    }, { status: 409 })
  }

  if (completed && booking.status === "COMPLETED") {
    return NextResponse.json({ error: "A marcação já está concluída." }, { status: 409 })
  }
  if (!completed && booking.status !== "COMPLETED") {
    return NextResponse.json({ error: "A marcação não está concluída." }, { status: 409 })
  }

  // Ao reabrir, voltar ao estado coerente com o que existe de facto
  const nextStatus = completed
    ? "COMPLETED"
    : booking._count.deliverables > 0 ? "FILE_DELIVERED" : "ACCEPTED"

  await prisma.booking.update({
    where: { id },
    data: {
      status: nextStatus,
      completedAt: completed ? new Date() : null,
    },
  })

  // Só marcações FILE_DELIVERED/COMPLETED são faturadas — recalcular o mês
  const scheduled = new Date(booking.scheduledAt)
  const month = `${scheduled.getFullYear()}-${String(scheduled.getMonth() + 1).padStart(2, "0")}`
  let invoiceWasPaid = false
  if (booking.paymentType === "FLAT_FEE") {
    const before = await prisma.monthlyInvoice.findFirst({
      where: { consultantId: booking.consultantId, month },
      select: { status: true },
    })
    const outcome = await recomputeMonthlyInvoice(booking.consultantId, month)
    invoiceWasPaid = before?.status === "PAID" || outcome === "skipped-paid"
  }

  if (completed) {
    try {
      await prisma.notification.create({
        data: {
          userId: booking.consultantId,
          bookingId: booking.id,
          type: "SERVICE_COMPLETED",
          title: "Serviço concluído",
          message: `O serviço de ${booking.propertyAddress} foi marcado como concluído.`,
        },
      })
    } catch (e) {
      console.error("[complete] notification failed:", e)
    }
  }

  return NextResponse.json({
    success: true,
    status: nextStatus,
    month,
    hadDeliverables: booking._count.deliverables > 0,
    invoiceWasPaid,
  })
}
