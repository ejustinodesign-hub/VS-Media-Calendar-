import { notFound } from "next/navigation"
import { DEMO_BOOKINGS, DEMO_STATUS_LABELS, DEMO_STATUS_COLORS } from "@/lib/demo-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import {
  ArrowLeft, MapPin, Calendar, Clock, User, FileVideo,
  CheckCircle2, Download, AlertTriangle,
} from "lucide-react"

interface Props {
  params: Promise<{ id: string }>
}

export default async function DemoConsultantBookingDetail({ params }: Props) {
  const { id } = await params
  const booking = DEMO_BOOKINGS.find((b) => b.id === id)
  if (!booking) notFound()

  const d = new Date(booking.scheduledAt)
  const endTime = new Date(d.getTime() + 90 * 60 * 1000)

  const canCancel = !["CANCELLED", "REJECTED", "COMPLETED", "FILE_DELIVERED"].includes(booking.status)

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center gap-4 px-6 flex-shrink-0">
        <Link href="/demo/consultant/bookings" className="text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">Detalhe da Marcação</h2>
          <p className="text-sm text-slate-500">#{booking.id}</p>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${DEMO_STATUS_COLORS[booking.status]}`}>
          {DEMO_STATUS_LABELS[booking.status]}
        </span>
      </header>

      <div className="flex-1 p-6 space-y-5 max-w-3xl">
        {/* Deliverable available */}
        {booking.hasDeliverables && (
          <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">Ficheiro disponível para download</p>
              <p className="text-xs text-emerald-600 mt-0.5">O videógrafo entregou os ficheiros deste serviço.</p>
            </div>
            <button className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors">
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        )}

        {/* Date & Time */}
        <Card>
          <CardHeader>
            <CardTitle>Data e Hora</CardTitle>
          </CardHeader>
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
                  {endTime.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })} (1h30)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Property */}
        <Card>
          <CardHeader>
            <CardTitle>Propriedade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{booking.propertyAddress}</p>
                {booking.hasTravelFee && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full mt-1">
                    <AlertTriangle className="w-3 h-3" />
                    Taxa de deslocação aplicada (+50 €)
                  </span>
                )}
                {booking.notes && (
                  <p className="text-sm text-slate-500 mt-2 italic">"{booking.notes}"</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Videographer */}
        <Card>
          <CardHeader>
            <CardTitle>Videógrafo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                <User className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{booking.videographerName}</p>
                <p className="text-xs text-slate-500">VS.Media — Equipa Interna</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services & pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Serviços e Valor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {booking.services.map((s) => (
              <div key={s} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2">
                  <FileVideo className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-700">{s}</span>
                </div>
              </div>
            ))}
            {booking.hasTravelFee && (
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-sm text-amber-700">Taxa de Deslocação</span>
                <span className="text-sm font-semibold text-amber-700">+50 €</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-3">
              <span className="font-bold text-slate-900">Total</span>
              <span className="text-xl font-bold text-slate-900">{booking.amount} €</span>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        {canCancel && (
          <div className="flex justify-end">
            <button className="px-5 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
              Cancelar Marcação
            </button>
          </div>
        )}
      </div>
    </>
  )
}
