import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingStatusBadge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/pricing"
import { CancelBookingButton } from "./cancel-button"
import { SERVICE_LABELS } from "@/lib/pricing"
import { formatDateTime } from "@/lib/utils"
import {
  User, Calendar, MapPin, Clock, CreditCard,
  Download, FileVideo, CheckCircle2, AlertCircle,
} from "lucide-react"

interface Props {
  params: Promise<{ id: string }>
}

export default async function BookingDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  const booking = await prisma.booking.findFirst({
    where: { id, consultantId: session!.user.id },
    include: {
      videographer: { select: { name: true, image: true, email: true } },
      services: true,
      payment: true,
      deliverables: true,
    },
  })

  if (!booking) notFound()

  const canCancel = !["CANCELLED", "REJECTED", "COMPLETED"].includes(booking.status)
  const scheduledDate = new Date(booking.scheduledAt)

  return (
    <>
      <Header
        title="Detalhes da Marcação"
        subtitle={`#${booking.id.slice(0, 8).toUpperCase()}`}
      />
      <div className="flex-1 p-6 max-w-3xl">
        <div className="space-y-4">
          {/* Status card */}
          <Card>
            <CardContent className="flex items-center justify-between py-5">
              <div>
                <p className="text-sm text-slate-500 mb-1">Estado da Marcação</p>
                <BookingStatusBadge status={booking.status} />
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Criada em</p>
                <p className="text-sm font-medium text-slate-700">
                  {formatDateTime(booking.createdAt)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Status messages */}
          {booking.status === "REJECTED" && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-semibold text-sm">Marcação Recusada</p>
                <p className="text-red-700 text-xs mt-1">
                  O videógrafo recusou este pedido. Por favor, crie uma nova marcação com outro horário ou videógrafo.
                </p>
              </div>
            </div>
          )}

          {booking.status === "FILE_DELIVERED" && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-emerald-800 font-semibold text-sm">Conteúdo Entregue!</p>
                <p className="text-emerald-700 text-xs mt-1">
                  O videógrafo fez upload do conteúdo final. Pode descarregá-lo abaixo.
                </p>
              </div>
            </div>
          )}

          {/* Booking details */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Serviço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow
                icon={<User className="w-4 h-4" />}
                label="Videógrafo"
                value={booking.videographer.name || ""}
              />
              <DetailRow
                icon={<Calendar className="w-4 h-4" />}
                label="Data e Hora"
                value={scheduledDate.toLocaleDateString("pt-PT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                sub={scheduledDate.toLocaleTimeString("pt-PT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
              <DetailRow
                icon={<Clock className="w-4 h-4" />}
                label="Duração"
                value="1 hora e 30 minutos"
              />
              <DetailRow
                icon={<MapPin className="w-4 h-4" />}
                label="Morada"
                value={booking.propertyAddress}
              />
              {booking.travelTimeMinutes && (
                <DetailRow
                  icon={<MapPin className="w-4 h-4" />}
                  label="Tempo de Deslocação"
                  value={`${Math.floor(booking.travelTimeMinutes / 60)}h${String(booking.travelTimeMinutes % 60).padStart(2, "0")}min`}
                />
              )}
            </CardContent>
          </Card>

          {/* Services & Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Serviços e Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4">
                {booking.services.map((s) => (
                  <div key={s.id} className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      {SERVICE_LABELS[s.serviceType as keyof typeof SERVICE_LABELS]}
                    </span>
                    <span className="font-medium text-slate-900">{formatPrice(s.price)}</span>
                  </div>
                ))}
                {booking.additionalIntros > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      Introduções adicionais ({booking.additionalIntros}×)
                    </span>
                    <span className="font-medium text-slate-900">
                      {formatPrice(booking.additionalIntros * 25)}
                    </span>
                  </div>
                )}
                {booking.hasTravelFee && (
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-600">Taxa de deslocação</span>
                    <span className="font-medium text-amber-700">
                      {formatPrice(booking.travelFeeAmount)}
                    </span>
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">Total Pago</span>
                  <span className="text-xl font-bold text-[#0f3460]">
                    {formatPrice(booking.payment?.amount || 0)}
                  </span>
                </div>
                {booking.payment?.paidAt && (
                  <p className="text-xs text-slate-400 mt-1 text-right">
                    Pago em {formatDateTime(booking.payment.paidAt)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Deliverables */}
          {booking.deliverables.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Conteúdo Final</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {booking.deliverables.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="w-10 h-10 bg-[#0f3460] rounded-lg flex items-center justify-center">
                      <FileVideo className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {d.fileName}
                      </p>
                      {d.description && (
                        <p className="text-xs text-slate-500">{d.description}</p>
                      )}
                    </div>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-[#0f3460] font-semibold hover:underline"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Cancel */}
          {canCancel && <CancelBookingButton bookingId={booking.id} />}
        </div>
      </div>
    </>
  )
}

function DetailRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
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
