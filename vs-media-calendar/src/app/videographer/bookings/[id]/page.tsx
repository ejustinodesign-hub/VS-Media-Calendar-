import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingStatusBadge } from "@/components/ui/badge"
import { SERVICE_LABELS } from "@/lib/pricing"
import { AcceptRejectButtons } from "./accept-reject-buttons"
import { UploadDeliverable } from "./upload-deliverable"
import { formatDateTime } from "@/lib/utils"
import { User, Calendar, MapPin, Clock, Video } from "lucide-react"

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ action?: string }>
}

export default async function VideographerBookingDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { action } = await searchParams
  const session = await auth()

  const booking = await prisma.booking.findFirst({
    where: { id, videographerId: session!.user.id },
    include: {
      consultant: { select: { name: true, email: true, image: true } },
      services: { select: { id: true, serviceType: true } },
      deliverables: true,
    },
  })

  if (!booking) notFound()

  const scheduledDate = new Date(booking.scheduledAt)
  const canActOnRequest = booking.status === "PENDING_ACCEPTANCE"
  const canUpload = ["ACCEPTED", "IN_PROGRESS", "FILE_DELIVERED"].includes(booking.status)

  return (
    <>
      <Header
        title="Detalhe do Pedido"
        subtitle={`#${booking.id.slice(0, 8).toUpperCase()}`}
      />
      <div className="flex-1 p-6 max-w-3xl space-y-4">
        {/* Status */}
        <Card>
          <CardContent className="flex items-center justify-between py-5">
            <div>
              <p className="text-sm text-slate-500 mb-1">Estado</p>
              <BookingStatusBadge status={booking.status} />
            </div>
            <div className="text-right text-sm text-slate-500">
              <p>Recebido em</p>
              <p className="font-medium text-slate-700">{formatDateTime(booking.createdAt)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Accept/Reject actions */}
        {canActOnRequest && (
          <AcceptRejectButtons bookingId={booking.id} autoAction={action} />
        )}

        {/* Booking details (no prices shown) */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Serviço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailRow
              icon={<User className="w-4 h-4" />}
              label="Consultor"
              value={booking.consultant.name || ""}
            />
            <DetailRow
              icon={<Calendar className="w-4 h-4" />}
              label="Data"
              value={scheduledDate.toLocaleDateString("pt-PT", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            />
            <DetailRow
              icon={<Clock className="w-4 h-4" />}
              label="Hora de Início"
              value={scheduledDate.toLocaleTimeString("pt-PT", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
            <DetailRow icon={<Clock className="w-4 h-4" />} label="Duração" value="1h30" />
            <DetailRow
              icon={<MapPin className="w-4 h-4" />}
              label="Morada do Imóvel"
              value={booking.propertyAddress}
            />
            {booking.additionalIntros > 0 && (
              <DetailRow
                icon={<User className="w-4 h-4" />}
                label="Introduções Adicionais"
                value={`${booking.additionalIntros} consultor(es) extra`}
              />
            )}
          </CardContent>
        </Card>

        {/* Services (type only, no price) */}
        <Card>
          <CardHeader>
            <CardTitle>Serviços a Realizar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {booking.services.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Video className="w-4 h-4 text-[#0f3460]" />
                  <span className="text-sm font-medium text-slate-800">
                    {SERVICE_LABELS[s.serviceType as keyof typeof SERVICE_LABELS]}
                  </span>
                </div>
              ))}
            </div>
            {booking.services.some((s) => s.serviceType === "VIDEO_AI") && (
              <div className="mt-3 p-3 bg-violet-50 rounded-lg border border-violet-200 flex items-start gap-2">
                <span className="text-violet-500 text-base leading-none mt-0.5">✦</span>
                <div>
                  <p className="text-sm font-semibold text-violet-800">Vídeo com Inteligência Artificial</p>
                  <p className="text-xs text-violet-600 mt-0.5">
                    Este vídeo inclui tratamento com IA. Certifica-te de que o conteúdo entregue inclui os efeitos e melhorias de IA acordados.
                  </p>
                </div>
              </div>
            )}
            {booking.notes && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-600 font-medium mb-1">Notas do Consultor</p>
                <p className="text-sm text-blue-900">{booking.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload deliverable */}
        {canUpload && (
          <UploadDeliverable
            bookingId={booking.id}
            existingFiles={booking.deliverables}
            primaryConsultantId={booking.consultantId}
          />
        )}

      </div>
    </>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}
