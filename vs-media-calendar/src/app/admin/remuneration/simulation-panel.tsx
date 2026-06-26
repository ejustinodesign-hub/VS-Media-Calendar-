"use client"

import { useState } from "react"
import { formatPrice } from "@/lib/pricing"
import { Calculator, Video, Camera, Gift, Loader2, X, Euro } from "lucide-react"

interface SimResult {
  id: string
  name: string | null
  email: string | null
  currentTotal: number
  newTotal: number
  standardCount: number
  droneCount: number
  photoCount: number
  introCount: number
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Simulação — sem avença, por serviço entregue</h2>
                <p className="text-xs text-slate-400 mt-0.5">{data.month}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* HERO — profit comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-2xl p-5 text-center">
                  <p className="text-xs text-slate-400 font-medium mb-2">Lucro este mês<br/><span className="font-normal">modelo atual (com avença)</span></p>
                  <p className={`text-3xl font-bold ${data.profitCurrent >= 0 ? "text-slate-800" : "text-red-600"}`}>
                    {formatPrice(data.profitCurrent)}
                  </p>
                  {data.revenue.total > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      margem {Math.round((data.profitCurrent / data.revenue.total) * 100)}%
                    </p>
                  )}
                </div>
                <div className="bg-[#0f3460] rounded-2xl p-5 text-center">
                  <p className="text-xs text-slate-300 font-medium mb-2">Lucro este mês<br/><span className="font-normal">modelo novo (sem avença)</span></p>
                  <p className={`text-3xl font-bold ${data.profitNew >= 0 ? "text-white" : "text-red-300"}`}>
                    {formatPrice(data.profitNew)}
                  </p>
                  {data.revenue.total > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      margem {Math.round((data.profitNew / data.revenue.total) * 100)}%
                    </p>
                  )}
                </div>
              </div>

              {/* Diff callout */}
              {(() => {
                const diff = data.profitNew - data.profitCurrent
                return (
                  <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${diff >= 0 ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
                    <span className="text-sm text-slate-600">
                      {diff >= 0 ? "O modelo novo traria mais lucro" : "O modelo novo reduziria o lucro"}
                    </span>
                    <span className={`text-base font-bold ${diff >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {diff >= 0 ? "+" : ""}{formatPrice(diff)}
                    </span>
                  </div>
                )
              })()}

              {/* Revenue breakdown */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Euro className="w-3.5 h-3.5" /> Receita líquida (s/ IVA)
                </p>
                <div className="bg-slate-50 rounded-xl divide-y divide-slate-100">
                  {[
                    { label: "Serviços (vídeo, foto, IA…)", value: data.revenue.services },
                    { label: "Deslocações", value: data.revenue.travel },
                    { label: "Intros de marcação", value: data.revenue.bookingIntros },
                    { label: "Intros partilhadas entregues", value: data.revenue.sharedIntros },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-medium text-slate-700">{formatPrice(value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-2.5 text-sm font-bold">
                    <span className="text-slate-700">Total receita</span>
                    <span className="text-slate-900">{formatPrice(data.revenue.total)}</span>
                  </div>
                </div>
              </div>

              {/* Cost breakdown */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Custo videógrafos</p>
                <div className="bg-slate-50 rounded-xl divide-y divide-slate-100">
                  <div className="flex justify-between px-4 py-2.5 text-sm">
                    <span className="text-slate-500">Modelo atual (avença + variável)</span>
                    <span className="font-medium text-slate-700">{formatPrice(data.grandCurrentTotal)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 text-sm font-bold">
                    <span className="text-slate-700">Modelo novo (só por serviço)</span>
                    <span className="text-[#0f3460]">{formatPrice(data.grandNewTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Per-videographer table */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Detalhe por videógrafo</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 border-b border-slate-100">
                        <th className="text-left pb-2 font-medium">Nome</th>
                        <th className="text-center pb-2 font-medium"><Video className="w-3 h-3 inline" /> Std</th>
                        <th className="text-center pb-2 font-medium"><Video className="w-3 h-3 inline text-blue-400" /> Drone</th>
                        <th className="text-center pb-2 font-medium"><Camera className="w-3 h-3 inline text-violet-400" /> Foto</th>
                        <th className="text-center pb-2 font-medium"><Gift className="w-3 h-3 inline text-pink-400" /> Intro</th>
                        <th className="text-right pb-2 font-medium">Atual</th>
                        <th className="text-right pb-2 font-medium">Novo</th>
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
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200">
                        <td colSpan={5} className="pt-2.5 text-xs font-semibold text-slate-400 uppercase">Total</td>
                        <td className="pt-2.5 text-right font-semibold text-slate-500">{formatPrice(data.grandCurrentTotal)}</td>
                        <td className="pt-2.5 text-right font-bold text-[#0f3460]">{formatPrice(data.grandNewTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <p className="text-xs text-slate-400 text-center">
                Vídeo std {data.rates.standard}€ · Drone {data.rates.drone}€ · Foto {data.rates.photo}€ · Intro {data.rates.intro}€ · sem avença
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
