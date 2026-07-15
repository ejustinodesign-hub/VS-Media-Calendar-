import { prisma } from "@/lib/prisma"
import { IVA_RATE, ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"

export const BACKFILL_PREFIX = "backfill:intro-junho-2026:"

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export type RecomputeOutcome = "updated" | "created" | "skipped-paid" | "empty"

// Marca como OVERDUE as faturas PENDING cujo vencimento já passou.
// Sem isto nada transita PENDING → OVERDUE e o bloqueio de marcações nunca dispara.
export async function markOverdueInvoices(consultantId?: string) {
  await prisma.monthlyInvoice.updateMany({
    where: {
      ...(consultantId ? { consultantId } : {}),
      status: "PENDING",
      dueDate: { lt: new Date() },
    },
    data: { status: "OVERDUE" },
  })
}

// Recalcula a fatura mensal do consultor a partir dos dados reais:
//   marcações FLAT_FEE do mês (services + deslocação + intros adicionais)
// + intros partilhadas criadas no mês (25€ ÷ nº de consultores)
// + intros de backfill junho-2026 marcadas para este mês (25€ cada)
// Nunca altera faturas PAID. Liga as marcações contadas à fatura para o
// cron de fim de mês não as voltar a somar.
export async function recomputeMonthlyInvoice(consultantId: string, month: string): Promise<RecomputeOutcome> {
  const [year, m] = month.split("-").map(Number)
  const monthStart = new Date(year, m - 1, 1)
  const monthEnd = new Date(year, m, 0, 23, 59, 59)
  const dueDate = new Date(year, m, 0, 23, 59, 59)

  const bookings = await prisma.booking.findMany({
    where: {
      consultantId,
      paymentType: "FLAT_FEE",
      status: { in: ["ACCEPTED", "IN_PROGRESS", "FILE_DELIVERED", "COMPLETED"] },
      scheduledAt: { gte: monthStart, lte: monthEnd },
    },
    include: { services: true },
  })
  const bookingSubtotal = bookings.reduce((sum, b) => {
    const services = b.services.reduce((s, svc) => s + svc.price, 0)
    const travel = b.hasTravelFee ? b.travelFeeAmount : 0
    const extraIntros = b.additionalIntros * ADDITIONAL_INTRO_PRICE
    return sum + services + travel + extraIntros
  }, 0)

  const regularIntros = await prisma.deliverable.findMany({
    where: {
      OR: [
        { targetConsultantId: consultantId },
        { secondConsultantId: consultantId },
        { thirdConsultantId: consultantId },
        { fourthConsultantId: consultantId },
      ],
      createdAt: { gte: monthStart, lte: monthEnd },
      NOT: { fileUrl: { startsWith: BACKFILL_PREFIX } },
    },
    select: { secondConsultantId: true, thirdConsultantId: true, fourthConsultantId: true },
  })
  const regularIntroSubtotal = regularIntros.reduce((sum, d) => {
    const split = 1 + (d.secondConsultantId ? 1 : 0) + (d.thirdConsultantId ? 1 : 0) + (d.fourthConsultantId ? 1 : 0)
    return sum + round2(ADDITIONAL_INTRO_PRICE / split)
  }, 0)

  const backfillCount = await prisma.deliverable.count({
    where: {
      fileUrl: { startsWith: BACKFILL_PREFIX },
      targetConsultantId: consultantId,
      mimeType: `backfill-charged:${month}`,
    },
  })
  const backfillSubtotal = backfillCount * ADDITIONAL_INTRO_PRICE

  const subtotal = round2(bookingSubtotal + regularIntroSubtotal + backfillSubtotal)
  const total = round2(subtotal * (1 + IVA_RATE))

  const existing = await prisma.monthlyInvoice.findFirst({ where: { consultantId, month } })
  if (existing?.status === "PAID") return "skipped-paid"

  let invoiceId: string
  if (existing) {
    await prisma.monthlyInvoice.update({
      where: { id: existing.id },
      data: { subtotal, total },
    })
    invoiceId = existing.id
  } else if (subtotal > 0) {
    const invoice = await prisma.monthlyInvoice.create({
      data: { consultantId, month, subtotal, total, dueDate, status: "PENDING" },
    })
    invoiceId = invoice.id
  } else {
    return "empty"
  }

  if (bookings.length > 0) {
    await prisma.booking.updateMany({
      where: { id: { in: bookings.map((b) => b.id) } },
      data: { invoiceId },
    })
  }

  return existing ? "updated" : "created"
}
