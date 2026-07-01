"use client"

import { useState } from "react"
import { CreditCard, Lock } from "lucide-react"

interface Props {
  invoiceId: string
  isOverdue?: boolean
  canPayFrom: string // ISO date string — last day of invoice month
}

export function PayInvoiceButton({ invoiceId, isOverdue, canPayFrom }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const payFrom = new Date(canPayFrom)
  payFrom.setHours(0, 0, 0, 0)
  const locked = today < payFrom

  async function handlePay() {
    if (locked) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pay`, { method: "POST" })
      let data: any = {}
      try { data = await res.json() } catch { /* non-JSON response */ }
      if (!res.ok) {
        setError(data.error || `Erro ${res.status}. Tente novamente.`)
        return
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        setError("Erro ao criar sessão de pagamento. Tente novamente.")
      }
    } catch {
      setError("Erro de ligação. Verifique a sua rede e tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  if (locked) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-400 rounded-lg text-sm font-medium cursor-not-allowed select-none">
          <Lock className="w-3.5 h-3.5" />
          Pagar
        </div>
        <p className="text-[10px] text-slate-400 text-right">
          Disponível a partir de{" "}
          {payFrom.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handlePay}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 shadow-sm text-white ${
          isOverdue
            ? "bg-red-600 hover:bg-red-700"
            : "bg-[#e94560] hover:bg-[#d63050]"
        }`}
      >
        <CreditCard className="w-4 h-4" />
        {loading ? "A redirecionar..." : "Pagar"}
      </button>
      {error && (
        <p className="text-[11px] text-red-500 text-right max-w-[200px]">{error}</p>
      )}
    </div>
  )
}
