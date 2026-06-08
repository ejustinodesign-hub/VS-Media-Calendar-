import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingStatusBadge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/pricing"
import Link from "next/link"
import {
  Users, Calendar, DollarSign, TrendingUp, CheckCircle2,
  Clock, AlertCircle, BarChart3,
} from "lucide-react"

export default async function AdminDashboard() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [totalUsers, totalBookings, monthlyDelivered, monthlyIntros, recentBookings, statusStats] =
    await Promise.all([
      prisma.user.count({ where: { active: true } }),
      prisma.booking.count(),
      // Main services: FILE_DELIVERED/COMPLETED bookings scheduled this month
      prisma.booking.findMany({
        where: {
          status: { in: ["FILE_DELIVERED", "COMPLETED"] },
          scheduledAt: { gte: monthStart, lte: monthEnd },
          paymentType: "FLAT_FEE",
        },
        select: {
          travelFeeAmount: true,
          hasTravelFee: true,
          services: { select: { price: true } },
        },
      }),
      // Intros: deliverables with targetConsultantId created this month (25€ each)
      prisma.deliverable.count({
        where: {
          targetConsultantId: { not: null },
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.booking.findMany({
        include: {
          consultant:   { select: { name: true } },
          videographer: { select: { name: true, email: true } },
          payment:      { select: { amount: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.booking.groupBy({ by: ["status"], _count: { id: true } }),
    ])

  const statusCount = (status: string) =>
    statusStats.find((s) => s.status === status)?._count.id || 0

  const pendingCount   = statusCount("PENDING_ACCEPTANCE")
  const completedCount = statusCount("COMPLETED") + statusCount("FILE_DELIVERED")

  const monthRevenue =
    monthlyDelivered.reduce((sum, b) => {
      const services = b.services.reduce((s, svc) => s + svc.price, 0)
      const travel   = b.hasTravelFee ? b.travelFeeAmount : 0
      return sum + services + travel
    }, 0)
    + monthlyIntros * 25

  const monthLabel = now.toLocaleDateString("pt-PT", { month: "long" })
  const deliveredCount = monthlyDelivered.length

  const topStats = [
    { label: "Utilizadores Ativos",  value: totalUsers,                  icon: Users,        color: "text-blue-600 bg-blue-50",    href: "/admin/users" },
    { label: "Total de Marcações",   value: totalBookings,               icon: Calendar,     color: "text-purple-600 bg-purple-50", href: "/admin/bookings" },
    { label: `Receita — ${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}`, value: formatPrice(monthRevenue), icon: DollarSign, color: "text-emerald-600 bg-emerald-50", isText: true, href: "/admin/reports" },
    { label: "Entregues este mês",   value: deliveredCount,              icon: CheckCircle2, color: "text-orange-600 bg-orange-50", href: "/admin/bookings?status=FILE_DELIVERED" },
  ]

  return (
    <>
      <Header title="Painel de Administração" subtitle="Visão global da plataforma VS.Media Calendar" />
      <div className="flex-1 p-6 space-y-6">
        {/* Alert for pending */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              {pendingCount} marcação(ões) aguardam aceitação pelo videógrafo
            </p>
            <Link href="/admin/bookings?status=PENDING_ACCEPTANCE" className="ml-auto text-sm font-semibold text-amber-700 hover:underline whitespace-nowrap">
              Ver →
            </Link>
          </div>
        )}

        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {topStats.map((stat) => (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center gap-4 py-5">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                    <p className="text-xs text-slate-500">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Status breakdown + Recent */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-500" />
                Por Estado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { status: "PENDING_PAYMENT", label: "Aguarda Pagamento" },
                { status: "PAID", label: "Paga" },
                { status: "PENDING_ACCEPTANCE", label: "Aguarda Aceitação" },
                { status: "ACCEPTED", label: "Aceite" },
                { status: "REJECTED", label: "Recusada" },
                { status: "CANCELLED", label: "Cancelada" },
                { status: "FILE_DELIVERED", label: "Entregue" },
                { status: "COMPLETED", label: "Concluída" },
              ].map((s) => {
                const count = statusCount(s.status)
                if (count === 0) return null
                const pct = totalBookings > 0 ? (count / totalBookings) * 100 : 0
                return (
                  <div key={s.status}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-slate-600">{s.label}</span>
                      <span className="text-xs font-bold text-slate-900">{count}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0f3460] rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Recent bookings */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Marcações Recentes</CardTitle>
              <Link href="/admin/bookings" className="text-sm text-[#0f3460] font-medium hover:underline">
                Ver todas →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {recentBookings.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/admin/bookings/${booking.id}`}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-slate-900">
                          {booking.consultant.name}
                        </span>
                        <span className="text-slate-300">→</span>
                        <span className="text-sm text-slate-600">{booking.videographer.name || booking.videographer.email || "Sem nome"}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{booking.propertyAddress}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <BookingStatusBadge status={booking.status} />
                      {booking.payment?.amount && (
                        <span className="text-xs text-slate-500">{formatPrice(booking.payment.amount)}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
