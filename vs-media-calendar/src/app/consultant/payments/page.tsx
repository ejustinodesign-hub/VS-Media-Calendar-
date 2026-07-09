import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPrice, IVA_RATE, DEFAULT_PRICES, SERVICE_LABELS, ADDITIONAL_INTRO_PRICE, TRAVEL_FEE_AMOUNT } from "@/lib/pricing"
import { Receipt, CheckCircle2, Clock, AlertCircle, Percent, FileVideo, Download, Calculator, Plus } from "lucide-react"
import Link from "next/link"
import { PayInvoiceButton } from "./pay-invoice-button"
import { SalePriceForm } from "./sale-price-form"

export default async function ConsultantPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>
}) {
  const params = await searchParams
  const session = await auth()
  const consultantId = session!.user.id!

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [invoices, pendingCommissionBookings, sharedIntros, currentMonthBookings] = await Promise.all([
    prisma.monthlyInvoice.findMany({
      where: { consultantId },
      include: { bookings: { include: { services: true } } },
      orderBy: { month: "desc" },
    }),
    prisma.booking.findMany({
      where: {
        consultantId,
        paymentType: "COMMISSION",
        salePrice: null,
        status: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "FILE_DELIVERED"] },
      },
      select: { id: true, propertyAddress: true, commissionRate: true, scheduledAt: true },
    }),
    prisma.deliverable.findMany({
      where: {
        OR: [
          { targetConsultantId: consultantId },
          { secondConsultantId: consultantId },
          { thirdConsultantId: consultantId },
          { fourthConsultantId: consultantId },
        ],
      },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        createdAt: true,
        targetConsultantId: true,
        secondConsultantId: true,
        thirdConsultantId: true,
        fourthConsultantId: true,
        booking: { select: { propertyAddress: true, scheduledAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.booking.findMany({
      where: {
        consultantId,
        paymentType: "FLAT_FEE",
        scheduledAt: { gte: monthStart, lte: monthEnd },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      include: { services: true },
      orderBy: { scheduledAt: "asc" },
    }),
  ])

  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length
  const pendingCount = invoices.filter((i) => i.status === "PENDING").length
  const totalDue = invoices
    .filter((i) => i.status !== "PAID")
    .reduce((sum, i) => sum + i.total, 0)

  // Current month billing estimate (only shown if no invoice generated yet for this month)
  const hasCurrentMonthInvoice = invoices.some((i) => i.month === currentMonth)
  const currentMonthIntros = sharedIntros.filter((d) => {
    const bookingDate = new Date(d.booking?.scheduledAt ?? d.createdAt)
    return bookingDate >= monthStart && bookingDate <= monthEnd
  })
  const summaryNet = currentMonthBookings.reduce((sum, b) => {
    const servicesNet = b.services.reduce((s, svc) => s + (DEFAULT_PRICES[svc.serviceType as keyof typeof DEFAULT_PRICES] ?? 0), 0)
    const travel = b.hasTravelFee ? TRAVEL_FEE_AMOUNT : 0
    return sum + servicesNet + travel
  }, 0) + currentMonthIntros.reduce((sum, d) => {
    const count = 1 + (d.secondConsultantId ? 1 : 0) + (d.thirdConsultantId ? 1 : 0) + (d.fourthConsultantId ? 1 : 0)
    return sum + Math.round((ADDITIONAL_INTRO_PRICE / count) * 100) / 100
  }, 0)
  const summaryIva = Math.round(summaryNet * IVA_RATE * 100) / 100
  const summaryTotal = Math.round(summaryNet * (1 + IVA_RATE) * 100) / 100

  return (
    <>
      <Header title="Pagamentos" subtitle="Faturas mensais e comissões de venda" />
      <div className="flex-1 p-6 space-y-6">
        {params.payment === "success" && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-semibold">Pagamento efectuado com sucesso!</p>
          </div>
        )}

        {overdueCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold">
                Tem {overdueCount} fatura{overdueCount > 1 ? "s" : ""} em atraso. Marcações em taxa fixa estão bloqueadas.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pl-8">
              <p className="text-xs text-red-600 self-center flex-1">
                Pode continuar a marcar vídeos em modo comissão — sem pagamento até à venda do imóvel (0,15% do valor de venda).
              </p>
              <Link
                href="/consultant/bookings/new?mode=commission"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors whitespace-nowrap flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova marcação em comissão
              </Link>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-slate-500">Em atraso</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{overdueCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-slate-500">Pendente</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-slate-500">Total por pagar</p>
              <p className="text-2xl font-bold text-[#0f3460] mt-1">{formatPrice(totalDue)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Current month billing summary */}
        {!hasCurrentMonthInvoice && currentMonthBookings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className="w-4 h-4 text-[#0f3460]" />
                Resumo de faturação — {lastDayOfMonth.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-500">
                Estimativa com base nas marcações confirmadas este mês. A fatura será emitida no último dia do mês ({lastDayOfMonth.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })}).
              </p>
              <div className="space-y-2">
                {currentMonthBookings.map((b) => {
                  const servicesNet = b.services.reduce((s, svc) => s + (DEFAULT_PRICES[svc.serviceType as keyof typeof DEFAULT_PRICES] ?? 0), 0)
                  const introsNet = (b.additionalIntros ?? 0) * ADDITIONAL_INTRO_PRICE
                  const travel = b.hasTravelFee ? TRAVEL_FEE_AMOUNT : 0
                  const bookingNet = servicesNet + introsNet + travel
                  return (
                    <div key={b.id} className="flex items-start justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 truncate">{b.propertyAddress}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {b.services.map((s) => SERVICE_LABELS[s.serviceType as keyof typeof SERVICE_LABELS]).join(", ")}
                          {b.hasTravelFee ? " · Deslocação" : ""}
                          {(b.additionalIntros ?? 0) > 0 ? ` · ${b.additionalIntros}× Intro adicional` : ""}
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 whitespace-nowrap">{formatPrice(bookingNet)} s/ IVA</p>
                    </div>
                  )
                })}
              </div>
              <div className="pt-2 space-y-1.5 border-t border-slate-200">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Subtotal (s/ IVA)</span>
                  <span>{formatPrice(summaryNet)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>IVA 23%</span>
                  <span>{formatPrice(summaryIva)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900">
                  <span>Total estimado (c/ IVA)</span>
                  <span>{formatPrice(summaryTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shared intros from other bookings */}
        {sharedIntros.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileVideo className="w-4 h-4 text-[#0f3460]" />
                Vídeos com a minha introdução
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">
                Vídeos filmados por outros consultores que incluem uma introdução personalizada sua. O custo de 25€ é dividido por todos os consultores que partilham a intro.
              </p>
              {sharedIntros.map((d) => {
                const expiry = new Date(d.createdAt)
                expiry.setDate(expiry.getDate() + 30)
                const isExpired = expiry < new Date()
                return (
                  <div
                    key={d.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border ${isExpired ? "bg-slate-50 border-slate-200 opacity-60" : "bg-blue-50 border-blue-200"}`}
                  >
                    <div className="w-10 h-10 bg-[#0f3460] rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileVideo className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{d.fileName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{d.booking?.propertyAddress ?? d.fileName}</p>
                      <p className={`text-xs mt-0.5 ${isExpired ? "text-red-500" : "text-amber-600"}`}>
                        {isExpired
                          ? "Ficheiro expirado"
                          : `Disponível até ${expiry.toLocaleDateString("pt-PT")}`}
                      </p>
                    </div>
                    {!isExpired && (
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#0f3460] text-white text-xs font-semibold rounded-lg hover:bg-[#1a4a7a] transition-colors flex-shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Commission bookings */}
        {pendingCommissionBookings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Percent className="w-4 h-4 text-[#e94560]" />
                Comissões por registar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">
                Estes imóveis foram filmados com opção de comissão. Se o imóvel foi vendido, introduza o valor de venda para calcular a comissão de 0,15%.
              </p>
              {pendingCommissionBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200"
                >
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{booking.propertyAddress}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(booking.scheduledAt).toLocaleDateString("pt-PT", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <SalePriceForm
                    bookingId={booking.id}
                    propertyAddress={booking.propertyAddress}
                    commissionRate={booking.commissionRate ?? 0.0015}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Invoices — last 6 months */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="w-4 h-4 text-[#0f3460]" />
              Faturas mensais — últimos 6 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
                const monthLabel = d.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })
                const invoice = invoices.find((inv) => inv.month === monthKey)
                const isCurrentMonth = i === 0

                const isPaid = invoice?.status === "PAID"
                const isOverdue = invoice?.status === "OVERDUE"
                const isPending = invoice?.status === "PENDING"

                let borderColor = "border-slate-200"
                let bgColor = "bg-white"
                let dotColor = "bg-slate-300"
                let statusLabel = isCurrentMonth ? "A gerar" : "Sem serviços"
                let statusClass = "text-slate-400 bg-slate-100"

                if (isPaid) {
                  borderColor = "border-emerald-200"; bgColor = "bg-emerald-50"
                  dotColor = "bg-emerald-400"; statusLabel = "Pago"; statusClass = "text-emerald-700 bg-emerald-100"
                } else if (isOverdue) {
                  borderColor = "border-red-200"; bgColor = "bg-red-50"
                  dotColor = "bg-red-400"; statusLabel = "Em atraso"; statusClass = "text-red-700 bg-red-100"
                } else if (isPending) {
                  borderColor = "border-amber-200"; bgColor = "bg-amber-50"
                  dotColor = "bg-amber-400"; statusLabel = "Por pagar"; statusClass = "text-amber-700 bg-amber-100"
                }

                const [iy, im] = invoice ? invoice.month.split("-").map(Number) : [0, 0]
                const canPayFrom = invoice ? new Date(iy, im, 0).toISOString() : ""

                return (
                  <div
                    key={monthKey}
                    className={`rounded-xl border p-4 flex flex-col gap-3 ${borderColor} ${bgColor}`}
                  >
                    {/* Month + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-slate-500 capitalize">{monthLabel}</p>
                        {invoice && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {invoice.bookings.length} marcaç{invoice.bookings.length === 1 ? "ão" : "ões"}
                          </p>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        {statusLabel}
                      </span>
                    </div>

                    {/* Amount */}
                    <p className={`text-xl font-bold ${invoice ? "text-slate-900" : "text-slate-300"}`}>
                      {invoice ? formatPrice(invoice.total) : "—"}
                    </p>

                    {/* Due date */}
                    {invoice && (
                      <p className="text-[11px] text-slate-400">
                        Vence{isPaid ? "u" : ""} {new Date(invoice.dueDate).toLocaleDateString("pt-PT")}
                      </p>
                    )}

                    {/* Actions */}
                    {invoice && (
                      <div className="flex items-center gap-2 mt-auto pt-1">
                        <Link
                          href={`/consultant/payments/${invoice.id}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-white transition-colors"
                        >
                          Ver detalhe
                        </Link>
                        {(invoice as any).moloniDocumentId && (
                          <a
                            href={`/api/invoices/${invoice.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-white transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            PDF
                          </a>
                        )}
                        {isPaid ? (
                          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Liquidado
                          </span>
                        ) : (
                          <PayInvoiceButton
                            invoiceId={invoice.id}
                            isOverdue={isOverdue}
                            canPayFrom={canPayFrom}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {invoices.length === 0 && (
              <p className="text-center text-slate-400 text-sm pt-4">
                Nenhuma fatura emitida ainda. As faturas são geradas automaticamente no final de cada mês.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
