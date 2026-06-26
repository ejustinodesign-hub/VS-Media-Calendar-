"use client"

import { useState } from "react"
import { formatPrice } from "@/lib/pricing"
import { Calculator, Video, Camera, Gift, Loader2, X, TrendingDown, TrendingUp } from "lucide-react"

interface SimResult {
  id: string
  name: string | null
  email: string | null
  currentBaseSalary: number
  standardCount: number
  droneCount: number
  photoCount: number
  introCount: number
  videoTotal: number
  photoTotal: number
  introTotal: number
  newTotal: number
}

interface SimData {
  month: string
  rates: { standard: number; drone: number; photo: number; intro: number }
  results: SimResult[]
  grandNewTotal: number
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

  const saving = data ? currentGrandTotal - data.grandNewTotal : 0
  const savingPct = currentGrandTotal > 0 && data ? Math.round((saving / currentGrandTotal) * 100) : 0

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

            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Simulação — sem avença, por serviço entregue</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Vídeo std {data.rates.standard}€ · Drone {data.rates.drone}€ · Foto {data.rates.photo}€ · Intro {data.rates.intro}€ · {data.month}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">Modelo atual (com avença)</p>
                  <p className="text-2xl font-bold text-slate-700">{formatPrice(currentGrandTotal)}</p>
                </div>
                <div className={`rounded-xl p-4 text-center flex flex-col items-center justify-center ${saving >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                  {saving >= 0
                    ? <TrendingDown className="w-5 h-5 text-emerald-500 mb-1" />
                    : <TrendingUp className="w-5 h-5 text-red-500 mb-1" />
                  }
                  <p className={`text-xl font-bold ${saving >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {saving >= 0 ? "-" : "+"}{formatPrice(Math.abs(saving))}
                  </p>
                  <p className={`text-xs font-medium ${saving >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {saving >= 0 ? `poupança de ${savingPct}%` : `custo extra de ${Math.abs(savingPct)}%`}
                  </p>
                </div>
                <div className="bg-[#0f3460]/5 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">Modelo novo (por serviço)</p>
                  <p className="text-2xl font-bold text-[#0f3460]">{formatPrice(data.grandNewTotal)}</p>
                </div>
              </div>

              {/* Per-videographer table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-100">
                      <th className="text-left pb-2 font-medium">Videógrafo</th>
                      <th className="text-center pb-2 font-medium">
                        <span className="inline-flex items-center gap-1"><Video className="w-3 h-3" /> Std</span>
                      </th>
                      <th className="text-center pb-2 font-medium">
                        <span className="inline-flex items-center gap-1"><Video className="w-3 h-3 text-blue-400" /> Drone</span>
                      </th>
                      <th className="text-center pb-2 font-medium">
                        <span className="inline-flex items-center gap-1"><Camera className="w-3 h-3 text-violet-400" /> Fotos</span>
                      </th>
                      <th className="text-center pb-2 font-medium">
                        <span className="inline-flex items-center gap-1"><Gift className="w-3 h-3 text-pink-400" /> Intros</span>
                      </th>
                      <th className="text-right pb-2 font-medium">Atual</th>
                      <th className="text-right pb-2 font-medium">Novo</th>
                      <th className="text-right pb-2 font-medium">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((r) => {
                      const rowDiff = r.currentBaseSalary - r.newTotal
                      return (
                        <tr key={r.id} className="border-b border-slate-50">
                          <td className="py-3 font-medium text-slate-800">{r.name || r.email}</td>
                          <td className="py-3 text-center text-slate-500">{r.standardCount}</td>
                          <td className="py-3 text-center text-slate-500">{r.droneCount}</td>
                          <td className="py-3 text-center text-slate-500">{r.photoCount}</td>
                          <td className="py-3 text-center text-slate-500">{r.introCount}</td>
                          <td className="py-3 text-right text-slate-500">{formatPrice(r.currentBaseSalary)}</td>
                          <td className="py-3 text-right font-semibold text-slate-800">{formatPrice(r.newTotal)}</td>
                          <td className={`py-3 text-right text-xs font-semibold ${rowDiff >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {rowDiff >= 0 ? "-" : "+"}{formatPrice(Math.abs(rowDiff))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200">
                      <td colSpan={5} className="pt-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Total</td>
                      <td className="pt-3 text-right font-semibold text-slate-500">{formatPrice(currentGrandTotal)}</td>
                      <td className="pt-3 text-right font-bold text-[#0f3460]">{formatPrice(data.grandNewTotal)}</td>
                      <td className={`pt-3 text-right text-sm font-bold ${saving >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {saving >= 0 ? "-" : "+"}{formatPrice(Math.abs(saving))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="text-xs text-slate-400 text-center">
                Sem avença · vídeos standard + drone às novas taxas · fotos e intros às taxas atuais (10€)
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
