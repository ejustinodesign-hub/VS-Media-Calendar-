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

  const videoRanking = Object.values(videoCountByConsultant).sort((a, b) => b.count - a.count)
  const introRanking = Object.values(introCountByConsultant).sort((a, b) => b.count - a.count)
  const spenderRanking = invoices.map(inv => ({ name: inv.consultant.name, total: inv.total }))

  return (
    <>
      <Header title="Diplomas" subtitle={`Mês de ${monthLabel}`} />
      <div className="flex-1 p-6">
        <div className="grid gap-10 max-w-2xl mx-auto">

          {/* Vídeos */}
          <div className="space-y-3">
            <DiplomaCard
              type="video"
              month={monthLabel}
              name={videoChamp?.name ?? "—"}
              image={videoChamp?.image ?? null}
              metric={videoChamp?.count ?? 0}
              metricLabel="vídeos marcados"
            />
            <RankingTable
              rows={videoRanking.map(r => ({ name: r.name ?? "—", value: `${r.count} vídeos` }))}
            />
          </div>

          {/* Intros */}
          <div className="space-y-3">
            <DiplomaCard
              type="intros"
              month={monthLabel}
              name={introChamp?.name ?? "—"}
              image={introChamp?.image ?? null}
              metric={introChamp?.count ?? 0}
              metricLabel="intros no total"
            />
            <RankingTable
              rows={introRanking.map(r => ({ name: r.name ?? "—", value: `${r.count} intros` }))}
            />
          </div>

          {/* Big Spender */}
          <div className="space-y-3">
            <DiplomaCard
              type="spender"
              month={monthLabel}
              name={bigSpender?.consultant.name ?? "—"}
              image={bigSpender?.consultant.image ?? null}
              metric={bigSpender?.total ?? 0}
              metricLabel="investido"
            />
            <RankingTable
              rows={spenderRanking.map(r => ({ name: r.name ?? "—", value: `${r.total.toFixed(2).replace(".", ",")} €` }))}
            />
          </div>

        </div>
      </div>
    </>
  )
}

function RankingTable({ rows }: { rows: { name: string; value: string }[] }) {
  if (rows.length === 0) return null
  return (
    <div className="rounded-xl border border-slate-100 overflow-hidden text-sm">
      <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Ranking completo
      </div>
      {rows.map((row, i) => (
        <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${i < rows.length - 1 ? "border-b border-slate-100" : ""}`}>
          <div className="flex items-center gap-2.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              i === 0 ? "bg-amber-100 text-amber-700" :
              i === 1 ? "bg-slate-100 text-slate-500" :
              i === 2 ? "bg-orange-50 text-orange-500" :
              "bg-slate-50 text-slate-400"
            }`}>{i + 1}</span>
            <span className="text-slate-700 font-medium">{row.name}</span>
          </div>
          <span className="text-slate-500 font-medium">{row.value}</span>
        </div>
      ))}
    </div>
  )
}
