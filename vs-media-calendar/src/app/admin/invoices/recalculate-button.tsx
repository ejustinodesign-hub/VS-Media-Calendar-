"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

export function RecalculateButton({ month }: { month: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const router = useRouter()

  const run = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/invoices/recalculate?month=${month}`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setResult(`Erro: ${data.error}`)
      } else {
        const paid = data.skippedPaid ? ` · ${data.skippedPaid} paga(s) não alterada(s)` : ""
        setResult(`Recalculado: ${data.updated} atualizada(s), ${data.created} criada(s)${paid} — ${data.consultants} consultor(es)`)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={run}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 bg-white hover:border-[#0f3460] hover:text-[#0f3460] transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "A recalcular…" : "Recalcular faturas"}
      </button>
      {result && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
          {result}
        </p>
      )}
    </div>
  )
}
