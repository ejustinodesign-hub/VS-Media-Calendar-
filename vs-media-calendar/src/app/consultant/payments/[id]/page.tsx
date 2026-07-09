export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPrice, SERVICE_LABELS, IVA_RATE, ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"
import { PayInvoiceButton } from "../pay-invoice-button"
import {
  CheckCircle2, Clock, AlertCircle, ArrowLeft,
  Car, MapPin, Package, FileText, Download,
} from "lucide-react"
import Link from "next/link"
import type { ServiceType } from "@prisma/client"

function monthLabel(month: string) {
  const [year, m] = month.split("-")
  const date = new Date(Number(year), Number(m) - 1, 1)
  return date.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })
}

const STATUS_CONFIG = {
  PAID:    { label: "Pago",      icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  PENDING: { label: "Pendente",  icon: Clock,        color: "text-amber-600 bg-amber-50 border-amber-100" },
  OVERDUE: { label: "Em atraso", icon: AlertCircle,  color: "text-red-600 bg-red-50 border-red-100" },
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function ConsultantInvoiceDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  const consultantId = session!.user.id!

  const invoice = await prisma.monthlyInvoice.findFirst({
    where: { id, consultantId },
    include: {
      bookings: {
        where: { paymentType: "FLAT_FEE" },
        include: { services: true, videographer: { select: { name: true } } },
        orderBy: { scheduledAt: "asc" },
      },
    },
  })

  if (!invoice) notFound()

  const [year, m] = invoice.month.split("-").map(Number)
  const monthStart = new Date(year, m - 1, 1)
  const monthEnd = new Date(year, m, 0, 23, 59, 59)

  const consultantFilter = [
    { targetConsultantId: consultantId },
    { secondConsultantId: consultantId },
    { thirdConsultantId: consultantId },
    { fourthConsultantId: consultantId },
  ] as const

  const introSelect = {
    id: true,
    fileName: true,
    fileUrl: true,
    description: true,
    createdAt: true,
    targetConsultantId: true,
    secondConsultantId: true,
    thirdConsultantId: true,
    fourthConsultantId: true,
    booking: { select: { propertyAddress: true, videographer: { select: { name: true } } } },
  } as const

  // Regular intros: created within the invoice month (backfill ones are month-tagged separately)
  const regularIntros = await prisma.deliverable.findMany({
    where: {
      OR: [...consultantFilter],
      createdAt: { gte: monthStart, lte: monthEnd },
      NOT: { fileUrl: { startsWith: "backfill:intro-junho-2026:" } },
    },
    select: introSelect,
    orderBy: { createdAt: "asc" },
  })

  // Backfill June 2026 intros carry the month they were charged to in mimeType
  const backfillIntros = ["2026-06", "2026-07"].includes(invoice.month)
    ? await prisma.deliverable.findMany({
        where: {
          fileUrl: { startsWith: "backfill:intro-junho-2026:" },
          targetConsultantId: consultantId,
          mimeType: `backfill-charged:${invoice.month}`,
        },
        select: introSelect,
        orderBy: { createdAt: "asc" },
      })
    : []

  const sharedIntros = [...regularIntros, ...backfillIntros]

  const cfg = STATUS_CONFIG[invoice.status]
  const Icon = cfg.icon

  const bookingsSubtotal = invoice.bookings.reduce((sum, b) => {
    const svcTotal = b.services.reduce((s, svc) => s + svc.price, 0)
    const travel = b.hasTravelFee ? b.travelFeeAmount : 0
    const intros = b.additionalIntros * ADDITIONAL_INTRO_PRICE
    return sum + svcTotal + travel + intros
  }, 0)

  function introSplitCount(d: typeof sharedIntros[0]) {
    return 1 + (d.secondConsultantId ? 1 : 0) + (d.thirdConsultantId ? 1 : 0) + (d.fourthConsultantId ? 1 : 0)
  }
  function introNet(d: typeof sharedIntros[0]) {
    return Math.round((ADDITIONAL_INTRO_PRICE / introSplitCount(d)) * 100) / 100
  }
  const sharedIntrosSubtotal = sharedIntros.reduce((sum, d) => sum + introNet(d), 0)

  const [iy, im] = invoice.month.split("-").map(Number)
  const canPayFrom = new Date(iy, im, 0).toISOString()

  return (
    <>
      <Header
        title="Detalhe da Fatura"
        subtitle={monthLabel(invoice.month)}
        action={
          <Link
            href="/consultant/payments"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        }
      />
      <div className="flex-1 p-6 max-w-3xl space-y-4">

        {/* Summary card */}
        <Card>
          <CardContent className="py-5 space-y-4">
            {/* Totals */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Subtotal s/ IVA</p>
                <p className="text-lg font-bold text-slate-800">{formatPrice(invoice.subtotal)}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  IVA ({Math.round(IVA_RATE * 100)}%) {formatPrice(invoice.total - invoice.subtotal)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Total c/ IVA</p>
                <p className="text-2xl font-bold text-[#0f3460]">{formatPrice(invoice.total)}</p>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Status + actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${cfg.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {cfg.label}
                </div>
                {invoice.paidAt && (
                  <p className="text-xs text-slate-400">
                    pago a {new Date(invoice.paidAt).toLocaleDateString("pt-PT")}
                  </p>
                )}
              </div>
              {invoice.status !== "PAID" && (
                <PayInvoiceButton
                  invoiceId={invoice.id}
                  isOverdue={invoice.status === "OVERDUE"}
                  canPayFrom={canPayFrom}
                />
              )}
            </div>

            {invoice.dueDate && invoice.status !== "PAID" && (
              <p className="text-xs text-slate-400">
                Vencimento: {new Date(invoice.dueDate).toLocaleDateString("pt-PT")}
              </p>
            )}

            {/* Moloni PDF */}
            {(invoice as any).moloniDocumentId && (
              <>
                <div className="h-px bg-slate-100" />
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <a
                    href={`/api/invoices/${invoice.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-[#0f3460] font-medium hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descarregar fatura PDF
                  </a>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bookings breakdown */}
        {invoice.bookings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Marcações ({invoice.bookings.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {invoice.bookings.map((booking) => {
                const svcTotal = booking.services.reduce((s, svc) => s + svc.price, 0)
                const travel = booking.hasTravelFee ? booking.travelFeeAmount : 0
                const intros = booking.additionalIntros * ADDITIONAL_INTRO_PRICE
                const lineTotal = svcTotal + travel + intros
                return (
                  <div key={booking.id} className="rounded-xl border border-slate-100 overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {booking.propertyAddress}
                          </p>
                        </div>
                        <p className="text-xs text-slate-400 ml-5">
                          {new Date(booking.scheduledAt).toLocaleDateString("pt-PT", {
                            weekday: "short", day: "numeric", month: "short",
                          })}
                          {" · "}
                          {booking.videographer.name}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-slate-800 flex-shrink-0">{formatPrice(lineTotal)}</p>
                    </div>

                    <div className="px-4 py-2 space-y-1.5">
                      {booking.services.map((svc) => (
                        <div key={svc.id} className="flex justify-between text-sm">
                          <span className="text-slate-600">
                            {SERVICE_LABELS[svc.serviceType as ServiceType] || svc.serviceType}
                          </span>
                          <span className={`font-medium ${svc.price === 0 ? "text-emerald-600" : "text-slate-800"}`}>
                            {svc.price === 0 ? "Grátis" : formatPrice(svc.price)}
                          </span>
                        </div>
                      ))}
                      {booking.additionalIntros > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">
                            Intros adicionais ({booking.additionalIntros}×)
                          </span>
                          <span className="font-medium text-slate-800">{formatPrice(intros)}</span>
                        </div>
                      )}
                      {booking.hasTravelFee && (
                        <div className="flex justify-between text-sm">
                          <span className="text-amber-600 flex items-center gap-1">
                            <Car className="w-3 h-3" />
                            Taxa de deslocação
                          </span>
                          <span className="font-medium text-amber-700">{formatPrice(travel)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
                <span className="text-slate-500">Subtotal marcações</span>
                <span className="font-semibold text-slate-800">{formatPrice(bookingsSubtotal)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Intros */}
        {sharedIntros.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Intros de Vídeo ({sharedIntros.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <p className="text-xs text-slate-500 pb-1">
                Introduções suas incluídas em vídeos de imóveis. O custo base é de {formatPrice(ADDITIONAL_INTRO_PRICE)} por intro.
              </p>
              {sharedIntros.map((d) => {
                const count = introSplitCount(d)
                const net = introNet(d)
                const withIva = Math.round(net * (1 + IVA_RATE) * 100) / 100
                const isBackfill = d.fileUrl.startsWith("backfill:intro-junho-2026:")
                const label = d.description || d.booking?.propertyAddress || d.fileName
                return (
                  <div key={d.id} className="flex items-start justify-between text-sm py-2 border-b border-slate-50 last:border-0 gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-pink-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-slate-800 font-medium truncate">{label}</p>
                        {isBackfill && (
                          <p className="text-xs text-slate-400">Intro de junho 2026</p>
                        )}
                        {!isBackfill && d.description && d.booking?.propertyAddress && (
                          <p className="text-xs text-slate-400 truncate">{d.booking.propertyAddress}</p>
                        )}
                        {!isBackfill && d.booking?.videographer?.name && (
                          <p className="text-xs text-slate-400">{d.booking.videographer.name}</p>
                        )}
                        {count > 1 && (
                          <p className="text-[11px] text-violet-500 mt-0.5">
                            Partilhada com {count} consultores — {formatPrice(ADDITIONAL_INTRO_PRICE)} ÷ {count}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-medium text-slate-800">{formatPrice(net)} <span className="text-slate-400 text-xs">s/ IVA</span></p>
                      <p className="text-xs text-slate-400">{formatPrice(withIva)} c/ IVA</p>
                    </div>
                  </div>
                )
              })}
              <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
                <span className="text-slate-500">Subtotal intros</span>
                <span className="font-semibold text-slate-800">{formatPrice(sharedIntrosSubtotal)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grand total */}
        <Card>
          <CardContent className="py-4 space-y-1.5">
            {bookingsSubtotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Marcações</span>
                <span className="text-slate-700">{formatPrice(bookingsSubtotal)}</span>
              </div>
            )}
            {sharedIntrosSubtotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Intros partilhadas</span>
                <span className="text-slate-700">{formatPrice(sharedIntrosSubtotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">IVA ({Math.round(IVA_RATE * 100)}%)</span>
              <span className="text-slate-700">{formatPrice(invoice.total - invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="font-bold text-slate-900">Total a pagar</span>
              <span className="text-xl font-bold text-[#0f3460]">{formatPrice(invoice.total)}</span>
            </div>
          </CardContent>
        </Card>

      </div>
    </>
  )
}
