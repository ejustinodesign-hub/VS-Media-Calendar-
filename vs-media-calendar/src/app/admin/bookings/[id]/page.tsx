import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingStatusBadge } from "@/components/ui/badge"
import { formatPrice, IVA_RATE, SERVICE_LABELS, DEFAULT_PRICES } from "@/lib/pricing"
import { formatDateTime } from "@/lib/utils"
import Link from "next/link"
import {
  User, Calendar, MapPin, Clock, ArrowLeft,
} from "lucide-react"
import { TravelFeeToggle } from "./travel-fee-toggle"
import { EditServices } from "./edit-services"
import { DeliverablesList } from "./deliverables-list"
import type { ServiceType } from "@prisma/client"

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminBookingDetailPage({ params }: Props) {
  const { id } = await params

  const [booking, pricingRules] = await Promise.all([
    prisma.booking.findUnique({
      where: { id },
      include: {
        consultant:   { select: { name: true, email: true, image: true } },
        videographer: { select: { name: true, email: true, image: true } },
        services:     true,
        payment:      true,
        deliverables: true,
      },
    }),
    prisma.pricingRule.findMany({ where: { active: true, teamId: null }, select: { serviceType: true, basePrice: true } }),
  ])

  if (!booking) notFound()

  const activePrices: Record<string, number> = { ...DEFAULT_PRICES }
  for (const r of pricingRules) activePrices[r.serviceType] = r.basePrice

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
              <EditServices
                bookingId={booking.id}
                services={booking.services.map((s) => ({ id: s.id, serviceType: s.serviceType, price: s.price }))}
                serviceLabels={SERVICE_LABELS as Record<string, string>}
                servicePrices={activePrices}
                allServiceTypes={Object.keys(SERVICE_LABELS)}
              />
              {booking.additionalIntros > 0 && (
                <div className="flex justify-between text-sm mt-2">
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
            <CardContent>
              <DeliverablesList deliverables={booking.deliverables.map(d => ({
                id: d.id,
                fileName: d.fileName,
                fileUrl: d.fileUrl,
                mimeType: d.mimeType,
                description: d.description,
              }))} />
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
