"use client"

import { useState } from "react"
import { CreditCard, Loader2, AlertCircle, Video, Package } from "lucide-react"

export interface PendingCharge {
  id: string
  kind: "BOOKING" | "INTRO"
  description: string
  netAmount: number
  totalAmount: number
  createdAt: string
}

function fmt(n: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n)
}

/**
 * Cobranças por pagar, vídeo a vídeo. O consultor pode pagar uma de cada vez
 * ou todas de uma vez — o download do ficheiro final abre com o pagamento.
 */
export function PendingChargesList({ charges }: { charges: PendingCharge[] }) {
  const [paying, setPaying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (charges.length === 0) return null

  const total = charges.reduce((s, c) => s + c.totalAmount, 0)

  async function pay(ids: string[], key: string) {
    setPaying(key)
    setError(null)
    try {
      const res = await fetch("/api/charges/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeIds: ids }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || `Erro ${res.status}`); return }
      if (data.checkoutUrl) { window.location.href = data.checkoutUrl; return }
      setError("Não foi possível iniciar o pagamento.")
    } catch {
      setError("Erro de ligação.")
    } finally {
      setPaying(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Por pagar ({charges.length})</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cada vídeo é pago individualmente. O download abre assim que o pagamento for confirmado.
          </p>
        </div>
        <button
          onClick={() => pay(charges.map((c) => c.id), "all")}
          disabled={paying !== null}
          className="flex items-center gap-2 px-4 py-2 bg-[#0f3460] text-white text-sm font-semibold rounded-xl hover:bg-[#1a4a7a] disabled:opacity-50 transition-colors"
        >
          {paying === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          Pagar tudo · {fmt(total)}
        </button>
      </div>

      {error && (
        <div className="px-5 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="divide-y divide-slate-50">
        {charges.map((c) => (
          <div key={c.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
            {c.kind === "INTRO"
              ? <Package className="w-4 h-4 text-pink-400 flex-shrink-0" />
              : <Video className="w-4 h-4 text-[#0f3460] flex-shrink-0" />}
            <div className="flex-1 min-w-[180px]">
              <p className="text-sm font-medium text-slate-800">{c.description}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(c.createdAt).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })}
                {c.kind === "INTRO" ? " · intro" : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">{fmt(c.totalAmount)}</p>
              <p className="text-[11px] text-slate-400">{fmt(c.netAmount)} s/ IVA</p>
            </div>
            <button
              onClick={() => pay([c.id], c.id)}
              disabled={paying !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#0f3460] text-[#0f3460] text-xs font-semibold rounded-lg hover:bg-[#0f3460] hover:text-white disabled:opacity-50 transition-colors"
            >
              {paying === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
              Pagar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
