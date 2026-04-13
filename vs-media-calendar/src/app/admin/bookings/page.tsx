import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { BookingStatusBadge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/pricing"
import Link from "next/link"
import { Calendar, Clock, Filter } from "lucide-react"
import type { BookingStatus } from "@prisma/client"

interface Props {
  searchParams: Promise<{ status?: string; videographerId?: string }>
}

export default async function AdminBookingsPage({ searchParams }: Props) {
  const { status, videographerId } = await searchParams

  const where: Record<string, unknown> = {}
  if (status) where.status = status as BookingStatus
  if (videographerId) where.videographerId = videographerId

  const [bookings, videographers] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        consultant: { select: { name: true, email: true } },
        videographer: { select: { name: true } },
        services: true,
        payment: true,
      },
      orderBy: { scheduledAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "VIDEOGRAPHER" },
      select: { id: true, name: true },
    }),
  ])

  return (
    <>
      <Header title="Gestão de Marcações" subtitle={`${bookings.length} marcações`} />
      <div className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-3 items-center">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-600">Filtrar:</span>
              {[
                { label: "Todas", value: "" },
                { label: "Aguarda Aceitação", value: "PENDING_ACCEPTANCE" },
                { label: "Aceites", value: "ACCEPTED" },
                { label: "Recusadas", value: "REJECTED" },
                { label: "Canceladas", value: "CANCELLED" },
                { label: "Entregues", value: "FILE_DELIVERED" },
                { label: "Concluídas", value: "COMPLETED" },
              ].map((f) => (
                <Link
                  key={f.value}
                  href={f.value ? `/admin/bookings?status=${f.value}` : "/admin/bookings"}
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

        {/* Bookings table */}
        <div className="space-y-2">
          {bookings.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-slate-400">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Sem marcações para este filtro</p>
              </CardContent>
            </Card>
          ) : (
            bookings.map((booking) => {
              const scheduledDate = new Date(booking.scheduledAt)
              return (
                <Link key={booking.id} href={`/admin/bookings/${booking.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="grid grid-cols-12 items-center gap-3 py-4">
                      <div className="col-span-1 w-12 h-12 rounded-xl bg-slate-100 flex flex-col items-center justify-center">
                        <span className="text-slate-700 text-sm font-bold leading-none">
                          {scheduledDate.getDate()}
                        </span>
                        <span className="text-slate-500 text-[10px] uppercase">
                          {scheduledDate.toLocaleDateString("pt-PT", { month: "short" })}
                        </span>
                      </div>

                      <div className="col-span-4">
                        <p className="text-xs text-slate-500">Consultor</p>
                        <p className="text-sm font-semibold text-slate-900">{booking.consultant.name}</p>
                        <p className="text-xs text-slate-400 truncate">{booking.consultant.email}</p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-xs text-slate-500">Videógrafo</p>
                        <p className="text-sm font-semibold text-slate-900">{booking.videographer.name}</p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-xs text-slate-500">Hora</p>
                        <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {scheduledDate.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>

                      <div className="col-span-2 text-right">
                        {booking.payment?.amount && (
                          <p className="text-sm font-bold text-slate-900">{formatPrice(booking.payment.amount)}</p>
                        )}
                      </div>

                      <div className="col-span-1 flex justify-end">
                        <BookingStatusBadge status={booking.status} />
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
