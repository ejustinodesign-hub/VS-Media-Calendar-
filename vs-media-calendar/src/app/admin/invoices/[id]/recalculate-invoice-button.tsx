"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { formatPrice } from "@/lib/pricing"

export function RecalculateInvoiceButton({ invoiceId, month }: { invoiceId: string; month: string }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const router = useRouter()

  async function run() {
    setLoading(true)
    setMessage(null)
    setError(false)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/recalculate`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setError(true)
        setMessage(data.error || `Erro ${res.status}`)
        return
      }
      if (data.deleted) {
        // A fatura ficou sem valor e foi apagada — voltar à lista
        router.push(`/admin/invoices?month=${month}`)
        return
      }
      setMessage(
        data.before === data.after
          ? "Valor já estava correto."
          : `${formatPrice(data.before)} → ${formatPrice(data.after)}`
      )
      router.refresh()
    } catch {
      setError(true)
      setMessage("Erro de ligação. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:border-[#0f3460] hover:text-[#0f3460] transition-colors disabled:opacity-50 bg-white"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "A recalcular…" : "Recalcular esta fatura"}
      </button>
      {message && <p className={`text-[11px] ${error ? "text-red-500" : "text-emerald-600"}`}>{message}</p>}
    </div>
  )
}
