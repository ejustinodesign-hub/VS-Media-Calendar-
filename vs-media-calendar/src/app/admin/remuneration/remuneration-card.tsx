"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPrice } from "@/lib/pricing"
import { Video, Camera, Sparkles, Car, Gift, Star, Pencil, Check, X } from "lucide-react"

interface Videographer {
  id: string
  name: string | null
  email: string | null
  image: string | null
  baseSalary: number
  bookingCount: number
  videoTotal: number
  aiTotal: number
  introTotal: number
  photoTotal: number
  travelTotal: number
  sharedIntrosTotal: number
  variable: number
  total: number
}

interface Rates {
  VIDEO_RATE: number
  PHOTO_RATE: number
  AI_RATE: number
  INTRO_RATE: number
}

export function RemunerationCard({ videographer: v, rates }: { videographer: Videographer; rates: Rates }) {
  const router = useRouter()
  const [baseSalary, setBaseSalary] = useState(v.baseSalary)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(v.baseSalary))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  const variable = v.variable
  const total = baseSalary + variable

  const handleSave = async () => {
    const val = parseInt(draft, 10)
    if (isNaN(val) || val < 0) return
    setSaving(true)
    setSaveError("")
    try {
      const res = await fetch(`/api/admin/videographers/${v.id}/salary`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseSalary: val }),
      })
      if (!res.ok) {
        const data = await res.json()
        setSaveError(data.error || "Erro ao guardar")
        return
      }
      setBaseSalary(val)
      setEditing(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
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
            <p className="text-xl font-bold text-[#0f3460]">{formatPrice(total)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="h-px bg-slate-100" />

        {/* Base salary row with inline edit */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-sm text-slate-400">Salário base</span>
          </div>
          {editing ? (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-sm">€</span>
              <input
                type="number"
                min="0"
                step="100"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-24 px-2 py-1 border border-[#0f3460] rounded-lg text-sm text-right focus:outline-none"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false) }}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-6 h-6 flex items-center justify-center rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setEditing(false); setDraft(String(baseSalary)) }}
                className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-slate-400">{formatPrice(baseSalary)}</span>
              <button
                onClick={() => { setDraft(String(baseSalary)); setEditing(true) }}
                className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        {saveError && (
          <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{saveError}</p>
        )}

        {v.videoTotal > 0 && (
          <EarningsRow
            icon={<Video className="w-3.5 h-3.5 text-blue-500" />}
            label="Serviços de vídeo"
            amount={v.videoTotal}
            detail={`${v.videoTotal / rates.VIDEO_RATE} × ${rates.VIDEO_RATE}€`}
          />
        )}
        {v.photoTotal > 0 && (
          <EarningsRow
            icon={<Camera className="w-3.5 h-3.5 text-violet-500" />}
            label="Serviços de fotografia"
            amount={v.photoTotal}
            detail={`${v.photoTotal / rates.PHOTO_RATE} × ${rates.PHOTO_RATE}€`}
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

        {variable > 0 && (
          <>
            <div className="h-px bg-slate-100" />
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Variável</span>
              <span className="text-sm font-bold text-slate-700">+ {formatPrice(variable)}</span>
            </div>
          </>
        )}

        {variable === 0 && (
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
