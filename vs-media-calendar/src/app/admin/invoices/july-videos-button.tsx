"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Video, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react"

type State = "idle" | "confirm" | "loading" | "done" | "error"
        | "repair-confirm" | "repair-loading" | "repair-done"

export function JulyVideosButton() {
  const [state, setState] = useState<State>("idle")
  const [message, setMessage] = useState("")
  const router = useRouter()

  async function run(method: "POST" | "DELETE") {
    setState(method === "POST" ? "loading" : "repair-loading")
    try {
      const res = await fetch("/api/admin/backfill-july-videos", { method })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || "Erro desconhecido")
        setState("error")
        return
      }
      const extraNotFound = data.notFound?.length ? ` · não encontrado(s): ${data.notFound.join(", ")}` : ""
      const extraErrors = data.errors?.length ? ` · erros: ${data.errors.join(" | ")}` : ""
      const extraPaid = data.skippedPaid?.length ? ` · faturas pagas não alteradas: ${data.skippedPaid.join(", ")}` : ""
      setMessage(`${data.bookings} vídeos e ${data.intros} intros adicionados a julho (${data.consultants.length} consultores).${extraNotFound}${extraErrors}${extraPaid}`)
      setState(method === "POST" ? "done" : "repair-done")
      router.refresh()
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

  if (state === "done" || state === "repair-done") {
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
          Adicionar a julho: 4 vídeos (100€) + 4 intros (25€) da casa da Maiara?
        </p>
        <button onClick={() => setState("idle")} className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          Cancelar
        </button>
        <button onClick={() => run("POST")} className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0f3460] rounded-lg hover:bg-[#1a4a7a]">
          Confirmar
        </button>
      </div>
    )
  }

  if (state === "repair-confirm") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-sm text-red-800 font-medium flex-1">
          Apagar e recriar os vídeos e intros de julho, recalculando as faturas?
        </p>
        <button onClick={() => setState("idle")} className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          Cancelar
        </button>
        <button onClick={() => run("DELETE")} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700">
          Confirmar
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => setState("confirm")}
        disabled={state === "loading"}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-sky-200 bg-sky-50 text-sm font-semibold text-sky-700 hover:bg-sky-100 transition-colors disabled:opacity-50"
      >
        <Video className="w-4 h-4" />
        {state === "loading" ? "A processar..." : "Adicionar vídeos de julho"}
      </button>
      <button
        onClick={() => setState("repair-confirm")}
        disabled={state === "repair-loading"}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:border-slate-300 transition-colors disabled:opacity-50"
        title="Apaga e recria os vídeos/intros de julho, recalculando as faturas"
      >
        <RotateCcw className="w-4 h-4" />
        {state === "repair-loading" ? "A repor..." : "Repor vídeos de julho"}
      </button>
    </div>
  )
}
