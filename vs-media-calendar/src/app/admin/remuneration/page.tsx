export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPrice } from "@/lib/pricing"
import { Wallet } from "lucide-react"
import { RemunerationCard } from "./remuneration-card"
import { SimulationPanel } from "./simulation-panel"

const STANDARD_RATE = 80
const DRONE_RATE    = 90
const AI_RATE       = 15
const INTRO_RATE    = 10

const PHOTO_RATES: Record<string, number> = {
  PHOTO_T1_T2:   20,
  PHOTO_T3_T4:   30,
  PHOTO_T5_PLUS: 40,
  PHOTO_DRONE:   30,
}

function calcBookingEarnings(booking: {
  services: { serviceType: string }[]
  additionalIntros: number
  hasTravelFee: boolean
  travelFeeAmount: number
}) {
  const hasDroneVideo = booking.services.some((s) => s.serviceType === "VIDEO_DRONE")

  let standardEarnings = 0
  let droneEarnings    = 0
  let aiEarnings       = 0
  let photoEarnings    = 0

  for (const s of booking.services) {
    if      (s.serviceType === "VIDEO_STANDARD") standardEarnings += STANDARD_RATE
    else if (s.serviceType === "VIDEO_DRONE")    droneEarnings    += DRONE_RATE
    else if (s.serviceType === "VIDEO_AI")       aiEarnings       += AI_RATE
    else if (s.serviceType.startsWith("PHOTO_")) {
      if (s.serviceType === "PHOTO_DRONE" && hasDroneVideo) continue
      photoEarnings += PHOTO_RATES[s.serviceType] ?? 0
    }
  }

  const introEarnings  = booking.additionalIntros * INTRO_RATE
  const travelEarnings = booking.hasTravelFee ? booking.travelFeeAmount : 0

  return { standardEarnings, droneEarnings, aiEarnings, introEarnings, photoEarnings, travelEarnings }
}

export default async function AdminRemunerationPage() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const COUNTED_STATUSES = ["ACCEPTED", "IN_PROGRESS", "FILE_DELIVERED", "COMPLETED"] as const

  const videographers = await prisma.user.findMany({
    where: { role: "VIDEOGRAPHER", active: true },
    select: { id: true, name: true, email: true, image: true },
    orderBy: { name: "asc" },
  })

  let salaryMap: Record<string, number> = {}
  let ctaMap: Record<string, boolean> = {}
  try {
    const profiles = await prisma.$queryRawUnsafe<{ userId: string; baseSalary: number; hasCta: boolean }[]>(
      'SELECT "userId", "baseSalary", "hasCta" FROM "VideographerProfile"'
    )
    for (const p of profiles) {
      salaryMap[p.userId] = p.baseSalary
      ctaMap[p.userId] = p.hasCta
    }
  } catch {
    // columns not yet in DB — fall back to defaults
  }

  const [allBookings, allIntros] = await Promise.all([
    prisma.booking.findMany({
      where: {
        videographerId: { in: videographers.map((v) => v.id) },
        scheduledAt: { gte: monthStart, lte: monthEnd },
        status: { in: [...COUNTED_STATUSES] },
      },
      select: {
        videographerId: true,
        additionalIntros: true,
        hasTravelFee: true,
        travelFeeAmount: true,
        services: { select: { serviceType: true } },
      },
    }),
    prisma.deliverable.findMany({
      where: {
        uploadedBy: { in: videographers.map((v) => v.id) },
        targetConsultantId: { not: null },
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      select: { uploadedBy: true, videographerFee: true, ctaBonus: true },
    }),
  ])

  const monthLabel = now.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })

  const data = videographers.map((v) => {
    const baseSalary = salaryMap[v.id] ?? 1200
    const bookings = allBookings.filter((b) => b.videographerId === v.id)
    const intros   = allIntros.filter((d) => d.uploadedBy === v.id)

    let standardTotal = 0, droneTotal = 0, aiTotal = 0, introTotal = 0, photoTotal = 0, travelTotal = 0
    let standardCount = 0, droneCount = 0
    for (const b of bookings) {
      const e = calcBookingEarnings(b)
      standardTotal += e.standardEarnings
      droneTotal    += e.droneEarnings
      aiTotal       += e.aiEarnings
      introTotal    += e.introEarnings
      photoTotal    += e.photoEarnings
      travelTotal   += e.travelEarnings
      standardCount += b.services.filter((s) => s.serviceType === "VIDEO_STANDARD").length
      droneCount    += b.services.filter((s) => s.serviceType === "VIDEO_DRONE").length
    }
    const sharedIntrosTotal = intros.length * INTRO_RATE
    const ctaBonusTotal = intros.reduce((sum, d) => sum + ((d as any).ctaBonus ?? 0), 0)
    const videoTotal = standardTotal + droneTotal
    const variable = videoTotal + aiTotal + introTotal + photoTotal + travelTotal + sharedIntrosTotal + ctaBonusTotal
    const total    = baseSalary + variable

    return {
      id: v.id,
      name: v.name,
      email: v.email,
      image: v.image,
      baseSalary,
      hasCta: ctaMap[v.id] ?? false,
      bookingCount: bookings.length,
      standardTotal,
      droneTotal,
      standardCount,
      droneCount,
      videoTotal,
      aiTotal,
      introTotal,
      photoTotal,
      travelTotal,
      sharedIntrosTotal,
      ctaBonusTotal,
      variable,
      total,
    }
  })

  const grandTotal = data.reduce((sum, v) => sum + v.total, 0)

  return (
    <>
      <Header title="Remuneração" subtitle={`Videógrafos · ${monthLabel}`} />
      <div className="flex-1 p-6 space-y-6">

        <div className="bg-[#0f3460] rounded-2xl px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-slate-300 text-sm">Total a pagar este mês</p>
            <p className="text-white text-3xl font-bold mt-0.5">{formatPrice(grandTotal)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-slate-400 text-sm">{data.length} videógrafo(s)</p>
            <SimulationPanel currentGrandTotal={grandTotal} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((v) => (
            <RemunerationCard
              key={v.id}
              videographer={v}
              rates={{ STANDARD_RATE, DRONE_RATE, AI_RATE, INTRO_RATE }}
            />
          ))}
        </div>

        {data.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum videógrafo ativo encontrado.</p>
          </div>
        )}
      </div>
    </>
  )
}
