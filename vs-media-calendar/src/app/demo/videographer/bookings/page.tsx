import { Card, CardContent } from "@/components/ui/card"
import { DEMO_VIDEOGRAPHER_BOOKINGS, DEMO_STATUS_LABELS, DEMO_STATUS_COLORS } from "@/lib/demo-data"
import Link from "next/link"
import { Clock, MapPin } from "lucide-react"

export default function DemoVideographerBookingsPage() {
  const bookings = DEMO_VIDEOGRAPHER_BOOKINGS

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Os Meus Pedidos</h2>
          <p className="text-sm text-slate-500">{bookings.length} pedidos no total</p>
        </div>
      </header>

      <div className="flex-1 p-6">
        <div className="space-y-3">
          {bookings.map((booking) => {
            const d = new Date(booking.scheduledAt)
            const isPending = booking.status === "PENDING_ACCEPTANCE"
            return (
              <Link key={booking.id} href={`/demo/videographer/bookings/${booking.id}`}>
                <Card className={`hover:shadow-md transition-shadow cursor-pointer ${isPending ? "border-amber-200 bg-amber-50/30" : ""}`}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className={`flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center border ${
                      isPending ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
                    }`}>
                      <span className={`text-lg font-bold leading-none ${isPending ? "text-amber-700" : "text-slate-700"}`}>
                        {d.getDate().toString().padStart(2, "0")}
                      </span>
                      <span className={`text-xs uppercase font-medium ${isPending ? "text-amber-600" : "text-slate-500"}`}>
                        {d.toLocaleDateString("pt-PT", { month: "short" })}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${DEMO_STATUS_COLORS[booking.status]}`}>
                          {DEMO_STATUS_LABELS[booking.status]}
                        </span>
                        {isPending && (
                          <span className="text-xs text-amber-600 font-semibold animate-pulse">Ação necessária</span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-900 text-sm">{booking.consultantName}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          {d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })} · 1h30
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="w-3 h-3" />
                          {booking.propertyAddress.split(",")[0]}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-400">{booking.services.join(", ")}</p>
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
