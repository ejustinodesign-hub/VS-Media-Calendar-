export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { DiplomaCard } from "./diploma-card"

export default async function DiplomasPage() {
  const now = new Date()
  // Default to previous month (most recently completed)
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1)
  const monthEnd   = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59)
  const monthLabel = prevMonth.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })

  const COUNTED_STATUSES = ["ACCEPTED", "IN_PROGRESS", "FILE_DELIVERED", "COMPLETED"] as const

  // ── Campeão dos Vídeos ─────────────────────────────────────────────────
  const videoBookings = await prisma.bookingService.findMany({
    where: {
      serviceType: { in: ["VIDEO_STANDARD", "VIDEO_DRONE"] },
      booking: {
        scheduledAt: { gte: monthStart, lte: monthEnd },
        status: { in: [...COUNTED_STATUSES] },
      },
    },
    include: {
      booking: { include: { videographer: { select: { id: true, name: true, image: true } } } },
    },
  })

  const videoCountByVg: Record<string, { count: number; name: string | null; image: string | null }> = {}
  for (const svc of videoBookings) {
    const vg = svc.booking.videographer
    if (!videoCountByVg[vg.id]) videoCountByVg[vg.id] = { count: 0, name: vg.name, image: vg.image }
    videoCountByVg[vg.id].count++
  }
  const videoChampEntry = Object.values(videoCountByVg).sort((a, b) => b.count - a.count)[0] ?? null

  // ── Campeão das Intros ─────────────────────────────────────────────────
  const introDels = await prisma.deliverable.findMany({
    where: {
      targetConsultantId: { not: null },
      createdAt: { gte: monthStart, lte: monthEnd },
    },
    include: {
      booking: { include: { videographer: { select: { id: true, name: true, image: true } } } },
    },
  })

  const introCountByVg: Record<string, { count: number; name: string | null; image: string | null }> = {}
  for (const d of introDels) {
    const vg = d.booking.videographer
    if (!introCountByVg[vg.id]) introCountByVg[vg.id] = { count: 0, name: vg.name, image: vg.image }
    introCountByVg[vg.id].count++
  }
  const introChampEntry = Object.values(introCountByVg).sort((a, b) => b.count - a.count)[0] ?? null

  // ── Big Spender ────────────────────────────────────────────────────────
  const invoices = await prisma.monthlyInvoice.findMany({
    where: {
      month: `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`,
    },
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
            name={videoChampEntry?.name ?? "—"}
            image={videoChampEntry?.image ?? null}
            metric={videoChampEntry?.count ?? 0}
            metricLabel="vídeos realizados"
          />
          <DiplomaCard
            type="intros"
            month={monthLabel}
            name={introChampEntry?.name ?? "—"}
            image={introChampEntry?.image ?? null}
            metric={introChampEntry?.count ?? 0}
            metricLabel="intros partilhadas"
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
