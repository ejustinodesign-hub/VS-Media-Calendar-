import { Card, CardContent } from "@/components/ui/card"
import { DEMO_BOOKINGS, DEMO_STATUS_LABELS, DEMO_STATUS_COLORS, type DemoBookingStatus } from "@/lib/demo-data"
import Link from "next/link"
import { Calendar, Clock, Filter } from "lucide-react"

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function DemoAdminBookingsPage({ searchParams }: Props) {
  const { status } = await searchParams
  const filtered = status
    ? DEMO_BOOKINGS.filter((b) => b.status === status)
    : DEMO_BOOKINGS

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
  )

  const FILTERS = [
    { label: "Todas", value: "" },
    { label: "Aguarda Aceitação", value: "PENDING_ACCEPTANCE" },
    { label: "Aceites", value: "ACCEPTED" },
    { label: "Em Execução", value: "IN_PROGRESS" },
    { label: "Entregues", value: "FILE_DELIVERED" },
    { label: "Concluídas", value: "COMPLETED" },
    { label: "Canceladas", value: "CANCELLED" },
    { label: "Recusadas", value: "REJECTED" },
  ]

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Gestão de Marcações</h2>
          <p className="text-sm text-slate-500">{sorted.length} marcações</p>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-2 items-center">
              <Filter className="w-4 h-4 text-slate-500" />
              {FILTERS.map((f) => (
                <Link
                  key={f.value}
                  href={f.value ? `/demo/admin/bookings?status=${f.value}` : "/demo/admin/bookings"}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    status === f.value || (!status && !f.value)
                      ? "bg-[#0f3460] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bookings */}
        <div className="space-y-2">
          {sorted.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-slate-400">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Sem marcações para este filtro</p>
              </CardContent>
            </Card>
          ) : (
            sorted.map((booking) => {
              const d = new Date(booking.scheduledAt)
              return (
                <Link key={booking.id} href={`/demo/admin/bookings/${booking.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="grid grid-cols-12 items-center gap-3 py-4">
                      <div className="col-span-1 w-12 h-12 rounded-xl bg-slate-100 flex flex-col items-center justify-center">
                        <span className="text-slate-700 text-sm font-bold leading-none">{d.getDate()}</span>
                        <span className="text-slate-500 text-[10px] uppercase">
                          {d.toLocaleDateString("pt-PT", { month: "short" })}
                        </span>
                      </div>

                      <div className="col-span-4">
                        <p className="text-xs text-slate-500">Consultor</p>
                        <p className="text-sm font-semibold text-slate-900">{booking.consultantName}</p>
                        <p className="text-xs text-slate-400 truncate">{booking.consultantEmail}</p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-xs text-slate-500">Videógrafo</p>
                        <p className="text-sm font-semibold text-slate-900">{booking.videographerName}</p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-xs text-slate-500">Hora</p>
                        <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>

                      <div className="col-span-2 text-right">
                        <p className="text-sm font-bold text-slate-900">{booking.amount} €</p>
                      </div>

                      <div className="col-span-1 flex justify-end">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${DEMO_STATUS_COLORS[booking.status]}`}>
                          {DEMO_STATUS_LABELS[booking.status]}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
