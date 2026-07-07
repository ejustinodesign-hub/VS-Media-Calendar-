"use client"

import { useState } from "react"
import { ExternalLink, CheckCircle2, Loader2, Trash2 } from "lucide-react"

interface Props {
  bookingId: string
  initialUrl: string | null
  soldAt: Date | null
}

export function RemaxWatch({ bookingId, initialUrl, soldAt: initialSoldAt }: Props) {
  const [url, setUrl] = useState(initialUrl || "")
  const [savedUrl, setSavedUrl] = useState(initialUrl)
  const [soldAt, setSoldAt] = useState(initialSoldAt)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function save(urlToSave: string) {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/remax-url`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remaxUrl: urlToSave }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      setSavedUrl(data.remaxUrl)
      setSoldAt(data.remaxSoldAt ? new Date(data.remaxSoldAt) : null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setUrl("")
    await save("")
  }

  return (
    <div className="space-y-2">
      {soldAt ? (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800">Imóvel vendido</p>
            <p className="text-xs text-emerald-600">
              Detectado a {new Date(soldAt).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          {savedUrl && (
            <a href={savedUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-800">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      ) : savedUrl ? (
        <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700">A monitorizar anúncio</p>
            <a
              href={savedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#0f3460] hover:underline truncate block max-w-xs"
            >
              {savedUrl}
            </a>
          </div>
          <button
            onClick={remove}
            disabled={saving}
            className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
            title="Remover"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      {!savedUrl && (
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://remax.pt/pt/imoveis/…"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#0f3460] placeholder-slate-400"
          />
          <button
            onClick={() => save(url)}
            disabled={saving || !url.trim()}
            className="px-3 py-2 bg-[#0f3460] text-white text-sm font-semibold rounded-lg hover:bg-[#1a4a7a] disabled:opacity-50 transition-colors flex items-center gap-1.5 flex-shrink-0"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {saving ? "A guardar…" : "Guardar"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-emerald-600">URL guardado. Será verificado automaticamente.</p>}
    </div>
  )
}
