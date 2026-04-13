import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingStatusBadge } from "@/components/ui/badge"
import Link from "next/link"
import { Calendar, Clock, CheckCircle2, XCircle, FileVideo, MapPin } from "lucide-react"

export default async function VideographerDashboard() {
  const session = await auth()
  const userId = session!.user.id

  const [pendingBookings, upcomingBookings, stats] = await Promise.all([
    prisma.booking.findMany({
      where: { videographerId: userId, status: "PENDING_ACCEPTANCE" },
      include: { consultant: { select: { name: true, email: true } }, services: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        videographerId: userId,
        status: "ACCEPTED",
        scheduledAt: { gte: new Date() },
      },
      include: { consultant: { select: { name: true } }, services: true },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    prisma.booking.groupBy({
      by: ["status"],
      where: { videographerId: userId },
      _count: { id: true },
    }),
  ])

  const statusCount = (status: string) =>
    stats.find((s) => s.status === status)?._count.id || 0

  return (
    <>
      <Header
        title={`Olá, ${session?.user?.name?.split(" ")[0]} 👋`}
        subtitle="Área do Videógrafo"
      />
      <div className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Pendentes", value: statusCount("PENDING_ACCEPTANCE"), color: "text-amber-600 bg-amber-50", icon: Clock },
            { label: "Aceites", value: statusCount("ACCEPTED"), color: "text-blue-600 bg-blue-50", icon: CheckCircle2 },
            { label: "Concluídos", value: statusCount("COMPLETED"), color: "text-emerald-600 bg-emerald-50", icon: FileVideo },
            { label: "Recusados", value: statusCount("REJECTED"), color: "text-red-600 bg-red-50", icon: XCircle },
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
        {pendingBookings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                Pedidos Pendentes ({pendingBookings.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pendingBookings.map((booking) => {
                const scheduledDate = new Date(booking.scheduledAt)
                return (
                  <Link
                    key={booking.id}
                    href={`/videographer/bookings/${booking.id}`}
                    className="block border-b border-slate-100 last:border-0"
                  >
                    <div className="px-6 py-4 hover:bg-amber-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex flex-col items-center justify-center">
                            <span className="text-amber-700 text-sm font-bold leading-none">
                              {scheduledDate.getDate().toString().padStart(2, "0")}
                            </span>
                            <span className="text-amber-600 text-[10px] uppercase">
                              {scheduledDate.toLocaleDateString("pt-PT", { month: "short" })}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">
                              {booking.consultant.name}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {scheduledDate.toLocaleTimeString("pt-PT", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              · 1h30 ·{" "}
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
            <Link href="/videographer/schedule" className="text-sm text-[#0f3460] font-medium hover:underline">
              Ver agenda →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingBookings.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sem serviços agendados</p>
              </div>
            ) : (
              upcomingBookings.map((booking) => {
                const scheduledDate = new Date(booking.scheduledAt)
                return (
                  <Link
                    key={booking.id}
                    href={`/videographer/bookings/${booking.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm">
                        {booking.consultant.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">
                          {scheduledDate.toLocaleDateString("pt-PT", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          às{" "}
                          {scheduledDate.toLocaleTimeString("pt-PT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <BookingStatusBadge status={booking.status} />
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
