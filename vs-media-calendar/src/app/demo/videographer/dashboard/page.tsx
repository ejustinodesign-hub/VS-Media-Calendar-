import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DEMO_VIDEOGRAPHER_BOOKINGS, DEMO_STATUS_LABELS, DEMO_STATUS_COLORS } from "@/lib/demo-data"
import Link from "next/link"
import { Calendar, Clock, CheckCircle2, XCircle, FileVideo } from "lucide-react"

export default function DemoVideographerDashboard() {
  const bookings = DEMO_VIDEOGRAPHER_BOOKINGS

  const pending = bookings.filter((b) => b.status === "PENDING_ACCEPTANCE")
  const upcoming = bookings.filter(
    (b) => b.status === "ACCEPTED" && new Date(b.scheduledAt) > new Date()
  )
  const completed = bookings.filter((b) => b.status === "COMPLETED")
  const rejected = bookings.filter((b) => b.status === "REJECTED")

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Olá, Eduardo 👋</h2>
          <p className="text-sm text-slate-500">Área do Videógrafo</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold">
            EJ
          </div>
          <span className="text-sm font-medium text-slate-700 hidden sm:block">Eduardo</span>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Pendentes", value: pending.length, color: "text-amber-600 bg-amber-50", icon: Clock },
            { label: "Aceites", value: upcoming.length, color: "text-blue-600 bg-blue-50", icon: CheckCircle2 },
            { label: "Concluídos", value: completed.length, color: "text-emerald-600 bg-emerald-50", icon: FileVideo },
            { label: "Recusados", value: rejected.length, color: "text-red-600 bg-red-50", icon: XCircle },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 py-5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pending requests */}
        {pending.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                Pedidos Pendentes ({pending.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pending.map((booking) => {
                const d = new Date(booking.scheduledAt)
                return (
                  <Link
                    key={booking.id}
                    href={`/demo/videographer/bookings/${booking.id}`}
                    className="block border-b border-slate-100 last:border-0"
                  >
                    <div className="px-6 py-4 hover:bg-amber-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex flex-col items-center justify-center">
                            <span className="text-amber-700 text-sm font-bold leading-none">
                              {d.getDate().toString().padStart(2, "0")}
                            </span>
                            <span className="text-amber-600 text-[10px] uppercase">
                              {d.toLocaleDateString("pt-PT", { month: "short" })}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{booking.consultantName}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })} · 1h30 ·{" "}
                              {booking.services.length} serviço(s)
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-1 rounded-full whitespace-nowrap">
                          Aceitar / Recusar →
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Upcoming */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Próximos Serviços</CardTitle>
            <Link href="/demo/videographer/schedule" className="text-sm text-[#0f3460] font-medium hover:underline">
              Ver agenda →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {upcoming.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sem serviços agendados</p>
              </div>
            ) : (
              upcoming.map((booking) => {
                const d = new Date(booking.scheduledAt)
                return (
                  <Link
                    key={booking.id}
                    href={`/demo/videographer/bookings/${booking.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm">{booking.consultantName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">
                          {d.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short" })} às{" "}
                          {d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${DEMO_STATUS_COLORS[booking.status]}`}>
                      {DEMO_STATUS_LABELS[booking.status]}
                    </span>
                  </Link>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
