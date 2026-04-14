"use client"

import { notFound } from "next/navigation"
import { use, useState } from "react"
import { DEMO_BOOKINGS, DEMO_STATUS_LABELS, DEMO_STATUS_COLORS } from "@/lib/demo-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import {
  ArrowLeft, MapPin, Calendar, Clock, User, FileVideo,
  CheckCircle2, XCircle, Upload,
} from "lucide-react"

export default function DemoVideographerBookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const booking = DEMO_BOOKINGS.find((b) => b.id === id)
  if (!booking) notFound()

  const [accepted, setAccepted] = useState<null | "accepted" | "rejected">(null)
  const [uploadDone, setUploadDone] = useState(false)

  const d = new Date(booking.scheduledAt)
  const endTime = new Date(d.getTime() + 90 * 60 * 1000)
  const isPending = booking.status === "PENDING_ACCEPTANCE" && accepted === null
  const isAccepted = booking.status === "ACCEPTED" || accepted === "accepted"
  const canUpload = (booking.status === "FILE_DELIVERED" || booking.status === "ACCEPTED" || accepted === "accepted") &&
    !booking.hasDeliverables && !uploadDone

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center gap-4 px-6 flex-shrink-0">
        <Link href="/demo/videographer/bookings" className="text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">Detalhe do Pedido</h2>
          <p className="text-sm text-slate-500">#{booking.id}</p>
        </div>
        {accepted ? (
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
            accepted === "accepted" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}>
            {accepted === "accepted" ? "Aceite" : "Recusado"}
          </span>
        ) : (
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${DEMO_STATUS_COLORS[booking.status]}`}>
            {DEMO_STATUS_LABELS[booking.status]}
          </span>
        )}
      </header>

      <div className="flex-1 p-6 space-y-5 max-w-3xl">
        {/* Accept / Reject */}
        {isPending && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-5">
              <p className="font-semibold text-amber-900 mb-1">Este pedido aguarda a sua resposta</p>
              <p className="text-sm text-amber-700 mb-4">
                Confirme se está disponível para este serviço na data indicada.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setAccepted("accepted")}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Aceitar Pedido
                </button>
                <button
                  onClick={() => setAccepted("rejected")}
                  className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-red-100 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Recusar
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {accepted === "accepted" && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-emerald-800">
              Pedido aceite! O consultor foi notificado por email.
            </p>
          </div>
        )}

        {accepted === "rejected" && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-700">
              Pedido recusado. O consultor foi notificado por email.
            </p>
          </div>
        )}

        {/* Upload deliverables */}
        {canUpload && (
          <Card>
            <CardHeader>
              <CardTitle>Entregar Ficheiros</CardTitle>
            </CardHeader>
            <CardContent>
              {uploadDone ? (
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <p className="font-semibold">Ficheiros entregues com sucesso!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                    <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Arrastar ficheiros ou clicar para selecionar</p>
                    <p className="text-xs text-slate-400 mt-1">MP4, MOV, ZIP — máx 2 GB</p>
                  </div>
                  <button
                    onClick={() => setUploadDone(true)}
                    className="w-full bg-[#0f3460] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#1a4a7a] transition-colors"
                  >
                    Simular Entrega (Demo)
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                  {d.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })}
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

        {/* Client */}
        <Card>
          <CardHeader><CardTitle>Consultor</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                <User className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{booking.consultantName}</p>
                <p className="text-xs text-slate-500">{booking.consultantEmail}</p>
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
                  <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full mt-1 inline-block">
                    Deslocação aplicada
                  </span>
                )}
                {booking.notes && (
                  <p className="text-sm text-slate-500 mt-2 italic">"{booking.notes}"</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services — no prices shown to videographer */}
        <Card>
          <CardHeader><CardTitle>Serviços a Realizar</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {booking.services.map((s) => (
              <div key={s} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                <FileVideo className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-700">{s}</span>
              </div>
            ))}
            <p className="text-xs text-slate-400 pt-2">Os valores financeiros não são visíveis ao videógrafo.</p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
