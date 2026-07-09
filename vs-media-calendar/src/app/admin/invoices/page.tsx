export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { formatPrice } from "@/lib/pricing"
import { MarkPaidButton } from "./mark-paid-button"
import { RecalculateButton } from "./recalculate-button"
import { SendRemindersButton } from "./send-reminders-button"
import { JuneIntrosButton } from "./june-intros-button"
import { CheckCircle2, Clock, AlertCircle, Receipt, ChevronRight } from "lucide-react"
import Link from "next/link"

function monthLabel(month: string) {
  const [year, m] = month.split("-")
  const date = new Date(Number(year), Number(m) - 1, 1)
  return date.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })
}

const STATUS_CONFIG = {
  PAID:    { label: "Pago",     icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  PENDING: { label: "Pendente", icon: Clock,         color: "text-amber-600 bg-amber-50 border-amber-100" },
  OVERDUE: { label: "Em atraso",icon: AlertCircle,   color: "text-red-600 bg-red-50 border-red-100" },
}

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const now = new Date()
  const selectedMonth = month
    ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const invoices = await prisma.monthlyInvoice.findMany({
    where: { month: selectedMonth },
    include: {
      consultant: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { status: "asc" }, // OVERDUE first (alphabetically OVERDUE < PAID < PENDING)
  })

  // Sort: OVERDUE → PENDING → PAID
  const ORDER = { OVERDUE: 0, PENDING: 1, PAID: 2 }
  invoices.sort((a, b) => ORDER[a.status] - ORDER[b.status])

  const paid    = invoices.filter((i) => i.status === "PAID")
  const pending = invoices.filter((i) => i.status === "PENDING")
  const overdue = invoices.filter((i) => i.status === "OVERDUE")

  const totalPaid    = paid.reduce((s, i) => s + i.total, 0)
  const totalPending = [...pending, ...overdue].reduce((s, i) => s + i.total, 0)

  // Build month list for selector (last 6 months)
  const months: string[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  return (
    <>
      <Header
        title="Faturas"
        subtitle={`Consultores · ${monthLabel(selectedMonth)}`}
      />
      <div className="flex-1 p-6 space-y-6">

        {/* Month selector + recalculate */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {months.map((m) => (
            <a
              key={m}
              href={`/admin/invoices?month=${m}`}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors capitalize ${
                m === selectedMonth
                  ? "bg-[#0f3460] text-white border-[#0f3460]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-[#0f3460] hover:text-[#0f3460]"
              }`}
            >
              {monthLabel(m)}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedMonth === "2026-06" && <JuneIntrosButton />}
          <SendRemindersButton month={selectedMonth} unpaidCount={pending.length + overdue.length} />
          <RecalculateButton month={selectedMonth} />
        </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-slate-500 font-medium">Pagos</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{paid.length}</p>
            <p className="text-xs text-slate-400 mt-1">{formatPrice(totalPaid)} recebidos</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-slate-500 font-medium">Pendentes</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
            <p className="text-xs text-slate-400 mt-1">{formatPrice(pending.reduce((s,i)=>s+i.total,0))} por receber</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-slate-500 font-medium">Em atraso</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{overdue.length}</p>
            <p className="text-xs text-slate-400 mt-1">{formatPrice(overdue.reduce((s,i)=>s+i.total,0))} em dívida</p>
          </div>
        </div>

        {/* Invoice list */}
        {invoices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Sem faturas para {monthLabel(selectedMonth)}.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
            {invoices.map((invoice) => {
              const cfg = STATUS_CONFIG[invoice.status]
              const Icon = cfg.icon
              return (
                <div key={invoice.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                  {/* Clickable area */}
                  <Link href={`/admin/invoices/${invoice.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    {invoice.consultant.image ? (
                      <img
                        src={invoice.consultant.image}
                        alt={invoice.consultant.name || ""}
                        className="w-10 h-10 rounded-full border border-slate-100 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#0f3460] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {invoice.consultant.name?.[0] || "?"}
                      </div>
                    )}

                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">
                        {invoice.consultant.name || invoice.consultant.email}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {invoice.consultant.email}
                      </p>
                    </div>

                    {/* Amounts */}
                    <div className="text-right mr-4 hidden sm:block">
                      <p className="text-sm font-bold text-slate-800">{formatPrice(invoice.total)}</p>
                      <p className="text-xs text-slate-400">s/ IVA {formatPrice(invoice.subtotal)}</p>
                    </div>

                    {/* Paid at */}
                    {invoice.paidAt && (
                      <p className="text-xs text-slate-400 hidden md:block mr-4 whitespace-nowrap">
                        pago a {new Date(invoice.paidAt).toLocaleDateString("pt-PT")}
                      </p>
                    )}

                    {/* Status badge */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${cfg.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </Link>

                  {/* Action (outside link to prevent nesting) */}
                  {invoice.status !== "PAID" && (
                    <MarkPaidButton invoiceId={invoice.id} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Total outstanding */}
        {totalPending > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-6 py-4 flex items-center justify-between">
            <p className="text-sm text-amber-700 font-medium">Total por receber este mês</p>
            <p className="text-xl font-bold text-amber-700">{formatPrice(totalPending)}</p>
          </div>
        )}

      </div>
    </>
  )
}
