"use client"

import { useState } from "react"
import { formatPrice } from "@/lib/pricing"
import { Calculator, Video, Loader2, X } from "lucide-react"

interface SimResult {
  id: string
  name: string | null
  email: string | null
  baseSalary: number
  standardCount: number
  droneCount: number
  simulatedVariable: number
  simulatedTotal: number
}

interface SimData {
  month: string
  rates: { standard: number; drone: number }
  results: SimResult[]
  grandTotal: number
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

  const diff = data ? data.grandTotal - currentGrandTotal : 0

  return (
    <>
      <button
        onClick={run}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
        Simulação por vídeo
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {open && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Simulação — remuneração por vídeo</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {data.rates.standard}€/vídeo standard · {data.rates.drone}€/vídeo drone · {data.month}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Grand total comparison */}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Modelo atual</p>
                  <p className="text-xl font-bold text-slate-700">{formatPrice(currentGrandTotal)}</p>
                </div>
                <div className="flex items-center justify-center">
                  <div className={`text-sm font-bold px-3 py-1 rounded-full ${diff >= 0 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}>
                    {diff >= 0 ? "+" : ""}{formatPrice(diff)}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Modelo novo</p>
                  <p className="text-xl font-bold text-[#0f3460]">{formatPrice(data.grandTotal)}</p>
                </div>
              </div>

              {/* Per-videographer breakdown */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100">
                    <th className="text-left pb-2 font-medium">Videógrafo</th>
                    <th className="text-center pb-2 font-medium">Std</th>
                    <th className="text-center pb-2 font-medium">Drone</th>
                    <th className="text-right pb-2 font-medium">Variável</th>
                    <th className="text-right pb-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50">
                      <td className="py-3 font-medium text-slate-800">{r.name || r.email}</td>
                      <td className="py-3 text-center text-slate-500">
                        <span className="flex items-center justify-center gap-1">
                          <Video className="w-3 h-3" /> {r.standardCount}
                        </span>
                      </td>
                      <td className="py-3 text-center text-slate-500">
                        <span className="flex items-center justify-center gap-1">
                          <Video className="w-3 h-3 text-blue-400" /> {r.droneCount}
                        </span>
                      </td>
                      <td className="py-3 text-right text-slate-600">{formatPrice(r.simulatedVariable)}</td>
                      <td className="py-3 text-right font-bold text-slate-900">{formatPrice(r.simulatedTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200">
                    <td colSpan={4} className="pt-3 text-sm font-semibold text-slate-500 uppercase tracking-wide">Total</td>
                    <td className="pt-3 text-right text-base font-bold text-[#0f3460]">{formatPrice(data.grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>

              <p className="text-xs text-slate-400 text-center">
                Salário base mantido · apenas vídeos contados · fotos, IA, deslocações e intros não incluídos
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
