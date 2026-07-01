"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileText } from "lucide-react"

export function MoloniBackfillButton({ invoiceId }: { invoiceId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function handleBackfill() {
    if (loading || done) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/moloni-backfill`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `Erro ${res.status}`)
        return
      }
      setDone(true)
      router.refresh()
    } catch {
      setError("Erro de ligação. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
        <FileText className="w-3.5 h-3.5" />
        Documento criado no Moloni
      </span>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleBackfill}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:border-[#0f3460] hover:text-[#0f3460] transition-colors disabled:opacity-50 bg-white"
      >
        <FileText className="w-3.5 h-3.5" />
        {loading ? "A criar no Moloni..." : "Emitir no Moloni"}
      </button>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  )
}
