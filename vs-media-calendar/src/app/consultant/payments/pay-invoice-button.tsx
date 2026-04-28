"use client"

import { useState } from "react"
import { CreditCard } from "lucide-react"

export function PayInvoiceButton({ invoiceId, isOverdue }: { invoiceId: string; isOverdue?: boolean }) {
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    setLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
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
      className="flex items-center gap-2 px-4 py-2 bg-[#e94560] text-white rounded-lg font-semibold text-sm hover:bg-[#d63050] transition-colors disabled:opacity-50 shadow-sm"
    >
      <CreditCard className="w-4 h-4" />
      {loading ? "A redirecionar..." : "Pagar"}
    </button>
  )
}
