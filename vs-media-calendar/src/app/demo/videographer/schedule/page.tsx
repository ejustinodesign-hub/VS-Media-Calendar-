import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DEMO_VIDEOGRAPHER_BOOKINGS, DEMO_STATUS_LABELS, DEMO_STATUS_COLORS } from "@/lib/demo-data"
import Link from "next/link"
import { Calendar, Clock, MapPin } from "lucide-react"

export default function DemoVideographerSchedulePage() {
  const activeBookings = DEMO_VIDEOGRAPHER_BOOKINGS.filter(
    (b) => !["CANCELLED", "REJECTED"].includes(b.status)
  ).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

  // Group by month
  const grouped: Record<string, typeof activeBookings> = {}
  activeBookings.forEach((b) => {
    const key = new Date(b.scheduledAt).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(b)
  })

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Agenda</h2>
          <p className="text-sm text-slate-500">{activeBookings.length} serviços agendados</p>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-6">
        {/* Calendar-style month view hint */}
        <Card className="bg-[#0f3460] border-0">
          <CardContent className="py-5 flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-lg">Abril 2026</p>
              <p className="text-slate-300 text-sm mt-0.5">
                {activeBookings.filter((b) => new Date(b.scheduledAt).getMonth() === 3).length} serviços este mês
              </p>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Calendar className="w-5 h-5" />
              <span>Vista de Lista</span>
            </div>
          </CardContent>
        </Card>

        {/* Bookings list grouped by month */}
        {Object.entries(grouped).map(([month, bookings]) => (
          <div key={month}>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 capitalize">{month}</h3>
            <div className="space-y-2">
              {bookings.map((booking) => {
                const d = new Date(booking.scheduledAt)
                const endTime = new Date(d.getTime() + 90 * 60 * 1000)
                const isToday = d.toDateString() === new Date().toDateString()
                return (
                  <Link key={booking.id} href={`/demo/videographer/bookings/${booking.id}`}>
                    <Card className={`hover:shadow-md transition-shadow cursor-pointer ${isToday ? "border-[#0f3460] ring-1 ring-[#0f3460]/20" : ""}`}>
                      <CardContent className="flex items-center gap-4 py-4">
                        <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center border ${
                          isToday ? "bg-[#0f3460] border-[#0f3460]" : "bg-slate-50 border-slate-200"
                        }`}>
                          <span className={`text-lg font-bold leading-none ${isToday ? "text-white" : "text-slate-700"}`}>
                            {d.getDate().toString().padStart(2, "0")}
                          </span>
                          <span className={`text-[10px] uppercase font-medium ${isToday ? "text-slate-300" : "text-slate-400"}`}>
                            {d.toLocaleDateString("pt-PT", { month: "short" })}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-slate-900 text-sm">{booking.consultantName}</p>
                            {isToday && (
                              <span className="text-xs text-[#0f3460] font-bold bg-blue-50 px-2 py-0.5 rounded-full">Hoje</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="w-3 h-3" />
                              {d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })} –{" "}
                              {endTime.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="text-xs text-slate-500 truncate">{booking.propertyAddress.split(",")[0]}</span>
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${DEMO_STATUS_COLORS[booking.status]}`}>
                            {DEMO_STATUS_LABELS[booking.status]}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
