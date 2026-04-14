import { notFound } from "next/navigation"
import { DEMO_BOOKINGS, DEMO_STATUS_LABELS, DEMO_STATUS_COLORS } from "@/lib/demo-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeft, MapPin, Calendar, Clock, User, FileVideo, DollarSign, AlertTriangle } from "lucide-react"

interface Props {
  params: Promise<{ id: string }>
}

export default async function DemoAdminBookingDetail({ params }: Props) {
  const { id } = await params
  const booking = DEMO_BOOKINGS.find((b) => b.id === id)
  if (!booking) notFound()

  const d = new Date(booking.scheduledAt)
  const endTime = new Date(d.getTime() + 90 * 60 * 1000)

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center gap-4 px-6 flex-shrink-0">
        <Link href="/demo/admin/bookings" className="text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">Marcação #{booking.id}</h2>
          <p className="text-sm text-slate-500">Detalhe completo (vista administrador)</p>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${DEMO_STATUS_COLORS[booking.status]}`}>
          {DEMO_STATUS_LABELS[booking.status]}
        </span>
      </header>

      <div className="flex-1 p-6 grid lg:grid-cols-3 gap-5 max-w-5xl">
        <div className="lg:col-span-2 space-y-5">
          {/* Date & Time */}
          <Card>
            <CardHeader><CardTitle>Data e Hora</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Data</p>
                  <p className="font-semibold text-slate-900">
                    {d.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Horário</p>
                  <p className="font-semibold text-slate-900">
                    {d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })} –{" "}
                    {endTime.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property */}
          <Card>
            <CardHeader><CardTitle>Propriedade</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{booking.propertyAddress}</p>
                  {booking.hasTravelFee && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full mt-1">
                      <AlertTriangle className="w-3 h-3" />
                      Taxa de deslocação (+50 €)
                    </span>
                  )}
                  {booking.notes && (
                    <p className="text-sm text-slate-500 mt-2 italic">"{booking.notes}"</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* People */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Consultor</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{booking.consultantName}</p>
                    <p className="text-xs text-slate-500">{booking.consultantEmail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Videógrafo</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{booking.videographerName}</p>
                    <p className="text-xs text-slate-500">VS.Media — Interna</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right: Financial + Services */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {booking.services.map((s) => (
                <div key={s} className="flex justify-between text-sm">
                  <span className="text-slate-600">{s}</span>
                </div>
              ))}
              {booking.hasTravelFee && (
                <div className="flex justify-between text-sm border-t border-slate-100 pt-2">
                  <span className="text-amber-700">Taxa Deslocação</span>
                  <span className="font-semibold text-amber-700">+50 €</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
                <span className="text-slate-900">Total Cobrado</span>
                <span className="text-slate-900 text-lg">{booking.amount} €</span>
              </div>
              <div className="mt-2 p-2 bg-emerald-50 rounded-lg">
                <p className="text-xs text-emerald-700 font-medium">Pagamento: Stripe Checkout</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileVideo className="w-4 h-4" /> Serviços</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {booking.services.map((s) => (
                <div key={s} className="flex items-center gap-2 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0f3460]" />
                  <span className="text-sm text-slate-700">{s}</span>
                </div>
              ))}
              {booking.hasDeliverables && (
                <div className="mt-2 p-2 bg-emerald-50 rounded-lg">
                  <p className="text-xs text-emerald-700 font-medium">Ficheiros entregues pelo videógrafo</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
