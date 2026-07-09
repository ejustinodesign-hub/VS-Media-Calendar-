"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { SERVICE_LABELS, VIDEO_SERVICES, PHOTO_SERVICES, DEFAULT_PRICES, COMMISSION_RATE, IVA_RATE, ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"
import type { ServiceType } from "@prisma/client"
import { Percent, CreditCard, Calculator, Plus, Minus } from "lucide-react"

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

function formatEur(n: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n)
}

export function AdminBookingForm({ consultants, videographers, activePrices }: Props) {
  const router = useRouter()

  const [paymentType, setPaymentType] = useState<"FLAT_FEE" | "COMMISSION">("FLAT_FEE")
  const [consultantId, setConsultantId]   = useState("")
  const [videographerId, setVideographerId] = useState("")
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>([])
  const [additionalIntros, setAdditionalIntros] = useState(0)
  const [scheduledAt, setScheduledAt]     = useState("")
  const [propertyAddress, setPropertyAddress] = useState("")
  const [notes, setNotes]                 = useState("")
  const [hasTravelFee, setHasTravelFee]   = useState(false)

  // Commission simulator
  const [simPropertyValue, setSimPropertyValue] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState("")

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
  const flatFeeTotal = selectedServices.reduce((sum, s) => {
    if (s === "PHOTO_DRONE" && hasDroneVideoSelected) return sum
    return sum + (activePrices[s] ?? DEFAULT_PRICES[s] ?? 0)
  }, 0) + (hasTravelFee ? 50 : 0) + additionalIntros * ADDITIONAL_INTRO_PRICE

  const simValue = parseFloat(simPropertyValue.replace(",", ".")) || 0
  const simCommission = Math.round(simValue * COMMISSION_RATE * 100) / 100
  const simCommissionWithIva = Math.round(simCommission * (1 + IVA_RATE) * 100) / 100

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consultantId || !videographerId || (!selectedServices.length && !additionalIntros) || !scheduledAt || !propertyAddress) {
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
          additionalIntros,
          propertyAddress,
          notes,
          hasTravelFee,
          travelFeeAmount: hasTravelFee ? 50 : 0,
          paymentType,
          commissionRate: COMMISSION_RATE,
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

      {/* Payment type toggle */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">Tipo de pagamento *</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPaymentType("FLAT_FEE")}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
              paymentType === "FLAT_FEE"
                ? "border-[#0f3460] bg-[#0f3460]/5 text-[#0f3460]"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <CreditCard className="w-4 h-4 flex-shrink-0" />
            <div className="text-left">
              <p className="font-semibold">Taxa Fixa</p>
              <p className="text-xs text-slate-500 font-normal">Pagamento antecipado pelo consultor</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setPaymentType("COMMISSION")}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
              paymentType === "COMMISSION"
                ? "border-violet-500 bg-violet-50 text-violet-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <Percent className="w-4 h-4 flex-shrink-0" />
            <div className="text-left">
              <p className="font-semibold">Comissão</p>
              <p className="text-xs text-slate-500 font-normal">{(COMMISSION_RATE * 100).toFixed(2)}% do valor de venda</p>
            </div>
          </button>
        </div>
      </div>

      {/* Commission simulator */}
      {paymentType === "COMMISSION" && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-violet-600" />
            <p className="text-sm font-semibold text-violet-800">Simulador de comissão</p>
          </div>
          <p className="text-xs text-violet-600">
            Insere o valor estimado do imóvel para calcular a comissão. Este valor não fica guardado — é apenas indicativo.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              step="1000"
              value={simPropertyValue}
              onChange={(e) => setSimPropertyValue(e.target.value)}
              placeholder="Ex: 250000"
              className="flex-1 px-3 py-2 border border-violet-300 rounded-lg text-sm bg-white focus:outline-none focus:border-violet-500"
            />
            <span className="text-sm text-violet-600 font-medium">€</span>
          </div>
          {simValue > 0 && (
            <div className="pt-2 border-t border-violet-200 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-violet-700">Comissão ({(COMMISSION_RATE * 100).toFixed(2)}%)</span>
                <span className="font-bold text-violet-900">{formatEur(simCommission)}</span>
              </div>
              <div className="flex justify-between text-xs text-violet-600">
                <span>c/ IVA (23%)</span>
                <span className="font-semibold">{formatEur(simCommissionWithIva)}</span>
              </div>
            </div>
          )}
        </div>
      )}

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
                {paymentType === "COMMISSION" ? (
                  <span className="text-xs text-violet-500 font-semibold">Comissão</span>
                ) : (
                  <span className={`text-xs ${isFree ? "text-emerald-600 font-semibold" : active ? "text-[#0f3460]" : "text-slate-400"}`}>
                    {isFree ? (
                      <><s className="text-slate-400 font-normal">{basePrice}€</s> Grátis</>
                    ) : (
                      `${basePrice}€`
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Intros counter */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">Intros de vídeo <span className="text-slate-400 font-normal">({ADDITIONAL_INTRO_PRICE}€ cada)</span></label>
        <div className="flex items-center justify-between px-4 py-3 border border-slate-200 rounded-xl bg-white">
          <span className="text-sm text-slate-700">
            {additionalIntros === 0
              ? "Nenhuma intro"
              : `${additionalIntros} intro${additionalIntros > 1 ? "s" : ""} — ${additionalIntros * ADDITIONAL_INTRO_PRICE}€`}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAdditionalIntros(Math.max(0, additionalIntros - 1))}
              disabled={additionalIntros === 0}
              className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:border-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-5 text-center font-bold text-slate-900 text-sm">{additionalIntros}</span>
            <button
              type="button"
              onClick={() => setAdditionalIntros(Math.min(4, additionalIntros + 1))}
              disabled={additionalIntros >= 4}
              className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:border-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
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

      {/* Total / commission note */}
      {(selectedServices.length > 0 || additionalIntros > 0) && (
        paymentType === "FLAT_FEE" ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-600">Total estimado (sem IVA)</span>
            <span className="text-base font-bold text-slate-900">{flatFeeTotal}€</span>
          </div>
        ) : (
          <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-violet-800">Modo comissão — sem cobrança antecipada</p>
            <p className="text-xs text-violet-600 mt-0.5">
              O consultor pagará {(COMMISSION_RATE * 100).toFixed(2)}% do valor de venda após concretizar o negócio.
            </p>
          </div>
        )
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
