import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { BookingStatusBadge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/pricing"
import Link from "next/link"
import { Calendar, Clock, CreditCard, Download } from "lucide-react"
import { PayButton } from "./[id]/pay-button"

export default async function ConsultantBookingsPage() {
  const session = await auth()
  const bookings = await prisma.booking.findMany({
    where: { consultantId: session!.user.id },
    include: {
      videographer: { select: { name: true, image: true } },
      services: true,
      payment: true,
      deliverables: { select: { id: true } },
    },
    orderBy: { scheduledAt: "desc" },
  })

  return (
    <>
      <Header title="As Minhas Marcações" subtitle={`${bookings.length} marcações no total`} />
      <div className="flex-1 p-6">
        {bookings.length === 0 ? (
          <Card>
            <CardContent className="py-20 text-center">
              <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700">Sem marcações</h3>
              <p className="text-slate-400 text-sm mt-1">
                Ainda não tem nenhuma marcação. Crie a sua primeira marcação.
              </p>
              <Link
                href="/consultant/bookings/new"
                className="inline-block mt-4 bg-[#0f3460] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1a4a7a] transition-colors"
              >
                Nova Marcação
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => {
              const total = booking.payment?.amount || 0
              const scheduledDate = new Date(booking.scheduledAt)
              const hasDeliverables = booking.deliverables.length > 0

              return (
                <div key={booking.id}>
                  {booking.status === "PENDING_PAYMENT" && (
                    <Card className="border-amber-200 bg-amber-50/50 mb-1">
                      <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-amber-700 text-sm">
                          <CreditCard className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium">Pagamento pendente</span>
                          <span className="text-amber-600 text-xs truncate hidden sm:block">— {booking.propertyAddress}</span>
                        </div>
                        <div className="flex-shrink-0 w-40">
                          <PayButton bookingId={booking.id} />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                <Link href={`/consultant/bookings/${booking.id}`}>
                  <Card className={`hover:shadow-md transition-shadow cursor-pointer ${booking.status === "FILE_DELIVERED" ? "border-emerald-300 bg-emerald-50/40" : ""}`}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className={`flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center ${booking.status === "FILE_DELIVERED" ? "bg-emerald-100 border border-emerald-200" : "bg-[#0f3460]/5 border border-[#0f3460]/10"}`}>
                        {booking.status === "FILE_DELIVERED" ? (
                          <Download className="w-6 h-6 text-emerald-600" />
                        ) : (
                          <>
                            <span className="text-[#0f3460] text-lg font-bold leading-none">
                              {scheduledDate.getDate().toString().padStart(2, "0")}
                            </span>
                            <span className="text-[#0f3460] text-xs uppercase font-medium">
                              {scheduledDate.toLocaleDateString("pt-PT", { month: "short" })}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <BookingStatusBadge status={booking.status} />
                        </div>
                        <p className="font-semibold text-slate-900 truncate">
                          {booking.propertyAddress}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            {scheduledDate.toLocaleTimeString("pt-PT", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-slate-500">
                            {booking.videographer.name}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-slate-500">
                            {booking.services.map((s) => s.serviceType).join(", ")}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        {total > 0 && (
                          <p className="font-bold text-slate-900">{formatPrice(total)}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-0.5">1h30</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
