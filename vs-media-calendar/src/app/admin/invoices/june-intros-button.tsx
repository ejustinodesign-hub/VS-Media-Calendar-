"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Users, CheckCircle2, AlertCircle } from "lucide-react"

export function JuneIntrosButton() {
  const [state, setState] = useState<"idle" | "confirm" | "loading" | "done" | "error">("idle")
  const [message, setMessage] = useState("")
  const router = useRouter()

  async function run() {
    setState("loading")
    try {
      const res = await fetch("/api/admin/backfill-june-intros", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || "Erro desconhecido")
        setState("error")
        return
      }
      const notFound = data.notFound?.length ? ` (${data.notFound.length} consultor(es) não encontrado(s): ${data.notFound.join(", ")})` : ""
      setMessage(`${data.charged} intros adicionados e cobrados.${notFound}`)
      setState("done")
      router.refresh()
    } catch {
      setMessage("Erro de ligação.")
      setState("error")
    }
  }

  if (state === "done") {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        {message}
      </div>
    )
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {message}
      </div>
    )
  }

  if (state === "confirm") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-sm text-amber-800 font-medium flex-1">
          Adicionar 15 intros de junho a cobrar? Esta ação não pode ser desfeita.
        </p>
        <button
          onClick={() => setState("idle")}
          className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          onClick={run}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0f3460] rounded-lg hover:bg-[#1a4a7a]"
        >
          Confirmar
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setState("confirm")}
      disabled={state === "loading"}
      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-violet-200 bg-violet-50 text-sm font-semibold text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50"
    >
      <Users className="w-4 h-4" />
      {state === "loading" ? "A processar..." : "Adicionar intros de junho"}
    </button>
  )
}
