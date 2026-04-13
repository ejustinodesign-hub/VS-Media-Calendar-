"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle } from "lucide-react"

interface Props {
  bookingId: string
  autoAction?: string
}

export function AcceptRejectButtons({ bookingId, autoAction }: Props) {
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null)
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (autoAction === "accept") handleAction("accept")
    if (autoAction === "reject") setShowRejectConfirm(true)
  }, [autoAction])

  const handleAction = async (action: "accept" | "reject") => {
    setLoading(action)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/${action}`, { method: "POST" })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setLoading(null)
      setShowRejectConfirm(false)
    }
  }

  if (showRejectConfirm) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
        <p className="text-red-800 font-semibold">Confirmar recusa?</p>
        <p className="text-red-700 text-sm">
          O consultor será notificado. A marcação será cancelada.
        </p>
        <div className="flex gap-3">
          <Button
            variant="danger"
            size="sm"
            loading={loading === "reject"}
            onClick={() => handleAction("reject")}
          >
            Sim, recusar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRejectConfirm(false)}
            disabled={!!loading}
          >
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <Button
        variant="success"
        size="lg"
        className="flex-1"
        loading={loading === "accept"}
        onClick={() => handleAction("accept")}
        disabled={!!loading}
      >
        <CheckCircle2 className="w-4 h-4" />
        Aceitar Serviço
      </Button>
      <Button
        variant="danger"
        size="lg"
        className="flex-1"
        loading={loading === "reject"}
        onClick={() => setShowRejectConfirm(true)}
        disabled={!!loading}
      >
        <XCircle className="w-4 h-4" />
        Recusar
      </Button>
    </div>
  )
}
