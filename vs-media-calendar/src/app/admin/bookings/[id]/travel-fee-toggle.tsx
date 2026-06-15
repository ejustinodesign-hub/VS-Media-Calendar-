"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Car } from "lucide-react"

export function TravelFeeToggle({ bookingId, hasTravelFee }: { bookingId: string; hasTravelFee: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  async function toggle() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/travel-fee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add: !hasTravelFee }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Erro")
      }
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={loading}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
          hasTravelFee
            ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
            : "bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700"
        }`}
      >
        <Car className="w-3.5 h-3.5" />
        {loading ? "A guardar..." : hasTravelFee ? "Remover deslocação (50€)" : "Adicionar deslocação (50€)"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
