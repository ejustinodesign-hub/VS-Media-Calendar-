import { Card, CardContent } from "@/components/ui/card"
import { DEMO_CONSULTANT_BOOKINGS, DEMO_STATUS_LABELS, DEMO_STATUS_COLORS } from "@/lib/demo-data"
import Link from "next/link"
import { Calendar, Clock } from "lucide-react"

export default function DemoConsultantBookingsPage() {
  const bookings = DEMO_CONSULTANT_BOOKINGS

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">As Minhas Marcações</h2>
          <p className="text-sm text-slate-500">{bookings.length} marcações no total</p>
        </div>
        <Link
          href="/demo/consultant/bookings/new"
          className="bg-[#0f3460] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a4a7a] transition-colors"
        >
          + Nova Marcação
        </Link>
      </header>

      <div className="flex-1 p-6">
        <div className="space-y-3">
          {bookings.map((booking) => {
            const d = new Date(booking.scheduledAt)
            return (
              <Link key={booking.id} href={`/demo/consultant/bookings/${booking.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-[#0f3460]/5 border border-[#0f3460]/10 flex flex-col items-center justify-center">
                      <span className="text-[#0f3460] text-lg font-bold leading-none">
                        {d.getDate().toString().padStart(2, "0")}
                      </span>
                      <span className="text-[#0f3460] text-xs uppercase font-medium">
                        {d.toLocaleDateString("pt-PT", { month: "short" })}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${DEMO_STATUS_COLORS[booking.status]}`}>
                          {DEMO_STATUS_LABELS[booking.status]}
                        </span>
                        {booking.hasDeliverables && (
                          <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                            Ficheiro disponível
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-900 truncate">{booking.propertyAddress}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          {d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500">{booking.videographerName}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500">{booking.services.join(", ")}</span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-slate-900">{booking.amount} €</p>
                      <p className="text-xs text-slate-400 mt-0.5">1h30</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
