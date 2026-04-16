import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import type { BookingStatus } from "@prisma/client"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingStatusBadge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/pricing"
import Link from "next/link"
import {
  Calendar, Clock, CheckCircle2, XCircle, FileVideo,
  TrendingUp, Wallet, Camera, Car, Video, Star,
} from "lucide-react"

// Videographer earnings model
const BASE_SALARY = 1200
const VIDEO_RATE = 10      // per video service
const INTRO_RATE = 10      // per additional intro
// Photography: full service price goes to videographer
const PHOTO_RATES: Record<string, number> = {
  PHOTO_DRONE: 35,
  PHOTO_T1_T2: 25,
  PHOTO_T3_T4: 35,
  PHOTO_T5_PLUS: 45,
}

function calcBookingEarnings(booking: {
  services: { serviceType: string; price: number }[]
  additionalIntros: number
  hasTravelFee: boolean
  travelFeeAmount: number
}) {
  const videoEarnings = booking.services.filter((s) =>
    s.serviceType === "VIDEO_STANDARD" || s.serviceType === "VIDEO_DRONE"
  ).length * VIDEO_RATE

  const introEarnings = booking.additionalIntros * INTRO_RATE

  const photoEarnings = booking.services
    .filter((s) => s.serviceType.startsWith("PHOTO_"))
    .reduce((sum, s) => sum + (PHOTO_RATES[s.serviceType] ?? s.price), 0)

  const travelEarnings = booking.hasTravelFee ? booking.travelFeeAmount : 0

  return { videoEarnings, introEarnings, photoEarnings, travelEarnings }
}

export default async function VideographerDashboard() {
  const session = await auth()
  const userId = session!.user.id

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

  const COUNTED_STATUSES: BookingStatus[] = ["ACCEPTED", "IN_PROGRESS", "FILE_DELIVERED", "COMPLETED"]

  let pendingBookings: any[] = []
  let upcomingBookings: any[] = []
  let stats: any[] = []
  let monthBookings: any[] = []
  let prevMonthBookings: any[] = []
  let dbError: string | null = null

  try {
    ;[pendingBookings, upcomingBookings, stats, monthBookings, prevMonthBookings] =
      await Promise.all([
        prisma.booking.findMany({
          where: { videographerId: userId, status: "PENDING_ACCEPTANCE" },
          include: { consultant: { select: { name: true, email: true } }, services: true },
          orderBy: { scheduledAt: "asc" },
        }),
        prisma.booking.findMany({
          where: {
            videographerId: userId,
            status: { in: ["ACCEPTED", "IN_PROGRESS", "FILE_DELIVERED"] },
            scheduledAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
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
        prisma.booking.findMany({
          where: {
            videographerId: userId,
            scheduledAt: { gte: monthStart, lte: monthEnd },
            status: { in: COUNTED_STATUSES },
          },
          include: { services: true },
        }),
        prisma.booking.findMany({
          where: {
            videographerId: userId,
            scheduledAt: { gte: prevMonthStart, lte: prevMonthEnd },
            status: { in: COUNTED_STATUSES },
          },
          include: { services: true },
        }),
      ])
  } catch (err) {
    console.error("Videographer dashboard DB error:", err)
    dbError = err instanceof Error ? err.message : String(err)
  }

  const statusCount = (status: string) =>
    stats.find((s) => s.status === status)?._count.id || 0

  // Aggregate earnings for a list of bookings
  function aggregateEarnings(bookings: typeof monthBookings) {
    let videoTotal = 0, introTotal = 0, photoTotal = 0, travelTotal = 0
    for (const b of bookings) {
      const e = calcBookingEarnings(b)
      videoTotal += e.videoEarnings
      introTotal += e.introEarnings
      photoTotal += e.photoEarnings
      travelTotal += e.travelEarnings
    }
    return { videoTotal, introTotal, photoTotal, travelTotal }
  }

  const curr = aggregateEarnings(monthBookings)
  const currVariable = curr.videoTotal + curr.introTotal + curr.photoTotal + curr.travelTotal
  const currTotal = BASE_SALARY + currVariable

  const prev = aggregateEarnings(prevMonthBookings)
  const prevVariable = prev.videoTotal + prev.introTotal + prev.photoTotal + prev.travelTotal
  const prevTotal = BASE_SALARY + prevVariable

  const diffPct = prevTotal > 0
    ? Math.round(((currTotal - prevTotal) / prevTotal) * 100)
    : 0

  const monthLabel = now.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })

  return (
    <>
      <Header
        title={`Olá, ${session?.user?.name?.split(" ")[0] || "!"} 👋`}
        subtitle="Área do Videógrafo"
      />
      <div className="flex-1 p-6 space-y-6">

        {dbError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            <p className="font-semibold mb-1">Erro ao carregar dados</p>
            <p className="font-mono text-xs break-all">{dbError}</p>
          </div>
        )}

        {/* Earnings card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-[#0f172a] to-[#1e3a5f] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-400 text-sm font-medium capitalize">{monthLabel}</p>
                <p className="text-white text-3xl font-bold mt-1">{formatPrice(currTotal)}</p>
                <p className="text-slate-400 text-xs mt-1">estimativa acumulada</p>
              </div>
              <div className="text-right">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-2 ml-auto">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                {diffPct !== 0 && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    diffPct >= 0
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-red-500/20 text-red-300"
                  }`}>
                    {diffPct >= 0 ? "+" : ""}{diffPct}% vs mês ant.
                  </span>
                )}
              </div>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Star, label: "Salário base", value: BASE_SALARY, color: "bg-blue-500/20 text-blue-300" },
                { icon: Video, label: `Vídeos (×${monthBookings.flatMap(b => b.services).filter((s: any) => s.serviceType === "VIDEO_STANDARD" || s.serviceType === "VIDEO_DRONE").length})`, value: curr.videoTotal, color: "bg-purple-500/20 text-purple-300" },
                { icon: Camera, label: "Fotografia", value: curr.photoTotal, color: "bg-pink-500/20 text-pink-300" },
                { icon: Car, label: "Deslocação", value: curr.travelTotal, color: "bg-amber-500/20 text-amber-300" },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl p-3 ${item.color.split(" ")[0]}`}>
                  <item.icon className={`w-4 h-4 mb-1 ${item.color.split(" ")[1]}`} />
                  <p className={`text-lg font-bold ${item.color.split(" ")[1]}`}>{formatPrice(item.value)}</p>
                  <p className="text-white/50 text-[10px] leading-tight mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Renova a 1 de cada mês · {monthBookings.length} serviço(s) contabilizados
            </p>
            {curr.introTotal > 0 && (
              <p className="text-xs text-slate-500">+ {formatPrice(curr.introTotal)} em intros</p>
            )}
          </div>
        </Card>

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
                              · {booking.services.length} serviço(s)
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
