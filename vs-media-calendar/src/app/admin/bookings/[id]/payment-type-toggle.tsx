"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Percent, Receipt, Loader2, AlertCircle } from "lucide-react"

interface Props {
  bookingId: string
  paymentType: "FLAT_FEE" | "COMMISSION"
  commissionRate: number
  monthLabel: string
}

// Alterna a marcação entre taxa fixa e comissão. A fatura do mês é
// recalculada pela API — a cobrança sai (ou entra) automaticamente.
export function PaymentTypeToggle({ bookingId, paymentType, commissionRate, monthLabel }: Props) {
  const [state, setState] = useState<"idle" | "confirm" | "loading" | "error" | "paid-warning">("idle")
  const [message, setMessage] = useState("")
  const router = useRouter()

  const toCommission = paymentType === "FLAT_FEE"
  const target = toCommission ? "COMMISSION" : "FLAT_FEE"

  async function run() {
    setState("loading")
    setMessage("")
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/payment-type`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentType: target }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || "Erro desconhecido")
        setState("error")
        return
      }
      if (data.invoiceWasPaid) {
        setMessage(`A fatura de ${monthLabel} já está paga — o valor não foi alterado. Regularize o acerto com o consultor.`)
        setState("paid-warning")
      } else {
        setState("idle")
      }
      router.refresh()
    } catch {
      setMessage("Erro de ligação.")
      setState("error")
    }
  }

  if (state === "error" || state === "paid-warning") {
    const isError = state === "error"
    return (
      <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${
        isError ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-800"
      }`}>
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p>{message}</p>
          <button onClick={() => setState("idle")} className="underline font-semibold mt-1">
            Fechar
          </button>
        </div>
      </div>
    )
  }

  if (state === "confirm") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex-wrap">
        <p className="text-xs text-amber-800 font-medium flex-1 min-w-[200px]">
          {toCommission
            ? `Retirar esta marcação da fatura de ${monthLabel} e passar a comissão de ${(commissionRate * 100).toFixed(2)}% sobre a venda?`
            : `Voltar a taxa fixa e cobrar esta marcação na fatura de ${monthLabel}?`}
        </p>
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
      title={toCommission
        ? "Deixa de ser cobrada na fatura mensal — passa a pagar só uma percentagem do valor de venda"
        : "Volta a ser cobrada na fatura mensal pelo preço dos serviços"}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
        toCommission
          ? "bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {state === "loading"
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : toCommission ? <Percent className="w-3.5 h-3.5" /> : <Receipt className="w-3.5 h-3.5" />}
      {state === "loading"
        ? "A guardar..."
        : toCommission ? "Passar a comissão" : "Voltar a taxa fixa"}
    </button>
  )
}
