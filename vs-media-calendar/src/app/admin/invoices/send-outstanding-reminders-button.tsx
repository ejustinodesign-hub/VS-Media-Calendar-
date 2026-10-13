"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, Send, CheckCircle2, Loader2, AlertCircle } from "lucide-react"

interface Props {
  debtorCount: number
  totalDebt: number
}

// Envia a cada consultor um email com TODAS as faturas por pagar e o total.
// Pré-visualização primeiro — manda um exemplo só para o admin.
export function SendOutstandingRemindersButton({ debtorCount, totalDebt }: Props) {
  const [state, setState] = useState<"idle" | "preview-loading" | "preview-done" | "sending" | "done">("idle")
  const [previewTo, setPreviewTo] = useState<string | null>(null)
  const [result, setResult] = useState<{ sent: number; skipped: number; noEmail?: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  if (debtorCount === 0) return null

  async function call(preview: boolean) {
    setState(preview ? "preview-loading" : "sending")
    setError(null)
    try {
      const res = await fetch("/api/admin/invoices/send-outstanding-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      if (preview) {
        setPreviewTo(data.sentTo)
        setState("preview-done")
      } else {
        setResult({ sent: data.sent, skipped: data.skipped, noEmail: data.noEmail })
        setState("done")
        router.refresh()
      }
    } catch (e: any) {
      setError(e.message)
      setState("idle")
    }
  }

  if (state === "done" && result) {
    return (
      <div className="flex items-start gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold">{result.sent} lembrete(s) enviado(s).</p>
          {result.skipped > 0 && (
            <p className="text-amber-700 mt-0.5">
              {result.skipped} não enviado(s)
              {result.noEmail?.length ? ` — sem email: ${result.noEmail.join(", ")}` : ""}
            </p>
          )}
          <button onClick={() => setState("idle")} className="underline font-semibold mt-1">Fechar</button>
        </div>
      </div>
    )
  }

  if (state === "preview-done") {
    return (
      <div className="flex items-start gap-2 px-3 py-2 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-800 flex-wrap">
        <Mail className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-[200px]">
          <p>Exemplo enviado para <strong>{previewTo}</strong>. Confirme antes de enviar a todos.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setState("idle")}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-white"
          >
            Cancelar
          </button>
          <button
            onClick={() => call(false)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-[#0f3460] rounded-lg hover:bg-[#1a4a7a]"
          >
            <Send className="w-3 h-3" />
            Enviar a {debtorCount}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => call(true)}
        disabled={state === "preview-loading" || state === "sending"}
        title="Envia primeiro um exemplo para o seu email"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
      >
        {state === "preview-loading" || state === "sending"
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Mail className="w-3.5 h-3.5" />}
        {state === "preview-loading" ? "A preparar..." : state === "sending" ? "A enviar..." : "Enviar lembretes de dívida"}
      </button>
      {error && (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </span>
      )}
    </div>
  )
}
