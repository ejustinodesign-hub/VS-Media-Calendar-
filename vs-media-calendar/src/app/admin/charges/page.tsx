export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { formatPrice } from "@/lib/pricing"
import { CHARGE_OVERDUE_DAYS } from "@/lib/charges"
import { Video, Package, CheckCircle2, Clock, AlertCircle, Receipt } from "lucide-react"
import Link from "next/link"

function daysSince(d: Date) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
}

export default async function AdminChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const filter = status === "paid" ? "PAID" : "PENDING"

  const charges = await prisma.charge.findMany({
    where: { status: filter },
    include: {
      consultant: { select: { name: true, email: true } },
      booking: { select: { id: true, propertyAddress: true } },
      deliverable: { select: { bookingId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  })

  const total = charges.reduce((s, c) => s + c.totalAmount, 0)

  // Dívida acumulada por consultor
  const byConsultant = new Map<string, { name: string; count: number; total: number }>()
  if (filter === "PENDING") {
    for (const c of charges) {
      const name = c.consultant.name || c.consultant.email || "—"
      const e = byConsultant.get(name) ?? { name, count: 0, total: 0 }
      e.count++
      e.total = Math.round((e.total + c.totalAmount) * 100) / 100
      byConsultant.set(name, e)
    }
  }
  const debtors = [...byConsultant.values()].sort((a, b) => b.total - a.total)

  return (
    <>
      <Header
        title="Cobranças"
        subtitle={`${charges.length} ${filter === "PENDING" ? "por pagar" : "pagas"} · ${formatPrice(total)}`}
      />
      <div className="flex-1 p-6 space-y-6">

        <div className="flex items-center gap-2">
          {[
            { key: "pending", label: "Por pagar" },
            { key: "paid", label: "Pagas" },
          ].map((t) => (
            <a
              key={t.key}
              href={`/admin/charges?status=${t.key}`}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                (t.key === "paid" ? "PAID" : "PENDING") === filter
                  ? "bg-[#0f3460] text-white border-[#0f3460]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-[#0f3460]"
              }`}
            >
              {t.label}
            </a>
          ))}
        </div>

        {filter === "PENDING" && debtors.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <h3 className="font-bold text-slate-900 text-sm">Em dívida por consultor</h3>
              </div>
              <p className="text-sm font-bold text-red-600">{formatPrice(total)}</p>
            </div>
            <div className="divide-y divide-slate-50">
              {debtors.map((d) => (
                <div key={d.name} className="px-6 py-3 flex items-center gap-3">
                  <p className="font-semibold text-slate-800 text-sm flex-1">{d.name}</p>
                  <p className="text-xs text-slate-400">{d.count} vídeo(s)</p>
                  <p className="text-sm font-bold text-slate-900 w-24 text-right">{formatPrice(d.total)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {charges.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Sem cobranças {filter === "PENDING" ? "por pagar" : "pagas"}.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
            {charges.map((c) => {
              const age = daysSince(c.createdAt)
              const stale = filter === "PENDING" && age >= CHARGE_OVERDUE_DAYS
              const bookingId = c.booking?.id ?? c.deliverable?.bookingId
              return (
                <div key={c.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                  {c.kind === "INTRO"
                    ? <Package className="w-4 h-4 text-pink-400 flex-shrink-0" />
                    : <Video className="w-4 h-4 text-[#0f3460] flex-shrink-0" />}
                  <div className="flex-1 min-w-[200px]">
                    {bookingId ? (
                      <Link href={`/admin/bookings/${bookingId}`} className="text-sm font-medium text-slate-800 hover:text-[#0f3460] hover:underline">
                        {c.description}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-slate-800">{c.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {c.consultant.name || c.consultant.email}
                      {" · "}
                      {new Date(c.createdAt).toLocaleDateString("pt-PT")}
                      {filter === "PENDING" && ` · há ${age} dia${age === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  {stale && (
                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-semibold border border-red-200">
                      Bloqueia marcações
                    </span>
                  )}
                  {c.status === "PAID" && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {c.moloniDocumentId ? `Moloni #${c.moloniDocumentId}` : "Pago"}
                    </span>
                  )}
                  {c.status === "PENDING" && (
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <div className="text-right w-24">
                    <p className="text-sm font-bold text-slate-900">{formatPrice(c.totalAmount)}</p>
                    <p className="text-[11px] text-slate-400">{formatPrice(c.netAmount)} s/ IVA</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
