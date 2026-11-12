// Trabalhos de outubro de 2026 feitos fora da plataforma e nunca cobrados.
// Lista fechada, confirmada com o admin; adicionados com data de 31 de outubro.
import { prisma } from "@/lib/prisma"
import { syncBookingCharge, syncIntroCharges } from "@/lib/charges"
import { MANUAL_INTRO_PREFIX } from "@/lib/intros"
import type { ServiceType } from "@prisma/client"

export const OCTOBER_BACKFILL_MARKER = "backfill:trabalhos-outubro-2026"

/** 31 de outubro de 2026, ao meio-dia (UTC) */
export const OCTOBER_BACKFILL_DATE = new Date(Date.UTC(2026, 9, 31, 12, 0, 0))

const TOMAS = "cmp0a5mfi000004juhhgktgus"
const ALEX = "cmp15n142000104kyyco9g6ec"
const FILIPE = "cmp2adlzh000004l8qcy5f3cx"
const FARINHA = "cmp10l7y2000004kz36ucmgsv"
const MONICA = "cmp0ccoz3000104kzwx6a7v33"
const SARAH = "cmuzieq3p000104l6fpmyub31"

export const OCTOBER_BACKFILL = {
  videographerId: TOMAS,

  // Marcação que já existia (vídeo entregue a 14 out) mas nunca foi cobrada;
  // faltavam-lhe também as fotografias
  existing: {
    bookingId: "cmups7360000604l5ow9ax67p",
    consultantId: ALEX,
    label: "Alex — Moradia Azeitão (vídeo + fotografias T3/T4)",
    addService: { serviceType: "PHOTO_T3_T4", price: 55 },
  },

  // Marcações novas, já entregues
  bookings: [
    {
      key: "lourinha-video-2",
      consultantId: FILIPE,
      label: "Filipe Silva — Moradia Lourinhã (vídeo 2)",
      address: "Rua de Santo António 12, Santa Bárbara, Lourinhã (vídeo 2)",
      services: [{ serviceType: "VIDEO_STANDARD", price: 100 }],
      travelFee: 0,
    },
    {
      key: "terreno-odivelas",
      consultantId: FILIPE,
      label: "Filipe Silva — Terreno Odivelas (vídeo)",
      address: "Terreno, Odivelas",
      services: [{ serviceType: "VIDEO_STANDARD", price: 100 }],
      travelFee: 0,
    },
    {
      key: "apartamento-cascais",
      consultantId: FARINHA,
      label: "Farinha — Apartamento Cascais (vídeo)",
      address: "Apartamento, Cascais",
      services: [{ serviceType: "VIDEO_STANDARD", price: 100 }],
      travelFee: 0,
    },
    {
      key: "santarem",
      consultantId: FARINHA,
      label: "Farinha — Santarém (fotografias T1/T2 + deslocação)",
      address: "Santarém",
      services: [{ serviceType: "PHOTO_T1_T2", price: 45 }],
      travelFee: 50,
    },
  ],

  // Intros de Vialonga. Não havia marcação desse vídeo, por isso ficam
  // ancoradas a uma marcação sem valor (sessão de intros a 0 €).
  intros: {
    key: "vialonga",
    anchorConsultantId: MONICA,
    address: "Vialonga",
    consultantIds: [MONICA, SARAH],
    labels: ["Vialonga — intro Mónica Monteiro", "Vialonga — intro Sarah Machado"],
  },
} as const

/** Nº de marcações que o backfill cria (para saber se já correu por completo). */
export const OCTOBER_BACKFILL_BOOKING_COUNT = OCTOBER_BACKFILL.bookings.length + 1

const INTRO_VIDEOGRAPHER_FEE = 10

export type OctoberBackfillLine = { label: string; total: number | null; outcome: "criado" | "já existia" | "erro"; error?: string }

// As cobranças ficam com a data do trabalho (31 out), não a de hoje
async function backdate(chargeIds: string[]) {
  if (chargeIds.length === 0) return
  await prisma.charge.updateMany({
    where: { id: { in: chargeIds }, status: "PENDING" },
    data: { createdAt: OCTOBER_BACKFILL_DATE },
  })
}

/**
 * Adiciona os trabalhos e cria as respetivas cobranças. Cada item é verificado
 * antes de ser criado, por isso é seguro correr mais de uma vez — só cria o
 * que ainda faltar.
 */
export async function runOctoberBackfill() {
  const cfg = OCTOBER_BACKFILL
  const lines: OctoberBackfillLine[] = []

  // 1) Marcação que já existia mas nunca foi cobrada
  try {
    const ex = cfg.existing
    const booking = await prisma.booking.findFirst({
      where: { id: ex.bookingId, consultantId: ex.consultantId },
      include: { services: true, charges: { where: { kind: "BOOKING" } } },
    })
    if (!booking) throw new Error("marcação não encontrada")
    if (booking.charges.length > 0) {
      lines.push({ label: ex.label, total: booking.charges[0].totalAmount, outcome: "já existia" })
    } else {
      if (!booking.services.some((s) => s.serviceType === ex.addService.serviceType)) {
        await prisma.bookingService.create({
          data: {
            bookingId: booking.id,
            serviceType: ex.addService.serviceType as ServiceType,
            price: ex.addService.price,
          },
        })
      }
      const charge = await syncBookingCharge(booking.id)
      if (!charge) throw new Error("a marcação não gerou cobrança")
      await backdate([charge.id])
      lines.push({ label: ex.label, total: charge.totalAmount, outcome: "criado" })
    }
  } catch (e) {
    lines.push({ label: cfg.existing.label, total: null, outcome: "erro", error: e instanceof Error ? e.message : String(e) })
  }

  // 2) Marcações novas, já entregues
  for (const job of cfg.bookings) {
    const notes = `${OCTOBER_BACKFILL_MARKER}:${job.key}`
    try {
      const already = await prisma.booking.findFirst({
        where: { notes },
        include: { charges: { where: { kind: "BOOKING" } } },
      })
      if (already?.charges.length) {
        lines.push({ label: job.label, total: already.charges[0].totalAmount, outcome: "já existia" })
        continue
      }
      const booking = already ?? await prisma.booking.create({
        data: {
          consultantId: job.consultantId,
          videographerId: cfg.videographerId,
          status: "FILE_DELIVERED",
          scheduledAt: OCTOBER_BACKFILL_DATE,
          propertyAddress: job.address,
          paymentType: "FLAT_FEE",
          hasTravelFee: job.travelFee > 0,
          travelFeeAmount: job.travelFee,
          notes,
          services: {
            create: job.services.map((s) => ({ serviceType: s.serviceType as ServiceType, price: s.price })),
          },
        },
      })
      const charge = await syncBookingCharge(booking.id)
      if (!charge) throw new Error("a marcação não gerou cobrança")
      await backdate([charge.id])
      lines.push({ label: job.label, total: charge.totalAmount, outcome: "criado" })
    } catch (e) {
      lines.push({ label: job.label, total: null, outcome: "erro", error: e instanceof Error ? e.message : String(e) })
    }
  }

  // 3) Intros de Vialonga, uma por consultor
  try {
    const it = cfg.intros
    const notes = `${OCTOBER_BACKFILL_MARKER}:${it.key}`
    const anchor =
      (await prisma.booking.findFirst({ where: { notes }, select: { id: true } }))
      ?? (await prisma.booking.create({
        data: {
          consultantId: it.anchorConsultantId,
          videographerId: cfg.videographerId,
          status: "FILE_DELIVERED",
          scheduledAt: OCTOBER_BACKFILL_DATE,
          propertyAddress: it.address,
          paymentType: "FLAT_FEE",
          notes,
          services: { create: [{ serviceType: "INTRO", price: 0 }] },
        },
        select: { id: true },
      }))

    for (const [i, consultantId] of it.consultantIds.entries()) {
      const label = it.labels[i]
      try {
        const fileUrl = `${MANUAL_INTRO_PREFIX}${anchor.id}:${consultantId}`
        const existing = await prisma.deliverable.findFirst({
          where: { fileUrl },
          include: { charges: true },
        })
        if (existing?.charges.length) {
          lines.push({ label, total: existing.charges[0].totalAmount, outcome: "já existia" })
          continue
        }
        const intro = existing ?? await prisma.deliverable.create({
          data: {
            bookingId: anchor.id,
            fileName: `intro-vialonga-${i + 1}.mp4`,
            fileUrl,
            uploadedBy: cfg.videographerId,
            description: `Intro — ${it.address}`,
            targetConsultantId: consultantId,
            videographerFee: INTRO_VIDEOGRAPHER_FEE,
            createdAt: OCTOBER_BACKFILL_DATE,
          },
        })
        const charges = await syncIntroCharges(intro.id)
        if (charges.length === 0) throw new Error("a intro não gerou cobrança")
        await backdate(charges.map((c) => c.id))
        lines.push({ label, total: charges[0].totalAmount, outcome: "criado" })
      } catch (e) {
        lines.push({ label, total: null, outcome: "erro", error: e instanceof Error ? e.message : String(e) })
      }
    }
  } catch (e) {
    lines.push({ label: "Vialonga — intros", total: null, outcome: "erro", error: e instanceof Error ? e.message : String(e) })
  }

  const created = lines.filter((l) => l.outcome === "criado")
  return {
    lines,
    created: created.length,
    existing: lines.filter((l) => l.outcome === "já existia").length,
    errors: lines.filter((l) => l.outcome === "erro").length,
    totalCreated: Math.round(created.reduce((s, l) => s + (l.total ?? 0), 0) * 100) / 100,
  }
}
