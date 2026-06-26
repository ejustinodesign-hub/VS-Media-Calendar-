"use client"

import { useState } from "react"
import { formatPrice } from "@/lib/pricing"
import { Calculator, Video, Camera, Gift, Loader2, X, TrendingDown, TrendingUp, Euro } from "lucide-react"

interface SimResult {
  id: string
  name: string | null
  email: string | null
  currentBaseSalary: number
  standardCount: number
  droneCount: number
  photoCount: number
  introCount: number
  currentTotal: number
  newTotal: number
}

interface SimData {
  month: string
  rates: { standard: number; drone: number; photo: number; intro: number }
  revenue: {
    services: number
    travel: number
    bookingIntros: number
    sharedIntros: number
    total: number
  }
  results: SimResult[]
  grandCurrentTotal: number
  grandNewTotal: number
  profitCurrent: number
  profitNew: number
}

function DiffBadge({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = invert ? value <= 0 : value >= 0
  return (
    <span className={`text-xs font-semibold ${positive ? "text-emerald-600" : "text-red-600"}`}>
      {value >= 0 ? "+" : ""}{formatPrice(value)}
    </span>
  )
}

export function SimulationPanel({ currentGrandTotal }: { currentGrandTotal: number }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SimData | null>(null)
  const [error, setError] = useState("")

  async function run() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/admin/remuneration/simulate")
      if (!res.ok) throw new Error("Erro ao simular")
      setData(await res.json())
      setOpen(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={run}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-medium text-white hover:bg-white/20 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
        Simulação por vídeo
      </button>

      {error && <p className="text-xs text-red-300">{error}</p>}

      {open && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Simulação — sem avença, por serviço</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Vídeo std {data.rates.standard}€ · Drone {data.rates.drone}€ · Foto {data.rates.photo}€ · Intro {data.rates.intro}€ · {data.month}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">

              {/* Revenue breakdown */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Euro className="w-3.5 h-3.5" /> Receita da empresa este mês (líquida s/ IVA)
                </p>
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Serviços (vídeo, foto, IA…)</span>
                    <span className="font-medium text-slate-800">{formatPrice(data.revenue.services)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Deslocações</span>
                    <span className="font-medium text-slate-800">{formatPrice(data.revenue.travel)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Intros (marcação)</span>
                    <span className="font-medium text-slate-800">{formatPrice(data.revenue.bookingIntros)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Intros partilhadas (entregues)</span>
                    <span className="font-medium text-slate-800">{formatPrice(data.revenue.sharedIntros)}</span>
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-slate-700">Total receita</span>
                    <span className="text-slate-900">{formatPrice(data.revenue.total)}</span>
                  </div>
                </div>
              </div>

              {/* Profit comparison */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Lucro da empresa</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-slate-400 font-medium">Modelo atual (com avença)</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Receita</span>
                      <span>{formatPrice(data.revenue.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Custo videógrafos</span>
                      <span className="text-red-600">− {formatPrice(data.grandCurrentTotal)}</span>
                    </div>
                    <div className="h-px bg-slate-100" />
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-700">Lucro</span>
                      <span className={data.profitCurrent >= 0 ? "text-emerald-600" : "text-red-600"}>
                        {formatPrice(data.profitCurrent)}
                      </span>
                    </div>
                    {data.revenue.total > 0 && (
                      <p className="text-xs text-slate-400 text-right">
                        margem {Math.round((data.profitCurrent / data.revenue.total) * 100)}%
                      </p>
                    )}
                  </div>

                  <div className="border-2 border-[#0f3460] rounded-xl p-4 space-y-2">
                    <p className="text-xs text-[#0f3460] font-semibold">Modelo novo (sem avença)</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Receita</span>
                      <span>{formatPrice(data.revenue.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Custo videógrafos</span>
                      <span className="text-red-600">− {formatPrice(data.grandNewTotal)}</span>
                    </div>
                    <div className="h-px bg-slate-100" />
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-700">Lucro</span>
                      <span className={data.profitNew >= 0 ? "text-emerald-600" : "text-red-600"}>
                        {formatPrice(data.profitNew)}
                      </span>
                    </div>
                    {data.revenue.total > 0 && (
                      <p className="text-xs text-slate-400 text-right">
                        margem {Math.round((data.profitNew / data.revenue.total) * 100)}%
                      </p>
                    )}
                  </div>
                </div>

                {/* Diff callout */}
                <div className={`mt-3 rounded-xl px-4 py-3 flex items-center justify-between ${data.profitNew >= data.profitCurrent ? "bg-emerald-50" : "bg-red-50"}`}>
                  <span className="text-sm font-medium text-slate-600">
                    {data.profitNew >= data.profitCurrent ? "Melhoria de lucro no modelo novo" : "Redução de lucro no modelo novo"}
                  </span>
                  <span className={`text-base font-bold ${data.profitNew >= data.profitCurrent ? "text-emerald-600" : "text-red-600"}`}>
                    {data.profitNew >= data.profitCurrent ? "+" : ""}{formatPrice(data.profitNew - data.profitCurrent)}
                  </span>
                </div>
              </div>

              {/* Per-videographer table */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Custo por videógrafo</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 border-b border-slate-100">
                        <th className="text-left pb-2 font-medium">Videógrafo</th>
                        <th className="text-center pb-2 font-medium">
                          <span className="inline-flex items-center gap-1"><Video className="w-3 h-3" />Std</span>
                        </th>
                        <th className="text-center pb-2 font-medium">
                          <span className="inline-flex items-center gap-1"><Video className="w-3 h-3 text-blue-400" />Drone</span>
                        </th>
                        <th className="text-center pb-2 font-medium">
                          <span className="inline-flex items-center gap-1"><Camera className="w-3 h-3 text-violet-400" />Foto</span>
                        </th>
                        <th className="text-center pb-2 font-medium">
                          <span className="inline-flex items-center gap-1"><Gift className="w-3 h-3 text-pink-400" />Intro</span>
                        </th>
                        <th className="text-right pb-2 font-medium">Atual</th>
                        <th className="text-right pb-2 font-medium">Novo</th>
                        <th className="text-right pb-2 font-medium">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.results.map((r) => (
                        <tr key={r.id} className="border-b border-slate-50">
                          <td className="py-2.5 font-medium text-slate-800">{r.name || r.email}</td>
                          <td className="py-2.5 text-center text-slate-500">{r.standardCount}</td>
                          <td className="py-2.5 text-center text-slate-500">{r.droneCount}</td>
                          <td className="py-2.5 text-center text-slate-500">{r.photoCount}</td>
                          <td className="py-2.5 text-center text-slate-500">{r.introCount}</td>
                          <td className="py-2.5 text-right text-slate-500">{formatPrice(r.currentTotal)}</td>
                          <td className="py-2.5 text-right font-semibold text-slate-800">{formatPrice(r.newTotal)}</td>
                          <td className="py-2.5 text-right">
                            <DiffBadge value={r.newTotal - r.currentTotal} invert />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200">
                        <td colSpan={5} className="pt-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Total custo</td>
                        <td className="pt-2.5 text-right font-semibold text-slate-500">{formatPrice(data.grandCurrentTotal)}</td>
                        <td className="pt-2.5 text-right font-bold text-[#0f3460]">{formatPrice(data.grandNewTotal)}</td>
                        <td className="pt-2.5 text-right">
                          <DiffBadge value={data.grandNewTotal - data.grandCurrentTotal} invert />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <p className="text-xs text-slate-400 text-center">
                Receita líquida s/ IVA · custos videógrafos sem IVA · modelo novo sem avença
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
