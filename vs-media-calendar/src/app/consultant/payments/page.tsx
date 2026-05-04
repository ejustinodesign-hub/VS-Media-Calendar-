import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPrice, IVA_RATE, DEFAULT_PRICES, SERVICE_LABELS, ADDITIONAL_INTRO_PRICE, TRAVEL_FEE_AMOUNT } from "@/lib/pricing"
import { Receipt, CheckCircle2, Clock, AlertCircle, Percent, FileVideo, Download, Calculator } from "lucide-react"
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
      where: { targetConsultantId: consultantId },
      include: {
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
  const summaryNet = currentMonthBookings.reduce((sum, b) => {
    const servicesNet = b.services.reduce((s, svc) => s + (DEFAULT_PRICES[svc.serviceType as keyof typeof DEFAULT_PRICES] ?? 0), 0)
    const introsNet = (b.additionalIntros ?? 0) * ADDITIONAL_INTRO_PRICE
    const travel = b.hasTravelFee ? TRAVEL_FEE_AMOUNT : 0
    return sum + servicesNet + introsNet + travel
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
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-semibold">
              Tem {overdueCount} fatura{overdueCount > 1 ? "s" : ""} em atraso. Regularize o pagamento para poder criar novas marcações.
            </p>
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
                Vídeos filmados por outros consultores que incluem uma introdução personalizada sua. Cada intro tem o custo de 25€ adicionado à sua fatura.
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
                      <p className="text-xs text-slate-500 mt-0.5">{d.booking.propertyAddress}</p>
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

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="w-4 h-4 text-[#0f3460]" />
              Faturas mensais
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="py-12 text-center">
                <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm">Nenhuma fatura emitida ainda.</p>
                <p className="text-slate-400 text-xs mt-1">
                  As faturas são geradas automaticamente no final de cada mês.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice) => {
                  const isPaid = invoice.status === "PAID"
                  const isOverdue = invoice.status === "OVERDUE"
                  const [iy, im] = invoice.month.split("-").map(Number)
                  const canPayFrom = new Date(iy, im, 0).toISOString()
                  return (
                    <div
                      key={invoice.id}
                      className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border ${
                        isOverdue
                          ? "bg-red-50 border-red-200"
                          : isPaid
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isOverdue ? "bg-red-100" : isPaid ? "bg-emerald-100" : "bg-amber-100"
                          }`}
                        >
                          {isPaid ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : isOverdue ? (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          ) : (
                            <Clock className="w-5 h-5 text-amber-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Fatura {invoice.month}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {invoice.bookings.length} marcaç{invoice.bookings.length === 1 ? "ão" : "ões"}
                            {" · "}Vence{isPaid ? "u" : ""}{" "}
                            {new Date(invoice.dueDate).toLocaleDateString("pt-PT")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                        <p className="text-lg font-bold text-slate-900">{formatPrice(invoice.total)}</p>
                        {isPaid ? (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full">
                            Pago
                          </span>
                        ) : (
                          <PayInvoiceButton
                            invoiceId={invoice.id}
                            isOverdue={isOverdue}
                            canPayFrom={canPayFrom}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
