import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingStatusBadge } from "@/components/ui/badge"
import { formatPrice, IVA_RATE, SERVICE_LABELS } from "@/lib/pricing"
import { formatDateTime } from "@/lib/utils"
import Link from "next/link"
import {
  User, Calendar, MapPin, Clock,
  Download, FileVideo, ArrowLeft,
} from "lucide-react"
import { TravelFeeToggle } from "./travel-fee-toggle"

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminBookingDetailPage({ params }: Props) {
  const { id } = await params

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      consultant:   { select: { name: true, email: true, image: true } },
      videographer: { select: { name: true, email: true, image: true } },
      services:     true,
      payment:      true,
      deliverables: true,
    },
  })

  if (!booking) notFound()

  const scheduledDate = new Date(booking.scheduledAt)
  const net = booking.services.reduce((s, svc) => s + svc.price, 0)
    + (booking.hasTravelFee ? booking.travelFeeAmount : 0)
    + booking.additionalIntros * 25
  const iva   = Math.round(net * IVA_RATE * 100) / 100
  const gross = Math.round(net * (1 + IVA_RATE) * 100) / 100

  return (
    <>
      <Header
        title="Detalhe da Marcação"
        subtitle={`#${booking.id.slice(0, 8).toUpperCase()}`}
        action={
          <Link
            href="/admin/bookings"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        }
      />
      <div className="flex-1 p-6 max-w-3xl space-y-4">

        {/* Status */}
        <Card>
          <CardContent className="flex items-center justify-between py-5">
            <div>
              <p className="text-xs text-slate-500 mb-1">Estado</p>
              <BookingStatusBadge status={booking.status} />
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Criada em</p>
              <p className="text-sm font-medium text-slate-700">{formatDateTime(booking.createdAt)}</p>
            </div>
          </CardContent>
        </Card>

        {/* People */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              {booking.consultant.image
                ? <img src={booking.consultant.image} className="w-10 h-10 rounded-full border border-slate-200" alt="" />
                : <div className="w-10 h-10 rounded-full bg-[#0f3460] flex items-center justify-center text-white text-sm font-bold">{booking.consultant.name?.[0] || "C"}</div>
              }
              <div>
                <p className="text-xs text-slate-500">Consultor</p>
                <p className="text-sm font-semibold text-slate-900">{booking.consultant.name || "—"}</p>
                <p className="text-xs text-slate-400">{booking.consultant.email}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              {booking.videographer.image
                ? <img src={booking.videographer.image} className="w-10 h-10 rounded-full border border-slate-200" alt="" />
                : <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white text-sm font-bold">{booking.videographer.name?.[0] || "V"}</div>
              }
              <div>
                <p className="text-xs text-slate-500">Videógrafo</p>
                <p className="text-sm font-semibold text-slate-900">{booking.videographer.name || "—"}</p>
                <p className="text-xs text-slate-400">{booking.videographer.email}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Booking details */}
        <Card>
          <CardHeader><CardTitle>Informações do Serviço</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <DetailRow icon={<Calendar className="w-4 h-4" />} label="Data e Hora"
              value={scheduledDate.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              sub={scheduledDate.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
            />
            <DetailRow icon={<Clock className="w-4 h-4" />} label="Duração" value="1 hora e 30 minutos" />
            <DetailRow icon={<MapPin className="w-4 h-4" />} label="Morada" value={booking.propertyAddress} />
            {booking.notes && (
              <DetailRow icon={<User className="w-4 h-4" />} label="Notas" value={booking.notes} />
            )}
          </CardContent>
        </Card>

        {/* Services & pricing */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Serviços e Valor</CardTitle>
            <TravelFeeToggle bookingId={booking.id} hasTravelFee={booking.hasTravelFee} />
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              {booking.services.map((s) => (
                <div key={s.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">{SERVICE_LABELS[s.serviceType as keyof typeof SERVICE_LABELS]}</span>
                  <span className="font-medium text-slate-900">{formatPrice(s.price)}</span>
                </div>
              ))}
              {booking.additionalIntros > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Introduções adicionais ({booking.additionalIntros}×)</span>
                  <span className="font-medium text-slate-900">{formatPrice(booking.additionalIntros * 25)}</span>
                </div>
              )}
              {booking.hasTravelFee && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600">Taxa de deslocação</span>
                  <span className="font-medium text-amber-700">{formatPrice(booking.travelFeeAmount)}</span>
                </div>
              )}
            </div>
            <div className="pt-3 border-t border-slate-100 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal (s/ IVA)</span>
                <span className="text-slate-700">{formatPrice(net)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">IVA ({Math.round(IVA_RATE * 100)}%)</span>
                <span className="text-slate-700">{formatPrice(iva)}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="font-bold text-slate-900">Total</span>
                <span className="text-xl font-bold text-[#0f3460]">{formatPrice(gross)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deliverables */}
        {booking.deliverables.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Conteúdo Entregue</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {booking.deliverables.map((d) => (
                <div key={d.id} className="rounded-xl border border-emerald-200 overflow-hidden bg-emerald-50">
                  {d.mimeType?.startsWith("video/") && (
                    <video controls preload="none" className="w-full bg-black" style={{ maxHeight: 360 }}>
                      <source src={d.fileUrl} type={d.mimeType} />
                    </video>
                  )}
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileVideo className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{d.fileName}</p>
                      {d.description && <p className="text-xs text-slate-500">{d.description}</p>}
                    </div>
                    <a href={d.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

      </div>
    </>
  )
}

function DetailRow({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-sm text-slate-600">{sub}</p>}
      </div>
    </div>
  )
}
