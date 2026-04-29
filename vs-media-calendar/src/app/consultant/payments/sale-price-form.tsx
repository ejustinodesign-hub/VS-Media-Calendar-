"use client"

import { useState } from "react"
import { formatPrice, IVA_RATE } from "@/lib/pricing"
import { CheckCircle2 } from "lucide-react"

interface Props {
  bookingId: string
  propertyAddress: string
  commissionRate: number
}

export function SalePriceForm({ bookingId, propertyAddress, commissionRate }: Props) {
  const [salePrice, setSalePrice] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  const numericPrice = parseFloat(salePrice.replace(",", "."))
  const commissionNet = !isNaN(numericPrice) && numericPrice > 0
    ? numericPrice * commissionRate
    : null
  const commission = commissionNet !== null
    ? Math.round(commissionNet * (1 + IVA_RATE) * 100) / 100
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!commission) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/bookings/${bookingId}/sale-price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salePrice: numericPrice }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro")
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 text-emerald-700 text-sm">
        <CheckCircle2 className="w-4 h-4" />
        <span>Comissão registada: {commission ? formatPrice(commission) : ""} (c/ IVA)</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-xs text-slate-500 truncate">{propertyAddress}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="1"
          step="1000"
          placeholder="Valor de venda (€)"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3460]/30 focus:border-[#0f3460]"
        />
        <button
          type="submit"
          disabled={loading || !commission}
          className="px-4 py-2 bg-[#0f3460] text-white text-sm font-semibold rounded-lg hover:bg-[#1a4a7a] transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Registar"}
        </button>
      </div>
      {commission && commissionNet && (
        <p className="text-xs text-slate-500">
          Comissão: <span className="font-semibold text-slate-700">{formatPrice(commissionNet)}</span> + IVA = <span className="font-semibold text-slate-900">{formatPrice(commission)}</span>
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}
