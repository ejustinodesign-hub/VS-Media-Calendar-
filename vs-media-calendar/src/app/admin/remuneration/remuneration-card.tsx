"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPrice } from "@/lib/pricing"
import { Video, Camera, Sparkles, Car, Gift, Zap, Check, X } from "lucide-react"

interface Videographer {
  id: string
  name: string | null
  email: string | null
  image: string | null
  hasCta: boolean
  bookingCount: number
  standardTotal: number
  droneTotal: number
  standardCount: number
  droneCount: number
  videoTotal: number
  aiTotal: number
  introTotal: number
  photoTotal: number
  travelTotal: number
  sharedIntrosTotal: number
  ctaBonusTotal: number
  total: number
}

interface Rates {
  STANDARD_RATE: number
  DRONE_RATE: number
  AI_RATE: number
  INTRO_RATE: number
}

export function RemunerationCard({ videographer: v, rates }: { videographer: Videographer; rates: Rates }) {
  const router = useRouter()
  const [hasCta, setHasCta] = useState(v.hasCta)
  const [ctaSaving, setCtaSaving] = useState(false)

  const toggleCta = async () => {
    setCtaSaving(true)
    try {
      const res = await fetch(`/api/admin/videographers/${v.id}/cta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasCta: !hasCta }),
      })
      if (res.ok) { setHasCta(!hasCta); router.refresh() }
    } finally { setCtaSaving(false) }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          {v.image ? (
            <img src={v.image} alt={v.name || ""} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#0f3460] flex items-center justify-center text-white font-bold text-base">
              {v.name?.[0] || "?"}
            </div>
          )}
          <div className="flex-1">
            <CardTitle className="text-base">{v.name || v.email}</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">{v.bookingCount} marcação(ões) este mês</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Total</p>
            <p className="text-xl font-bold text-[#0f3460]">{formatPrice(v.total)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="h-px bg-slate-100" />

        {/* CTA toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-sm text-slate-400">Intro com CTA</span>
          </div>
          <button
            onClick={toggleCta}
            disabled={ctaSaving}
            className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${hasCta ? "bg-amber-400" : "bg-slate-200"}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${hasCta ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </div>

        <div className="h-px bg-slate-100" />

        {v.standardTotal > 0 && (
          <EarningsRow
            icon={<Video className="w-3.5 h-3.5 text-blue-500" />}
            label="Vídeo standard"
            amount={v.standardTotal}
            detail={`${v.standardCount} × ${rates.STANDARD_RATE}€`}
          />
        )}
        {v.droneTotal > 0 && (
          <EarningsRow
            icon={<Video className="w-3.5 h-3.5 text-indigo-500" />}
            label="Vídeo drone"
            amount={v.droneTotal}
            detail={`${v.droneCount} × ${rates.DRONE_RATE}€`}
          />
        )}
        {v.photoTotal > 0 && (
          <EarningsRow
            icon={<Camera className="w-3.5 h-3.5 text-violet-500" />}
            label="Fotografia"
            amount={v.photoTotal}
          />
        )}
        {v.aiTotal > 0 && (
          <EarningsRow
            icon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
            label="Taxa IA"
            amount={v.aiTotal}
            detail={`${v.aiTotal / rates.AI_RATE} × ${rates.AI_RATE}€`}
          />
        )}
        {v.travelTotal > 0 && (
          <EarningsRow
            icon={<Car className="w-3.5 h-3.5 text-orange-500" />}
            label="Deslocações"
            amount={v.travelTotal}
          />
        )}
        {v.introTotal > 0 && (
          <EarningsRow
            icon={<Gift className="w-3.5 h-3.5 text-pink-500" />}
            label="Intros (marcação)"
            amount={v.introTotal}
          />
        )}
        {v.sharedIntrosTotal > 0 && (
          <EarningsRow
            icon={<Gift className="w-3.5 h-3.5 text-pink-400" />}
            label="Intros partilhadas"
            amount={v.sharedIntrosTotal}
          />
        )}
        {v.ctaBonusTotal > 0 && (
          <EarningsRow
            icon={<Zap className="w-3.5 h-3.5 text-amber-400" />}
            label="Bónus CTA"
            amount={v.ctaBonusTotal}
          />
        )}

        {v.total === 0 && (
          <p className="text-xs text-slate-400 text-center pt-1">Sem serviços entregues este mês</p>
        )}
      </CardContent>
    </Card>
  )
}

function EarningsRow({ icon, label, amount, detail }: {
  icon: React.ReactNode; label: string; amount: number; detail?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-slate-600">{label}</span>
        {detail && <span className="text-xs text-slate-400">({detail})</span>}
      </div>
      <span className="text-sm font-semibold text-slate-800">{formatPrice(amount)}</span>
    </div>
  )
}
