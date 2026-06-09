"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { SERVICE_LABELS, VIDEO_SERVICES, PHOTO_SERVICES, DEFAULT_PRICES } from "@/lib/pricing"
import type { ServiceType } from "@prisma/client"

interface User {
  id: string
  name: string | null
  email: string | null
}

interface Props {
  consultants: User[]
  videographers: User[]
  activePrices: Record<string, number>
}

const ALL_SERVICES = [...VIDEO_SERVICES, ...PHOTO_SERVICES]

function toLocalDatetimeValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function AdminBookingForm({ consultants, videographers, activePrices }: Props) {
  const router = useRouter()

  const [consultantId, setConsultantId]   = useState("")
  const [videographerId, setVideographerId] = useState("")
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>([])
  const [scheduledAt, setScheduledAt]     = useState("")
  const [propertyAddress, setPropertyAddress] = useState("")
  const [notes, setNotes]                 = useState("")
  const [hasTravelFee, setHasTravelFee]   = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState("")

  // Default datetime to tomorrow at 10:00
  useEffect(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(10, 0, 0, 0)
    setScheduledAt(toLocalDatetimeValue(d))
  }, [])

  const toggleService = (svc: ServiceType) => {
    setSelectedServices((prev) =>
      prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc]
    )
  }

  const hasDroneVideoSelected = selectedServices.includes("VIDEO_DRONE")
  const total = selectedServices.reduce((sum, s) => {
    if (s === "PHOTO_DRONE" && hasDroneVideoSelected) return sum
    return sum + (activePrices[s] ?? DEFAULT_PRICES[s] ?? 0)
  }, 0) + (hasTravelFee ? 50 : 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consultantId || !videographerId || !selectedServices.length || !scheduledAt || !propertyAddress) {
      setError("Preenche todos os campos obrigatórios.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultantId,
          videographerId,
          scheduledAt: new Date(scheduledAt).toISOString(),
          services: selectedServices,
          propertyAddress,
          notes,
          hasTravelFee,
          travelFeeAmount: hasTravelFee ? 50 : 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao criar marcação")
      router.push(`/admin/bookings/${data.bookingId}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {/* Consultant + Videographer */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">Consultor *</label>
          <select
            value={consultantId}
            onChange={(e) => setConsultantId(e.target.value)}
            required
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:border-[#0f3460]"
          >
            <option value="">Seleccionar consultor…</option>
            {consultants.map((c) => (
              <option key={c.id} value={c.id}>{c.name || c.email}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">Videógrafo *</label>
          <select
            value={videographerId}
            onChange={(e) => setVideographerId(e.target.value)}
            required
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:border-[#0f3460]"
          >
            <option value="">Seleccionar videógrafo…</option>
            {videographers.map((v) => (
              <option key={v.id} value={v.id}>{v.name || v.email}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Date & time */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">Data e hora *</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:border-[#0f3460]"
        />
      </div>

      {/* Property */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">Morada do imóvel *</label>
        <input
          type="text"
          value={propertyAddress}
          onChange={(e) => setPropertyAddress(e.target.value)}
          placeholder="Rua Exemplo, 10, Lisboa"
          required
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:border-[#0f3460]"
        />
      </div>

      {/* Services */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">Serviços *</label>
        <div className="grid grid-cols-2 gap-2">
          {ALL_SERVICES.map((svc) => {
            const active = selectedServices.includes(svc)
            const basePrice = activePrices[svc] ?? DEFAULT_PRICES[svc] ?? 0
            const isFree = svc === "PHOTO_DRONE" && hasDroneVideoSelected
            return (
              <button
                key={svc}
                type="button"
                onClick={() => toggleService(svc)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-colors text-left ${
                  active
                    ? "border-[#0f3460] bg-[#0f3460]/5 text-[#0f3460]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span>{SERVICE_LABELS[svc]}</span>
                <span className={`text-xs ${isFree ? "text-emerald-600 font-semibold" : active ? "text-[#0f3460]" : "text-slate-400"}`}>
                  {isFree ? (
                    <><s className="text-slate-400 font-normal">{basePrice}€</s> Grátis</>
                  ) : (
                    `${basePrice}€`
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Travel fee */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={hasTravelFee}
          onChange={(e) => setHasTravelFee(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 accent-[#0f3460]"
        />
        <span className="text-sm text-slate-700">Taxa de deslocação <span className="text-slate-400">(+50€)</span></span>
      </label>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">Notas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Instruções especiais, acessos, etc."
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:border-[#0f3460] resize-none"
        />
      </div>

      {/* Total */}
      {selectedServices.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-600">Total estimado (sem IVA)</span>
          <span className="text-base font-bold text-slate-900">{total}€</span>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 rounded-xl bg-[#0f3460] text-white text-sm font-semibold hover:bg-[#1a4a7a] disabled:opacity-50 transition-colors"
        >
          {submitting ? "A criar…" : "Criar Marcação"}
        </button>
      </div>
    </form>
  )
}
