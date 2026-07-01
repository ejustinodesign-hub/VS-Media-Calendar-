export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { DiplomaCard } from "./diploma-card"

export default async function DiplomasPage() {
  const now = new Date()
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1)
  const monthEnd   = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59)
  const monthLabel = prevMonth.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })

  const COUNTED_STATUSES = ["ACCEPTED", "IN_PROGRESS", "FILE_DELIVERED", "COMPLETED"] as const

  // ── Campeão dos Vídeos — consultant with most video services booked ─────
  const videoServices = await prisma.bookingService.findMany({
    where: {
      serviceType: { in: ["VIDEO_STANDARD", "VIDEO_DRONE"] },
      booking: {
        scheduledAt: { gte: monthStart, lte: monthEnd },
        status: { in: [...COUNTED_STATUSES] },
      },
    },
    include: {
      booking: { include: { consultant: { select: { id: true, name: true, image: true } } } },
    },
  })

  const videoCountByConsultant: Record<string, { count: number; name: string | null; image: string | null }> = {}
  for (const svc of videoServices) {
    const c = svc.booking.consultant
    if (!videoCountByConsultant[c.id]) videoCountByConsultant[c.id] = { count: 0, name: c.name, image: c.image }
    videoCountByConsultant[c.id].count++
  }
  const videoChamp = Object.values(videoCountByConsultant).sort((a, b) => b.count - a.count)[0] ?? null

  // ── Campeão das Intros — consultant who ordered the most additional intros
  // (additionalIntros on bookings + shared intros received as targetConsultant)
  const bookingsWithIntros = await prisma.booking.findMany({
    where: {
      scheduledAt: { gte: monthStart, lte: monthEnd },
      status: { in: [...COUNTED_STATUSES] },
      additionalIntros: { gt: 0 },
    },
    select: { consultantId: true, additionalIntros: true, consultant: { select: { id: true, name: true, image: true } } },
  })

  const sharedIntrosReceived = await prisma.deliverable.findMany({
    where: {
      targetConsultantId: { not: null },
      createdAt: { gte: monthStart, lte: monthEnd },
    },
    select: { targetConsultantId: true, targetConsultant: { select: { id: true, name: true, image: true } } },
  })

  const introCountByConsultant: Record<string, { count: number; name: string | null; image: string | null }> = {}
  for (const b of bookingsWithIntros) {
    const c = b.consultant
    if (!introCountByConsultant[c.id]) introCountByConsultant[c.id] = { count: 0, name: c.name, image: c.image }
    introCountByConsultant[c.id].count += b.additionalIntros
  }
  for (const d of sharedIntrosReceived) {
    if (!d.targetConsultant) continue
    const c = d.targetConsultant
    if (!introCountByConsultant[c.id]) introCountByConsultant[c.id] = { count: 0, name: c.name, image: c.image }
    introCountByConsultant[c.id].count++
  }
  const introChamp = Object.values(introCountByConsultant).sort((a, b) => b.count - a.count)[0] ?? null

  // ── Big Spender — consultant with highest invoice total ────────────────
  const invoices = await prisma.monthlyInvoice.findMany({
    where: { month: `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}` },
    include: { consultant: { select: { id: true, name: true, image: true } } },
    orderBy: { total: "desc" },
  })
  const bigSpender = invoices[0] ?? null

  return (
    <>
      <Header title="Diplomas" subtitle={`Mês de ${monthLabel}`} />
      <div className="flex-1 p-6">
        <div className="grid gap-8 max-w-2xl mx-auto">
          <DiplomaCard
            type="video"
            month={monthLabel}
            name={videoChamp?.name ?? "—"}
            image={videoChamp?.image ?? null}
            metric={videoChamp?.count ?? 0}
            metricLabel="vídeos marcados"
          />
          <DiplomaCard
            type="intros"
            month={monthLabel}
            name={introChamp?.name ?? "—"}
            image={introChamp?.image ?? null}
            metric={introChamp?.count ?? 0}
            metricLabel="intros no total"
          />
          <DiplomaCard
            type="spender"
            month={monthLabel}
            name={bigSpender?.consultant.name ?? "—"}
            image={bigSpender?.consultant.image ?? null}
            metric={bigSpender?.total ?? 0}
            metricLabel="investido"
          />
        </div>
      </div>
    </>
  )
}
