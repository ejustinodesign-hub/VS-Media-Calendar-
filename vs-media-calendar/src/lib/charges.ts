import { prisma } from "@/lib/prisma"
import { IVA_RATE, ADDITIONAL_INTRO_PRICE, SERVICE_LABELS } from "@/lib/pricing"
import { INTRO_CONSULTANT_FIELDS, introSplitCount } from "@/lib/intros"
import type { ServiceType } from "@prisma/client"

/**
 * Cobrança vídeo a vídeo.
 *
 * Cada vídeo entregue gera uma cobrança ao consultor da marcação, e cada
 * intro partilhada gera uma cobrança a cada consultor que nela aparece.
 * O consultor paga cada cobrança individualmente e só então descarrega o
 * ficheiro final.
 *
 * As MonthlyInvoice de junho a setembro de 2026 mantêm-se intactas — são
 * histórico e continuam a ser pagas pelo fluxo antigo.
 */

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** Estados de marcação em que o serviço conta como prestado. */
export const DELIVERED_STATUSES = ["FILE_DELIVERED", "COMPLETED"] as const

/** Valor s/ IVA do vídeo de uma marcação: serviços + deslocação + intros extra. */
export function bookingNetAmount(booking: {
  services: { price: number }[]
  hasTravelFee: boolean
  travelFeeAmount: number
  additionalIntros: number
}) {
  const services = booking.services.reduce((s, svc) => s + svc.price, 0)
  const travel = booking.hasTravelFee ? booking.travelFeeAmount : 0
  const extraIntros = booking.additionalIntros * ADDITIONAL_INTRO_PRICE
  return round2(services + travel + extraIntros)
}

export function withIva(net: number) {
  return round2(net * (1 + IVA_RATE))
}

/**
 * Cria ou actualiza a cobrança do vídeo de uma marcação.
 * Só marcações entregues e em taxa fixa são cobradas. Cobranças já pagas
 * nunca são alteradas.
 */
export async function syncBookingCharge(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { services: true },
  })
  if (!booking) return null

  const existing = await prisma.charge.findFirst({
    where: { bookingId, consultantId: booking.consultantId, kind: "BOOKING" },
  })

  // Já pago: não mexer — o valor foi aceite pelo consultor
  if (existing?.status === "PAID") return existing

  const billable =
    booking.paymentType === "FLAT_FEE" &&
    (DELIVERED_STATUSES as readonly string[]).includes(booking.status)

  if (!billable) {
    // Deixou de ser cobrável (não entregue, cancelada ou passou a comissão)
    if (existing) await prisma.charge.delete({ where: { id: existing.id } })
    return null
  }

  const net = bookingNetAmount(booking)
  if (net <= 0) {
    if (existing) await prisma.charge.delete({ where: { id: existing.id } })
    return null
  }

  const serviceNames = booking.services
    .map((s) => SERVICE_LABELS[s.serviceType as ServiceType] ?? s.serviceType)
    .join(", ")
  const description = `${serviceNames || "Serviço"} — ${booking.propertyAddress}`

  const data = {
    description,
    netAmount: net,
    totalAmount: withIva(net),
  }

  if (existing) {
    return prisma.charge.update({ where: { id: existing.id }, data })
  }
  return prisma.charge.create({
    data: {
      consultantId: booking.consultantId,
      kind: "BOOKING",
      bookingId: booking.id,
      ...data,
    },
  })
}

/**
 * Cria ou actualiza as cobranças de uma intro partilhada: uma por consultor,
 * cada uma no valor de 25€ ÷ nº de consultores.
 */
export async function syncIntroCharges(deliverableId: string) {
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    include: { booking: { select: { propertyAddress: true } } },
  })
  if (!deliverable) return []

  const consultantIds = INTRO_CONSULTANT_FIELDS
    .map((f) => (deliverable as Record<string, unknown>)[f] as string | null)
    .filter(Boolean) as string[]

  const existing = await prisma.charge.findMany({
    where: { deliverableId, kind: "INTRO" },
  })

  // Consultores retirados da partilha: apagar cobranças ainda por pagar
  for (const charge of existing) {
    if (!consultantIds.includes(charge.consultantId) && charge.status !== "PAID") {
      await prisma.charge.delete({ where: { id: charge.id } })
    }
  }

  if (consultantIds.length === 0) return []

  const net = round2(ADDITIONAL_INTRO_PRICE / introSplitCount(deliverable))
  const description =
    deliverable.description ||
    `Intro — ${deliverable.booking?.propertyAddress ?? deliverable.fileName}`

  const result = []
  for (const consultantId of consultantIds) {
    const current = existing.find((c) => c.consultantId === consultantId)
    if (current?.status === "PAID") { result.push(current); continue }

    if (current) {
      result.push(await prisma.charge.update({
        where: { id: current.id },
        data: { description, netAmount: net, totalAmount: withIva(net) },
      }))
    } else {
      result.push(await prisma.charge.create({
        data: {
          consultantId,
          kind: "INTRO",
          deliverableId,
          description,
          netAmount: net,
          totalAmount: withIva(net),
        },
      }))
    }
  }
  return result
}

/** Cobranças por pagar de um consultor, mais antigas primeiro. */
export async function pendingCharges(consultantId: string) {
  return prisma.charge.findMany({
    where: { consultantId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
  })
}

/** Total por pagar de um consultor (c/ IVA). */
export async function pendingTotal(consultantId: string) {
  const agg = await prisma.charge.aggregate({
    where: { consultantId, status: "PENDING" },
    _sum: { totalAmount: true },
  })
  return round2(agg._sum.totalAmount ?? 0)
}

/** Dias a partir dos quais uma cobrança por pagar bloqueia novas marcações. */
export const CHARGE_OVERDUE_DAYS = 30

/** Cobranças por pagar há mais de CHARGE_OVERDUE_DAYS. */
export async function overdueChargeCount(consultantId: string) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - CHARGE_OVERDUE_DAYS)
  return prisma.charge.count({
    where: { consultantId, status: "PENDING", createdAt: { lt: cutoff } },
  })
}
