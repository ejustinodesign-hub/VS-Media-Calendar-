import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPrice } from "@/lib/pricing"
import { Wallet } from "lucide-react"
import { RemunerationCard } from "./remuneration-card"

const VIDEO_RATE = 10
const PHOTO_RATE = 10
const AI_RATE    = 10
const INTRO_RATE = 10

function calcBookingEarnings(booking: {
  services: { serviceType: string }[]
  additionalIntros: number
  hasTravelFee: boolean
  travelFeeAmount: number
}) {
  const hasDroneVideo = booking.services.some((s) => s.serviceType === "VIDEO_DRONE")

  const videoEarnings = booking.services.filter(
    (s) => s.serviceType === "VIDEO_STANDARD" || s.serviceType === "VIDEO_DRONE"
  ).length * VIDEO_RATE

  const aiEarnings = booking.services.filter(
    (s) => s.serviceType === "VIDEO_AI"
  ).length * AI_RATE

  const introEarnings = booking.additionalIntros * INTRO_RATE

  const photoEarnings = booking.services
    .filter((s) => s.serviceType.startsWith("PHOTO_"))
    .reduce((sum, s) => {
      if (s.serviceType === "PHOTO_DRONE" && hasDroneVideo) return sum
      return sum + PHOTO_RATE
    }, 0)

  const travelEarnings = booking.hasTravelFee ? booking.travelFeeAmount : 0

  return { videoEarnings, aiEarnings, introEarnings, photoEarnings, travelEarnings }
}

export default async function AdminRemunerationPage() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const COUNTED_STATUSES = ["ACCEPTED", "IN_PROGRESS", "FILE_DELIVERED", "COMPLETED"] as const

  const videographers = await prisma.user.findMany({
    where: { role: "VIDEOGRAPHER", active: true },
    select: {
      id: true, name: true, email: true, image: true,
      videographerProfile: { select: { baseSalary: true } },
    },
    orderBy: { name: "asc" },
  })

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
      select: { uploadedBy: true, videographerFee: true },
    }),
  ])

  const monthLabel = now.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })

  const data = videographers.map((v) => {
    const baseSalary = v.videographerProfile?.baseSalary ?? 1200
    const bookings = allBookings.filter((b) => b.videographerId === v.id)
    const intros   = allIntros.filter((d) => d.uploadedBy === v.id)

    let videoTotal = 0, aiTotal = 0, introTotal = 0, photoTotal = 0, travelTotal = 0
    for (const b of bookings) {
      const e = calcBookingEarnings(b)
      videoTotal  += e.videoEarnings
      aiTotal     += e.aiEarnings
      introTotal  += e.introEarnings
      photoTotal  += e.photoEarnings
      travelTotal += e.travelEarnings
    }
    const sharedIntrosTotal = intros.reduce((sum, d) => sum + (d.videographerFee ?? INTRO_RATE), 0)
    const variable = videoTotal + aiTotal + introTotal + photoTotal + travelTotal + sharedIntrosTotal
    const total    = baseSalary + variable

    return {
      id: v.id,
      name: v.name,
      email: v.email,
      image: v.image,
      baseSalary,
      bookingCount: bookings.length,
      videoTotal,
      aiTotal,
      introTotal,
      photoTotal,
      travelTotal,
      sharedIntrosTotal,
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
          <div className="text-right text-slate-400 text-sm">
            <p>{data.length} videógrafo(s)</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((v) => (
            <RemunerationCard
              key={v.id}
              videographer={v}
              rates={{ VIDEO_RATE, PHOTO_RATE, AI_RATE, INTRO_RATE }}
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
