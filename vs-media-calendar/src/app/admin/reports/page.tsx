import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPrice } from "@/lib/pricing"
import { DollarSign, TrendingUp, Calendar, Users, Video, Camera } from "lucide-react"

export default async function AdminReportsPage() {
  const now = new Date()
  const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd       = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

  const DELIVERED = ["FILE_DELIVERED", "COMPLETED"] as ("FILE_DELIVERED" | "COMPLETED")[]

  const [
    deliveredThisMonth,
    deliveredLastMonth,
    introsThisMonth,
    introsLastMonth,
    monthBookings,
    totalByVideographer,
    serviceTypeStats,
    topConsultants,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: { status: { in: DELIVERED }, scheduledAt: { gte: monthStart, lte: monthEnd }, paymentType: "FLAT_FEE" },
      select: { hasTravelFee: true, travelFeeAmount: true, services: { select: { price: true } } },
    }),
    prisma.booking.findMany({
      where: { status: { in: DELIVERED }, scheduledAt: { gte: lastMonthStart, lte: lastMonthEnd }, paymentType: "FLAT_FEE" },
      select: { hasTravelFee: true, travelFeeAmount: true, services: { select: { price: true } } },
    }),
    prisma.deliverable.count({
      where: { targetConsultantId: { not: null }, createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.deliverable.count({
      where: { targetConsultantId: { not: null }, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
    prisma.booking.count({
      where: { scheduledAt: { gte: monthStart, lte: monthEnd }, status: { notIn: ["CANCELLED", "REJECTED"] } },
    }),
    prisma.booking.groupBy({
      by: ["videographerId"],
      _count: { id: true },
      where: { status: { notIn: ["CANCELLED", "REJECTED"] } },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.bookingService.groupBy({
      by: ["serviceType"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.booking.groupBy({
      by: ["consultantId"],
      _count: { id: true },
      where: { status: { notIn: ["CANCELLED", "REJECTED"] } },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ])

  const calcRevenue = (bookings: typeof deliveredThisMonth, intros: number) =>
    bookings.reduce((sum, b) =>
      sum
      + b.services.reduce((s, svc) => s + svc.price, 0)
      + (b.hasTravelFee ? b.travelFeeAmount : 0)
    , 0) + intros * 25

  const videographerIds = totalByVideographer.map((v) => v.videographerId)
  const consultantIds   = topConsultants.map((c) => c.consultantId)

  const [videographerNames, consultantNames] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: videographerIds } }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { id: { in: consultantIds } }, select: { id: true, name: true } }),
  ])

  const currentRevenue = calcRevenue(deliveredThisMonth, introsThisMonth)
  const prevRevenue    = calcRevenue(deliveredLastMonth, introsLastMonth)
  const deliveredCount = deliveredThisMonth.length
  const revGrowth      = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : null

  return (
    <>
      <Header title="Relatórios" subtitle={`Dados referentes a ${now.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}`} />
      <div className="flex-1 p-6 space-y-6">
        {/* Monthly KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Receita Este Mês</p>
                  <p className="text-2xl font-bold text-slate-900">{formatPrice(currentRevenue)}</p>
                  {revGrowth !== null ? (
                    <p className={`text-xs mt-1 font-medium ${revGrowth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {revGrowth >= 0 ? "+" : ""}{revGrowth.toFixed(1)}% vs mês anterior
                    </p>
                  ) : (
                    <p className="text-xs mt-1 text-slate-400">Primeiro mês com dados</p>
                  )}
                </div>
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Marcações Este Mês</p>
                  <p className="text-2xl font-bold text-slate-900">{monthBookings}</p>
                  <p className="text-xs mt-1 text-slate-400">{deliveredCount} entregues</p>
                </div>
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Receita Mês Anterior</p>
                  <p className="text-2xl font-bold text-slate-900">{formatPrice(prevRevenue)}</p>
                </div>
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-slate-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Ticket Médio</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {deliveredCount > 0 ? formatPrice(currentRevenue / deliveredCount) : "—"}
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Service type stats */}
          <Card>
            <CardHeader>
              <CardTitle>Serviços Mais Usados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {serviceTypeStats.map((s) => {
                const total = serviceTypeStats.reduce((sum, x) => sum + x._count.id, 0)
                const pct = total > 0 ? (s._count.id / total) * 100 : 0
                return (
                  <div key={s.serviceType}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-slate-600">{s.serviceType.replace(/_/g, " ")}</span>
                      <span className="text-xs font-bold">{s._count.id}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#e94560] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Top videographers */}
          <Card>
            <CardHeader>
              <CardTitle>Top Videógrafos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {totalByVideographer.map((v) => {
                const name = videographerNames.find((u) => u.id === v.videographerId)?.name || "—"
                return (
                  <div key={v.videographerId} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 font-medium">{name}</span>
                    <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {v._count.id} serv.
                    </span>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Top consultants */}
          <Card>
            <CardHeader>
              <CardTitle>Top Consultores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topConsultants.map((c) => {
                const name = consultantNames.find((u) => u.id === c.consultantId)?.name || "—"
                return (
                  <div key={c.consultantId} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 font-medium">{name}</span>
                    <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {c._count.id} marc.
                    </span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
