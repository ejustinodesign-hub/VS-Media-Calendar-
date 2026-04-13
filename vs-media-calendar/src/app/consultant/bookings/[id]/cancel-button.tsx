"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { XCircle } from "lucide-react"

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const handleCancel = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" })
      if (res.ok) {
        router.refresh()
        setShowConfirm(false)
      }
    } finally {
      setLoading(false)
    }
  }

  if (showConfirm) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
        <p className="text-red-800 font-semibold text-sm">Confirmar cancelamento?</p>
        <p className="text-red-700 text-xs">
          O cancelamento é gratuito. O horário ficará disponível para outros consultores.
        </p>
        <div className="flex gap-3">
          <Button variant="danger" size="sm" loading={loading} onClick={handleCancel}>
            Sim, cancelar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfirm(false)}
            disabled={loading}
          >
            Não, manter
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      className="text-red-500 hover:text-red-600 hover:bg-red-50"
      onClick={() => setShowConfirm(true)}
    >
      <XCircle className="w-4 h-4" />
      Cancelar Marcação
    </Button>
  )
}
