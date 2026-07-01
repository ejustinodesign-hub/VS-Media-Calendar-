"use client"

import { useState } from "react"
import { Mail, Send, CheckCircle2, Loader2 } from "lucide-react"

export function SendRemindersButton({ month, unpaidCount }: { month: string; unpaidCount: number }) {
  const [state, setState] = useState<"idle" | "preview-loading" | "preview-done" | "sending" | "done">("idle")
  const [previewInfo, setPreviewInfo] = useState<string | null>(null)
  const [result, setResult] = useState<{ sent: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (unpaidCount === 0) return null

  async function sendPreview() {
    setState("preview-loading")
    setError(null)
    try {
      const res = await fetch("/api/admin/invoices/send-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, preview: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      setPreviewInfo(data.sentTo)
      setState("preview-done")
    } catch (e: any) {
      setError(e.message)
      setState("idle")
    }
  }

  async function sendAll() {
    setState("sending")
    setError(null)
    try {
      const res = await fetch("/api/admin/invoices/send-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, preview: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      setResult(data)
      setState("done")
    } catch (e: any) {
      setError(e.message)
      setState("preview-done")
    }
  }

  if (state === "done" && result) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
        <CheckCircle2 className="w-4 h-4" />
        {result.sent} lembrete{result.sent !== 1 ? "s" : ""} enviado{result.sent !== 1 ? "s" : ""}
        {result.skipped > 0 && <span className="text-slate-400 font-normal">({result.skipped} sem email)</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      {state === "idle" && (
        <button
          onClick={sendPreview}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:border-[#0f3460] hover:text-[#0f3460] transition-colors bg-white"
        >
          <Mail className="w-4 h-4" />
          Enviar lembretes ({unpaidCount})
        </button>
      )}

      {state === "preview-loading" && (
        <button disabled className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-400 border border-slate-200 rounded-lg bg-white">
          <Loader2 className="w-4 h-4 animate-spin" />
          A enviar exemplar…
        </button>
      )}

      {state === "preview-done" && (
        <div className="flex flex-col gap-2 items-end">
          <p className="text-xs text-emerald-700 font-medium">
            ✓ Exemplar enviado para {previewInfo}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setState("idle")}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={sendAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar a todos ({unpaidCount})
            </button>
          </div>
        </div>
      )}

      {state === "sending" && (
        <button disabled className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin" />
          A enviar…
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
