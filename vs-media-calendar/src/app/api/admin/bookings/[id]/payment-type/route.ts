import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { COMMISSION_RATE } from "@/lib/pricing"
import { recomputeMonthlyInvoice } from "@/lib/invoices"
import { sendPaymentTypeChangedEmail } from "@/lib/email"

// PATCH: alterna uma marcação entre taxa fixa e modo comissão.
// A fatura do mês da marcação é recalculada, pelo que a cobrança da taxa
// fixa desaparece (ou reaparece) automaticamente. Faturas já pagas não são
// alteradas — nesse caso o resultado avisa para regularizar à mão.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { paymentType } = await req.json() as { paymentType: "FLAT_FEE" | "COMMISSION" }

  if (paymentType !== "FLAT_FEE" && paymentType !== "COMMISSION") {
    return NextResponse.json({ error: "paymentType inválido" }, { status: 400 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true, consultantId: true, scheduledAt: true, propertyAddress: true,
      paymentType: true, salePrice: true, commissionRate: true,
      hasTravelFee: true, travelFeeAmount: true, additionalIntros: true,
      consultant: { select: { name: true, email: true } },
      services: { select: { price: true } },
    },
  })
  if (!booking) return NextResponse.json({ error: "Marcação não encontrada" }, { status: 404 })

  if (booking.paymentType === paymentType) {
    return NextResponse.json({ error: "A marcação já está nesse modo." }, { status: 409 })
  }

  // Voltar a taxa fixa com venda já registada implicaria apagar a comissão
  // cobrada — exige tratamento manual
  if (paymentType === "FLAT_FEE" && booking.salePrice) {
    return NextResponse.json({
      error: "Esta marcação já tem valor de venda registado e comissão cobrada. Anule a comissão antes de voltar a taxa fixa.",
    }, { status: 409 })
  }

  const scheduled = new Date(booking.scheduledAt)
  const month = `${scheduled.getFullYear()}-${String(scheduled.getMonth() + 1).padStart(2, "0")}`
  const invoiceBefore = await prisma.monthlyInvoice.findFirst({
    where: { consultantId: booking.consultantId, month },
    select: { status: true },
  })

  await prisma.booking.update({
    where: { id },
    data:
      paymentType === "COMMISSION"
        ? {
            paymentType: "COMMISSION",
            commissionRate: booking.commissionRate ?? COMMISSION_RATE,
            // desligar da fatura de taxa fixa — deixa de ser cobrada
            invoiceId: null,
          }
        : {
            paymentType: "FLAT_FEE",
            salePrice: null,
            commissionAmount: null,
          },
  })

  const outcome = await recomputeMonthlyInvoice(booking.consultantId, month)
  const invoiceWasPaid = invoiceBefore?.status === "PAID" || outcome === "skipped-paid"
  const rate = booking.commissionRate ?? COMMISSION_RATE
  const flatFeeAmount =
    booking.services.reduce((s, svc) => s + svc.price, 0)
    + (booking.hasTravelFee ? booking.travelFeeAmount : 0)
    + booking.additionalIntros * 25

  // Notificar o consultor (plataforma + email). Falhas não revertem a alteração.
  try {
    await prisma.notification.create({
      data: {
        userId: booking.consultantId,
        bookingId: booking.id,
        type: "SERVICE_ACCEPTED",
        title: paymentType === "COMMISSION" ? "Vídeo alterado para modo comissão" : "Vídeo alterado para taxa fixa",
        message:
          paymentType === "COMMISSION"
            ? `O vídeo de ${booking.propertyAddress} deixa de ser cobrado na fatura mensal — passa a pagar ${(rate * 100).toFixed(2)}% do valor de venda.`
            : `O vídeo de ${booking.propertyAddress} passa a ser cobrado na fatura mensal por ${flatFeeAmount.toFixed(2)}€ s/ IVA.`,
      },
    })
  } catch (e) {
    console.error("[payment-type] notification failed:", e)
  }

  try {
    await sendPaymentTypeChangedEmail({
      consultantName: booking.consultant.name || "",
      consultantEmail: booking.consultant.email || "",
      bookingId: booking.id,
      propertyAddress: booking.propertyAddress,
      scheduledAt: scheduled,
      paymentType,
      commissionRate: rate,
      flatFeeAmount,
      invoiceWasPaid,
    })
  } catch (e) {
    console.error("[payment-type] email failed:", e)
  }

  return NextResponse.json({
    success: true,
    paymentType,
    month,
    // fatura paga não é recalculada — é preciso regularizar manualmente
    invoiceWasPaid,
  })
}
