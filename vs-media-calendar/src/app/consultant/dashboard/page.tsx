import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingStatusBadge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"
import { formatPrice as fp } from "@/lib/pricing"
import Link from "next/link"
import { CalendarPlus, Calendar, Clock, CheckCircle2, AlertCircle, FileVideo } from "lucide-react"

export default async function ConsultantDashboard() {
  const session = await auth()
  const userId = session!.user.id

  let bookings: any[] = []
  let stats: any[] = []
  let totalPaid = { _sum: { amount: null as number | null } }
  let dbError: string | null = null

  try {
    ;[bookings, stats] = await Promise.all([
      prisma.booking.findMany({
        where: { consultantId: userId },
        include: {
          videographer: { select: { name: true, image: true } },
          services: true,
          payment: true,
        },
        orderBy: { scheduledAt: "desc" },
        take: 5,
      }),
      prisma.booking.groupBy({
        by: ["status"],
        where: { consultantId: userId },
        _count: { id: true },
      }),
    ])
    totalPaid = await prisma.payment.aggregate({
      where: { booking: { consultantId: userId }, status: "paid" },
      _sum: { amount: true },
    })
  } catch (err) {
    console.error("Dashboard DB error:", err)
    dbError = err instanceof Error ? err.message : String(err)
  }

  const statusCount = (status: string) =>
    stats.find((s) => s.status === status)?._count.id || 0

  const upcoming = bookings.filter(
    (b) =>
      new Date(b.scheduledAt) > new Date() &&
      !["CANCELLED", "REJECTED"].includes(b.status)
  )

  return (
    <>
      <Header
        title={`Bom dia, ${session?.user?.name?.split(" ")[0] || "!"} 👋`}
        subtitle="Aqui está o resumo das suas marcações"
      />
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
            href="/consultant/bookings/new"
            className="flex items-center gap-2 bg-[#e94560] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#d63050] transition-colors shadow-lg shadow-[#e94560]/30"
          >
            <CalendarPlus className="w-4 h-4" />
            Nova Marcação
          </Link>
        </div>

        {/* DB error banner */}
        {dbError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            <p className="font-semibold mb-1">Erro ao carregar dados</p>
            <p className="font-mono text-xs break-all">{dbError}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total de Marcações",
              value: stats.reduce((sum, s) => sum + s._count.id, 0),
              icon: Calendar,
              color: "text-blue-600 bg-blue-50",
            },
            {
              label: "Próximas",
              value: upcoming.length,
              icon: Clock,
              color: "text-purple-600 bg-purple-50",
            },
            {
              label: "Concluídas",
              value: statusCount("COMPLETED"),
              icon: CheckCircle2,
              color: "text-emerald-600 bg-emerald-50",
            },
            {
              label: "Total Investido",
              value: fp(totalPaid._sum.amount || 0),
              icon: FileVideo,
              color: "text-orange-600 bg-orange-50",
              isText: true,
            },
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
            <Link
              href="/consultant/bookings"
              className="text-sm text-[#0f3460] font-medium hover:underline"
            >
              Ver todas →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {bookings.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Sem marcações ainda</p>
                <p className="text-sm mt-1">Crie a sua primeira marcação</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {bookings.map((booking) => {
                  const total =
                    (booking.payment?.amount || 0)
                  return (
                    <Link
                      key={booking.id}
                      href={`/consultant/bookings/${booking.id}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-100 flex flex-col items-center justify-center text-slate-600">
                        <span className="text-xs font-bold leading-none">
                          {new Date(booking.scheduledAt).toLocaleDateString("pt-PT", { day: "2-digit" })}
                        </span>
                        <span className="text-[10px] uppercase">
                          {new Date(booking.scheduledAt).toLocaleDateString("pt-PT", { month: "short" })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">
                          {booking.propertyAddress}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {booking.videographer.name} ·{" "}
                          {new Date(booking.scheduledAt).toLocaleTimeString("pt-PT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        <BookingStatusBadge status={booking.status} />
                        {total > 0 && (
                          <span className="text-xs text-slate-500">{fp(total)}</span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
