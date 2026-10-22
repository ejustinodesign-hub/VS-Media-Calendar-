"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, FilePen } from "lucide-react"

type Mode = "issue" | "draft"

export function MoloniBackfillButton({ invoiceId }: { invoiceId: string }) {
  const [loading, setLoading] = useState<Mode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Mode | null>(null)
  const router = useRouter()

  async function handleCreate(mode: Mode) {
    if (loading || done) return
    setLoading(mode)
    setError(null)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/moloni-backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: mode === "draft" }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `Erro ${res.status}`)
        return
      }
      setDone(mode)
      router.refresh()
    } catch {
      setError("Erro de ligação. Tente novamente.")
    } finally {
      setLoading(null)
    }
  }

  if (done) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
        <FileText className="w-3.5 h-3.5" />
        {done === "draft" ? "Rascunho criado no Moloni" : "Documento criado no Moloni"}
      </span>
    )
  }

  const btn =
    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:border-[#0f3460] hover:text-[#0f3460] transition-colors disabled:opacity-50 bg-white"

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button onClick={() => handleCreate("draft")} disabled={!!loading} className={btn}>
          <FilePen className="w-3.5 h-3.5" />
          {loading === "draft" ? "A criar rascunho..." : "Criar rascunho"}
        </button>
        <button onClick={() => handleCreate("issue")} disabled={!!loading} className={btn}>
          <FileText className="w-3.5 h-3.5" />
          {loading === "issue" ? "A criar no Moloni..." : "Emitir no Moloni"}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  )
}
