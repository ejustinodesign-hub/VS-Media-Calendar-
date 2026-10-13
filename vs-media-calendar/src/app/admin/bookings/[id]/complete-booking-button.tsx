"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, RotateCcw, Loader2, AlertCircle } from "lucide-react"

interface Props {
  bookingId: string
  status: string
  hasDeliverables: boolean
  isCommission: boolean
  flatFeeAmount: number
  monthLabel: string
}

// Fecha (ou reabre) uma marcação à mão. Concluída passa a contar para
// faturação, mesmo sem vídeo entregue.
export function CompleteBookingButton({
  bookingId, status, hasDeliverables, isCommission, flatFeeAmount, monthLabel,
}: Props) {
  const [state, setState] = useState<"idle" | "confirm" | "loading" | "error" | "warning">("idle")
  const [message, setMessage] = useState("")
  const router = useRouter()

  const isCompleted = status === "COMPLETED"
  const canAct = status !== "CANCELLED" && status !== "REJECTED"
  if (!canAct) return null

  const willStartBilling = !isCompleted && !isCommission && status !== "FILE_DELIVERED"
  const willStopBilling = isCompleted && !isCommission && !hasDeliverables

  async function run() {
    setState("loading")
    setMessage("")
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !isCompleted }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || "Erro desconhecido")
        setState("error")
        return
      }
      if (data.invoiceWasPaid) {
        setMessage(`A fatura de ${monthLabel} já está paga — o valor não foi alterado. Acerte com o consultor à parte.`)
        setState("warning")
      } else {
        setState("idle")
      }
      router.refresh()
    } catch {
      setMessage("Erro de ligação.")
      setState("error")
    }
  }

  if (state === "error" || state === "warning") {
    const isError = state === "error"
    return (
      <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${
        isError ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-800"
      }`}>
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p>{message}</p>
          <button onClick={() => setState("idle")} className="underline font-semibold mt-1">Fechar</button>
        </div>
      </div>
    )
  }

  if (state === "confirm") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex-wrap max-w-lg">
        <div className="flex-1 min-w-[220px]">
          <p className="text-xs text-amber-800 font-medium">
            {isCompleted
              ? "Reabrir esta marcação?"
              : hasDeliverables
                ? "Marcar esta marcação como concluída?"
                : "Concluir esta marcação sem vídeo entregue?"}
          </p>
          {willStartBilling && (
            <p className="text-[11px] text-amber-700 mt-1">
              Passa a ser cobrada na fatura de {monthLabel}
              {flatFeeAmount > 0 ? ` (${flatFeeAmount.toFixed(2).replace(".", ",")} € s/ IVA)` : ""}.
            </p>
          )}
          {willStopBilling && (
            <p className="text-[11px] text-amber-700 mt-1">
              Como não tem vídeo entregue, deixa de ser cobrada na fatura de {monthLabel}.
            </p>
          )}
        </div>
        <button
          onClick={() => setState("idle")}
          className="px-2.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-white"
        >
          Cancelar
        </button>
        <button
          onClick={run}
          className="px-2.5 py-1 text-xs font-semibold text-white bg-[#0f3460] rounded-lg hover:bg-[#1a4a7a]"
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
      title={isCompleted
        ? "Reabrir a marcação"
        : "Fechar a marcação como concluída, mesmo sem vídeo entregue"}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
        isCompleted
          ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
          : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
      }`}
    >
      {state === "loading"
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : isCompleted ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
      {state === "loading" ? "A guardar..." : isCompleted ? "Reabrir marcação" : "Marcar como concluída"}
    </button>
  )
}
