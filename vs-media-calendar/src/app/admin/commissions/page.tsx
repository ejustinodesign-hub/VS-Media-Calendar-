export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { formatPrice } from "@/lib/pricing"
import { RemaxWatch } from "../bookings/[id]/remax-watch"
import { Percent, MapPin, ExternalLink, CheckCircle2, Clock, Eye, EyeOff, TrendingUp } from "lucide-react"
import Link from "next/link"

// Estado de cada marcação em comissão, do mais adiantado para o mais atrasado
type Stage = "REGISTERED" | "SOLD" | "WATCHING" | "NO_LISTING"

const STAGE_CONFIG: Record<Stage, { label: string; color: string; dot: string }> = {
  REGISTERED:  { label: "Venda registada",   color: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  SOLD:        { label: "Vendido — por registar", color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  WATCHING:    { label: "A monitorizar",     color: "text-sky-700 bg-sky-50 border-sky-200",             dot: "bg-sky-500" },
  NO_LISTING:  { label: "Sem anúncio",       color: "text-slate-600 bg-slate-100 border-slate-200",      dot: "bg-slate-400" },
}

export default async function AdminCommissionsPage() {
  const bookings = await prisma.booking.findMany({
    where: { paymentType: "COMMISSION", status: { notIn: ["CANCELLED", "REJECTED"] } },
    include: {
      consultant: { select: { name: true, email: true, image: true } },
      videographer: { select: { name: true } },
    },
    orderBy: { scheduledAt: "desc" },
  })

  function stageOf(b: (typeof bookings)[number]): Stage {
    if (b.salePrice) return "REGISTERED"
    if (b.remaxSoldAt) return "SOLD"
    if (b.remaxUrl) return "WATCHING"
    return "NO_LISTING"
  }

  const rows = bookings.map((b) => ({ booking: b, stage: stageOf(b) }))

  // Ordenar: por registar primeiro (ação necessária), depois a monitorizar,
  // sem anúncio, e por fim as já registadas
  const STAGE_ORDER: Record<Stage, number> = { SOLD: 0, WATCHING: 1, NO_LISTING: 2, REGISTERED: 3 }
  rows.sort((a, b) =>
    STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] ||
    b.booking.scheduledAt.getTime() - a.booking.scheduledAt.getTime()
  )

  const counts = {
    REGISTERED: rows.filter((r) => r.stage === "REGISTERED").length,
    SOLD:       rows.filter((r) => r.stage === "SOLD").length,
    WATCHING:   rows.filter((r) => r.stage === "WATCHING").length,
    NO_LISTING: rows.filter((r) => r.stage === "NO_LISTING").length,
  }
  const commissionEarned = rows
    .filter((r) => r.stage === "REGISTERED")
    .reduce((s, r) => s + (r.booking.commissionAmount ?? 0), 0)

  return (
    <>
      <Header
        title="Comissões"
        subtitle={`${rows.length} vídeo(s) em modo comissão`}
      />
      <div className="flex-1 p-6 space-y-6">

        {/* Resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} label="Venda registada"
            value={counts.REGISTERED} sub={`${formatPrice(commissionEarned)} em comissões`} color="text-emerald-600" />
          <SummaryCard icon={<Clock className="w-4 h-4 text-amber-500" />} label="Vendido — por registar"
            value={counts.SOLD} sub="Aguarda valor de venda" color="text-amber-600" />
          <SummaryCard icon={<Eye className="w-4 h-4 text-sky-500" />} label="A monitorizar"
            value={counts.WATCHING} sub="Anúncio em observação" color="text-sky-600" />
          <SummaryCard icon={<EyeOff className="w-4 h-4 text-slate-400" />} label="Sem anúncio"
            value={counts.NO_LISTING} sub="Falta link Remax" color="text-slate-600" />
        </div>

        {rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
            <Percent className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum vídeo em modo comissão.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(({ booking: b, stage }) => {
              const cfg = STAGE_CONFIG[stage]
              const rate = b.commissionRate ?? 0.0015
              return (
                <div key={b.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  {/* Cabeçalho */}
                  <div className="px-5 py-4 flex items-start gap-4 flex-wrap border-b border-slate-50">
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <Link
                          href={`/admin/bookings/${b.id}`}
                          className="text-sm font-bold text-slate-900 hover:text-[#0f3460] hover:underline truncate"
                        >
                          {b.propertyAddress}
                        </Link>
                      </div>
                      <p className="text-xs text-slate-400 ml-5">
                        {b.consultant.name || b.consultant.email}
                        {" · "}
                        {new Date(b.scheduledAt).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })}
                        {b.videographer.name ? ` · ${b.videographer.name}` : ""}
                      </p>
                    </div>

                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${cfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </div>

                    <div className="text-right min-w-[110px]">
                      {b.salePrice ? (
                        <>
                          <p className="text-sm font-bold text-emerald-600">
                            {formatPrice(b.commissionAmount ?? Math.round(b.salePrice * rate * 100) / 100)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {(rate * 100).toFixed(2)}% de {formatPrice(b.salePrice)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-slate-400">—</p>
                          <p className="text-xs text-slate-400">{(rate * 100).toFixed(2)}% da venda</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Anúncio */}
                  <div className="px-5 py-3 bg-slate-50/60">
                    {stage === "SOLD" && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 font-medium">
                        Imóvel detectado como vendido a{" "}
                        {new Date(b.remaxSoldAt!).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })}.
                        O consultor ainda não registou o valor de venda — a comissão só é cobrada depois disso.
                      </p>
                    )}
                    {stage === "REGISTERED" && b.remaxUrl && (
                      <a
                        href={b.remaxUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#0f3460] hover:underline mb-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver anúncio na Remax
                      </a>
                    )}
                    {stage !== "REGISTERED" && (
                      <RemaxWatch
                        bookingId={b.id}
                        initialUrl={b.remaxUrl ?? null}
                        soldAt={b.remaxSoldAt ? new Date(b.remaxSoldAt) : null}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          Os anúncios com link são verificados automaticamente 3× por dia. Quando um imóvel passa a vendido, recebe um email.
        </p>

      </div>
    </>
  )
}

function SummaryCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: number; sub: string; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-slate-500 font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  )
}
