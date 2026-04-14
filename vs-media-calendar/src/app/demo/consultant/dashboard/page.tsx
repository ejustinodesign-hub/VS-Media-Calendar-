import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DEMO_CONSULTANT_BOOKINGS, DEMO_STATUS_LABELS, DEMO_STATUS_COLORS } from "@/lib/demo-data"
import Link from "next/link"
import { CalendarPlus, Calendar, Clock, CheckCircle2, FileVideo } from "lucide-react"

export default function DemoConsultantDashboard() {
  const bookings = DEMO_CONSULTANT_BOOKINGS
  const upcoming = bookings.filter(
    (b) =>
      new Date(b.scheduledAt) > new Date() &&
      !["CANCELLED", "REJECTED"].includes(b.status)
  )
  const completed = bookings.filter((b) => b.status === "COMPLETED")
  const totalPaid = bookings
    .filter((b) => !["PENDING_PAYMENT", "CANCELLED"].includes(b.status))
    .reduce((sum, b) => sum + b.amount, 0)

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Bom dia, Ana 👋</h2>
          <p className="text-sm text-slate-500">Aqui está o resumo das suas marcações</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0f3460] flex items-center justify-center text-white text-xs font-bold">
            AS
          </div>
          <span className="text-sm font-medium text-slate-700 hidden sm:block">Ana</span>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-6">
        {/* Quick Action */}
        <div className="bg-gradient-to-r from-[#0f3460] to-[#1a4a7a] rounded-xl p-6 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-lg">Agendar novo serviço</h3>
            <p className="text-slate-300 text-sm mt-1">
              Vídeo, fotografia ou ambos — escolha o videógrafo e a data
            </p>
          </div>
          <Link
            href="/demo/consultant/bookings/new"
            className="flex items-center gap-2 bg-[#e94560] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#d63050] transition-colors shadow-lg shadow-[#e94560]/30"
          >
            <CalendarPlus className="w-4 h-4" />
            Nova Marcação
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total de Marcações", value: bookings.length, icon: Calendar, color: "text-blue-600 bg-blue-50" },
            { label: "Próximas", value: upcoming.length, icon: Clock, color: "text-purple-600 bg-purple-50" },
            { label: "Concluídas", value: completed.length, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
            { label: "Total Investido", value: `${totalPaid} €`, icon: FileVideo, color: "text-orange-600 bg-orange-50" },
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

        {/* Recent bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Marcações Recentes</CardTitle>
            <Link href="/demo/consultant/bookings" className="text-sm text-[#0f3460] font-medium hover:underline">
              Ver todas →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {bookings.slice(0, 5).map((booking) => {
                const d = new Date(booking.scheduledAt)
                return (
                  <Link
                    key={booking.id}
                    href={`/demo/consultant/bookings/${booking.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-100 flex flex-col items-center justify-center text-slate-600">
                      <span className="text-xs font-bold leading-none">
                        {d.getDate().toString().padStart(2, "0")}
                      </span>
                      <span className="text-[10px] uppercase">
                        {d.toLocaleDateString("pt-PT", { month: "short" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{booking.propertyAddress}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {booking.videographerName} ·{" "}
                        {d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${DEMO_STATUS_COLORS[booking.status]}`}>
                        {DEMO_STATUS_LABELS[booking.status]}
                      </span>
                      <span className="text-xs text-slate-500">{booking.amount} €</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
