import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { COMMISSION_RATE } from "@/lib/pricing"
import { recomputeMonthlyInvoice } from "@/lib/invoices"

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
      id: true, consultantId: true, scheduledAt: true,
      paymentType: true, salePrice: true, commissionRate: true,
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

  return NextResponse.json({
    success: true,
    paymentType,
    month,
    // fatura paga não é recalculada — é preciso regularizar manualmente
    invoiceWasPaid: invoiceBefore?.status === "PAID" || outcome === "skipped-paid",
  })
}
