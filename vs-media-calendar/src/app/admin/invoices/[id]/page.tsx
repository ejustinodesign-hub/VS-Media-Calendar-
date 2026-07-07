export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPrice, SERVICE_LABELS, IVA_RATE, ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"
import { MarkPaidButton } from "../mark-paid-button"
import { MoloniBackfillButton } from "../moloni-backfill-button"
import {
  CheckCircle2, Clock, AlertCircle, ArrowLeft,
  Car, MapPin, Package, FileText,
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

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params

  const invoice = await prisma.monthlyInvoice.findUnique({
    where: { id },
    include: {
      consultant: { select: { id: true, name: true, email: true, image: true, billingName: true, billingNif: true } },
      bookings: {
        where: { paymentType: "FLAT_FEE" },
        include: { services: true, videographer: { select: { name: true } } },
        orderBy: { scheduledAt: "asc" },
      },
    },
  })

  if (!invoice) notFound()

  // Shared intro deliverables charged to this consultant in this month
  const [year, m] = invoice.month.split("-").map(Number)
  const monthStart = new Date(year, m - 1, 1)
  const monthEnd = new Date(year, m, 0, 23, 59, 59)

  const sharedIntros = await prisma.deliverable.findMany({
    where: {
      OR: [
        { targetConsultantId: invoice.consultantId },
        { secondConsultantId: invoice.consultantId },
        { thirdConsultantId: invoice.consultantId },
        { fourthConsultantId: invoice.consultantId },
      ],
      createdAt: { gte: monthStart, lte: monthEnd },
    },
    select: {
      id: true,
      fileName: true,
      createdAt: true,
      targetConsultantId: true,
      secondConsultantId: true,
      thirdConsultantId: true,
      fourthConsultantId: true,
      booking: { select: { propertyAddress: true, videographer: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  })

  const cfg = STATUS_CONFIG[invoice.status]
  const Icon = cfg.icon

  // Recompute for display (ground truth)
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

  return (
    <>
      <Header
        title="Detalhe da Fatura"
        subtitle={`${invoice.consultant.name || invoice.consultant.email} · ${monthLabel(invoice.month)}`}
        action={
          <Link
            href={`/admin/invoices?month=${invoice.month}`}
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
            {/* Consultant */}
            <div className="flex items-center gap-3">
              {invoice.consultant.image ? (
                <img src={invoice.consultant.image} alt="" className="w-11 h-11 rounded-full border border-slate-100" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-[#0f3460] flex items-center justify-center text-white font-bold">
                  {invoice.consultant.name?.[0] || "?"}
                </div>
              )}
              <div>
                <p className="font-semibold text-slate-900">{invoice.consultant.billingName || invoice.consultant.name}</p>
                <p className="text-xs text-slate-400">{invoice.consultant.email}</p>
                {invoice.consultant.billingNif && (
                  <p className="text-xs text-slate-400">NIF {invoice.consultant.billingNif}</p>
                )}
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Totals row */}
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
              {invoice.status !== "PAID" && <MarkPaidButton invoiceId={invoice.id} />}
            </div>

            {invoice.dueDate && invoice.status !== "PAID" && (
              <p className="text-xs text-slate-400">
                Vencimento: {new Date(invoice.dueDate).toLocaleDateString("pt-PT")}
              </p>
            )}

            <div className="h-px bg-slate-100" />

            {/* Moloni status */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-0.5">Documento Moloni</p>
                {invoice.moloniDocumentId ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                      <FileText className="w-3.5 h-3.5" />
                      Emitido (#{invoice.moloniDocumentId})
                    </span>
                    <a
                      href={`/api/invoices/${invoice.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#0f3460] underline underline-offset-2"
                    >
                      Ver PDF
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mb-2">Não emitido</p>
                )}
              </div>
              {!invoice.moloniDocumentId && <MoloniBackfillButton invoiceId={invoice.id} />}
            </div>
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
                    {/* Booking header */}
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

                    {/* Line items */}
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

              {/* Bookings subtotal */}
              <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
                <span className="text-slate-500">Subtotal marcações</span>
                <span className="font-semibold text-slate-800">{formatPrice(bookingsSubtotal)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shared intros */}
        {sharedIntros.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Intros Partilhadas ({sharedIntros.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {sharedIntros.map((d) => {
                const count = introSplitCount(d)
                const net = introNet(d)
                const withIva = Math.round(net * (1 + IVA_RATE) * 100) / 100
                return (
                  <div key={d.id} className="flex items-start justify-between text-sm py-1 gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-pink-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-slate-700 truncate">{d.fileName}</p>
                        <p className="text-xs text-slate-400 truncate">{d.booking.propertyAddress}</p>
                        <p className="text-xs text-slate-400">{d.booking.videographer.name}</p>
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
                <span className="text-slate-500">Subtotal intros partilhadas</span>
                <span className="font-semibold text-slate-800">{formatPrice(sharedIntrosSubtotal)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grand total reconciliation */}
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
              <span className="font-bold text-slate-900">Total a cobrar</span>
              <span className="text-xl font-bold text-[#0f3460]">{formatPrice(invoice.total)}</span>
            </div>
          </CardContent>
        </Card>

      </div>
    </>
  )
}
