import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DEMO_BOOKINGS, DEMO_STATUS_LABELS, DEMO_STATUS_COLORS } from "@/lib/demo-data"
import Link from "next/link"
import {
  Users, Calendar, DollarSign, CheckCircle2,
  AlertCircle, BarChart3,
} from "lucide-react"

export default function DemoAdminDashboard() {
  const totalUsers = 9
  const totalBookings = DEMO_BOOKINGS.length
  const revenue = DEMO_BOOKINGS.filter((b) => !["PENDING_PAYMENT", "CANCELLED"].includes(b.status))
    .reduce((sum, b) => sum + b.amount, 0)
  const completed = DEMO_BOOKINGS.filter((b) => b.status === "COMPLETED").length
  const pending = DEMO_BOOKINGS.filter((b) => b.status === "PENDING_ACCEPTANCE").length
  const recentBookings = [...DEMO_BOOKINGS].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 8)

  const statusBreakdown = [
    { status: "PENDING_ACCEPTANCE", label: "Aguarda Aceitação" },
    { status: "ACCEPTED", label: "Aceite" },
    { status: "IN_PROGRESS", label: "Em Execução" },
    { status: "FILE_DELIVERED", label: "Entregue" },
    { status: "COMPLETED", label: "Concluída" },
    { status: "CANCELLED", label: "Cancelada" },
    { status: "REJECTED", label: "Recusada" },
  ] as const

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Painel de Administração</h2>
          <p className="text-sm text-slate-500">Visão global da plataforma VS.Media Calendar</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
            AV
          </div>
          <span className="text-sm font-medium text-slate-700 hidden sm:block">Admin</span>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-6">
        {/* Alert */}
        {pending > 0 && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              {pending} marcação(ões) aguardam aceitação pelo videógrafo
            </p>
            <Link href="/demo/admin/bookings" className="ml-auto text-sm font-semibold text-amber-700 hover:underline whitespace-nowrap">
              Ver →
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Utilizadores Ativos", value: totalUsers, icon: Users, color: "text-blue-600 bg-blue-50", href: "/demo/admin/users" },
            { label: "Total de Marcações", value: totalBookings, icon: Calendar, color: "text-purple-600 bg-purple-50", href: "/demo/admin/bookings" },
            { label: "Receita Total", value: `${revenue} €`, icon: DollarSign, color: "text-emerald-600 bg-emerald-50", href: "/demo/admin/reports" },
            { label: "Concluídos", value: completed, icon: CheckCircle2, color: "text-orange-600 bg-orange-50", href: "/demo/admin/bookings" },
          ].map((stat) => (
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-500" />
                Por Estado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {statusBreakdown.map((s) => {
                const count = DEMO_BOOKINGS.filter((b) => b.status === s.status).length
                if (count === 0) return null
                const pct = (count / totalBookings) * 100
                return (
                  <div key={s.status}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-slate-600">{s.label}</span>
                      <span className="text-xs font-bold text-slate-900">{count}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0f3460] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Marcações Recentes</CardTitle>
              <Link href="/demo/admin/bookings" className="text-sm text-[#0f3460] font-medium hover:underline">
                Ver todas →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {recentBookings.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/demo/admin/bookings/${booking.id}`}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-slate-900">{booking.consultantName}</span>
                        <span className="text-slate-300">→</span>
                        <span className="text-sm text-slate-600">{booking.videographerName}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{booking.propertyAddress}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${DEMO_STATUS_COLORS[booking.status]}`}>
                        {DEMO_STATUS_LABELS[booking.status]}
                      </span>
                      <span className="text-xs text-slate-500">{booking.amount} €</span>
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
