import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { BookingStatusBadge } from "@/components/ui/badge"
import Link from "next/link"
import { Calendar, Clock } from "lucide-react"

export default async function VideographerBookingsPage() {
  const session = await auth()
  const bookings = await prisma.booking.findMany({
    where: { videographerId: session!.user.id },
    include: {
      consultant: { select: { name: true, email: true, image: true } },
      services: { select: { serviceType: true } },
    },
    orderBy: { scheduledAt: "desc" },
  })

  return (
    <>
      <Header title="Pedidos de Serviço" subtitle={`${bookings.length} no total`} />
      <div className="flex-1 p-6">
        {bookings.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sem pedidos ainda</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => {
              const scheduledDate = new Date(booking.scheduledAt)
              return (
                <Link key={booking.id} href={`/videographer/bookings/${booking.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-slate-100 flex flex-col items-center justify-center">
                        <span className="text-slate-700 text-base font-bold leading-none">
                          {scheduledDate.getDate().toString().padStart(2, "0")}
                        </span>
                        <span className="text-slate-500 text-[10px] uppercase font-medium">
                          {scheduledDate.toLocaleDateString("pt-PT", { month: "short" })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <BookingStatusBadge status={booking.status} />
                        </div>
                        <p className="font-semibold text-slate-900 text-sm truncate">
                          {booking.consultant.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500">
                            {scheduledDate.toLocaleTimeString("pt-PT", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            · 1h30
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 flex-shrink-0">
                        {booking.services.length} serv.
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
