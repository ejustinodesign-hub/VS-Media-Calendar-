"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Users, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react"

type State = "idle" | "confirm" | "loading" | "done" | "error"
        | "fix-confirm" | "fix-loading" | "fix-done"

export function JuneIntrosButton() {
  const [state, setState] = useState<State>("idle")
  const [message, setMessage] = useState("")
  const router = useRouter()

  async function runBackfill() {
    setState("loading")
    try {
      const res = await fetch("/api/admin/backfill-june-intros", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || "Erro desconhecido")
        setState("error")
        return
      }
      const extra = data.notFound?.length ? ` · ${data.notFound.length} não encontrado(s): ${data.notFound.join(", ")}` : ""
      setMessage(`${data.charged} intros adicionados.${extra}`)
      setState("done")
      router.refresh()
    } catch {
      setMessage("Erro de ligação.")
      setState("error")
    }
  }

  async function runFix() {
    setState("fix-loading")
    try {
      const res = await fetch("/api/admin/backfill-june-intros", { method: "PATCH" })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || "Erro desconhecido")
        setState("error")
        return
      }
      if (data.moved.length === 0) {
        setMessage("Nenhuma fatura de junho paga encontrada para corrigir.")
        setState("fix-done")
        router.refresh()
      } else {
        // Redirecionar para julho para ver as faturas criadas
        router.push("/admin/invoices?month=2026-07")
      }
    } catch {
      setMessage("Erro de ligação.")
      setState("error")
    }
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {message}
      </div>
    )
  }

  if (state === "done" || state === "fix-done") {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        {message}
      </div>
    )
  }

  if (state === "confirm") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-sm text-amber-800 font-medium flex-1">
          Adicionar 15 intros de junho (25€ cada)? Não pode ser desfeito.
        </p>
        <button onClick={() => setState("idle")} className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          Cancelar
        </button>
        <button onClick={runBackfill} className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0f3460] rounded-lg hover:bg-[#1a4a7a]">
          Confirmar
        </button>
      </div>
    )
  }

  if (state === "fix-confirm") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-sm text-amber-800 font-medium flex-1">
          Mover intros de consultores com junho já pago para a fatura de julho?
        </p>
        <button onClick={() => setState("idle")} className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          Cancelar
        </button>
        <button onClick={runFix} className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0f3460] rounded-lg hover:bg-[#1a4a7a]">
          Confirmar
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setState("confirm")}
        disabled={state === "loading"}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-violet-200 bg-violet-50 text-sm font-semibold text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50"
      >
        <Users className="w-4 h-4" />
        {state === "loading" ? "A processar..." : "Adicionar intros de junho"}
      </button>
      <button
        onClick={() => setState("fix-confirm")}
        disabled={state === "fix-loading"}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:border-slate-300 transition-colors disabled:opacity-50"
        title="Move intros para julho nos consultores que já pagaram junho"
      >
        <ArrowRight className="w-4 h-4" />
        {state === "fix-loading" ? "A corrigir..." : "Corrigir junho pago → julho"}
      </button>
    </div>
  )
}
