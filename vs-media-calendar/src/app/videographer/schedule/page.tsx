import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingStatusBadge } from "@/components/ui/badge"
import Link from "next/link"
import { Calendar, MapPin, Clock } from "lucide-react"

function getWeekDays(startDate: Date): Date[] {
  const days = []
  const start = new Date(startDate)
  start.setDate(start.getDate() - start.getDay() + 1) // Monday
  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    days.push(day)
  }
  return days
}

export default async function VideographerSchedulePage() {
  const session = await auth()
  const userId = session!.user.id

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + 1)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const bookings = await prisma.booking.findMany({
    where: {
      videographerId: userId,
      scheduledAt: { gte: weekStart, lte: weekEnd },
      status: { not: "CANCELLED" },
    },
    include: { consultant: { select: { name: true } }, services: true },
    orderBy: { scheduledAt: "asc" },
  })

  const weekDays = getWeekDays(now)

  const getBookingsForDay = (day: Date) =>
    bookings.filter((b) => {
      const bd = new Date(b.scheduledAt)
      return (
        bd.getFullYear() === day.getFullYear() &&
        bd.getMonth() === day.getMonth() &&
        bd.getDate() === day.getDate()
      )
    })

  const weeklyAccepted = bookings.filter((b) =>
    ["ACCEPTED", "IN_PROGRESS"].includes(b.status)
  ).length

  const profile = await prisma.videographerProfile.findUnique({
    where: { userId },
    select: { weeklyCapacity: true },
  })

  return (
    <>
      <Header
        title="Agenda Semanal"
        subtitle={`Semana de ${weekStart.toLocaleDateString("pt-PT", { day: "numeric", month: "long" })} a ${weekEnd.toLocaleDateString("pt-PT", { day: "numeric", month: "long" })}`}
      />
      <div className="flex-1 p-6 space-y-4">
        {/* Capacity */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Capacidade desta semana</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {weeklyAccepted} de {profile?.weeklyCapacity || 5} serviços aceites
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0f3460] rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (weeklyAccepted / (profile?.weeklyCapacity || 5)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-bold text-slate-700">
                  {weeklyAccepted}/{profile?.weeklyCapacity || 5}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Week grid */}
        <div className="grid grid-cols-1 gap-3">
          {weekDays.map((day) => {
            const dayBookings = getBookingsForDay(day)
            const isToday = day.toDateString() === now.toDateString()
            const isPast = day < now && !isToday
            const dayName = day.toLocaleDateString("pt-PT", { weekday: "long" })
            const dayDate = day.toLocaleDateString("pt-PT", { day: "numeric", month: "short" })

            return (
              <Card
                key={day.toISOString()}
                className={isToday ? "border-[#0f3460] border-2" : ""}
              >
                <CardHeader className="py-3 px-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center ${
                        isToday
                          ? "bg-[#0f3460] text-white"
                          : isPast
                          ? "bg-slate-100 text-slate-400"
                          : "bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span className="text-sm font-bold leading-none">{day.getDate()}</span>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold capitalize ${isToday ? "text-[#0f3460]" : isPast ? "text-slate-400" : "text-slate-800"}`}>
                        {dayName}
                      </p>
                      <p className="text-xs text-slate-400">{dayDate}</p>
                    </div>
                    {isToday && (
                      <span className="ml-auto text-xs font-bold text-[#0f3460] bg-[#0f3460]/10 px-2 py-0.5 rounded-full">
                        Hoje
                      </span>
                    )}
                  </div>
                </CardHeader>
                {dayBookings.length > 0 && (
                  <CardContent className="pt-0 pb-3 px-5">
                    <div className="space-y-2">
                      {dayBookings.map((booking) => {
                        const t = new Date(booking.scheduledAt)
                        const endT = new Date(t)
                        endT.setMinutes(endT.getMinutes() + 90)
                        return (
                          <Link
                            key={booking.id}
                            href={`/videographer/bookings/${booking.id}`}
                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
                          >
                            <div className="text-center flex-shrink-0">
                              <p className="text-xs font-bold text-slate-700">
                                {t.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {endT.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {booking.consultant.name}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {booking.services.map((s) => s.serviceType).join(", ")}
                              </p>
                            </div>
                            <BookingStatusBadge status={booking.status} />
                          </Link>
                        )
                      })}
                    </div>
                  </CardContent>
                )}
                {dayBookings.length === 0 && (
                  <CardContent className="pt-0 pb-3 px-5">
                    <p className="text-xs text-slate-300 italic">Sem serviços</p>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </>
  )
}
