"use client"

import { useState } from "react"
import { CreditCard } from "lucide-react"

export function PayButton({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    setLoading(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/retry-payment`, {
        method: "POST",
      })
      const data = await res.json()
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 py-3 bg-[#e94560] text-white rounded-xl font-semibold text-sm hover:bg-[#d63050] transition-colors disabled:opacity-50 shadow-lg shadow-[#e94560]/20"
    >
      <CreditCard className="w-4 h-4" />
      {loading ? "A redirecionar..." : "Pagar Agora"}
    </button>
  )
}
