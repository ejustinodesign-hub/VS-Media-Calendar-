"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { SERVICE_LABELS } from "@/lib/pricing"
import type { ServiceType } from "@prisma/client"
import { RefreshCw, Gift } from "lucide-react"

interface Props {
  defaultPrices: Record<ServiceType, number>
  additionalIntroPrice: number
}

export function PricingEditor({ defaultPrices, additionalIntroPrice }: Props) {
  const [prices, setPrices] = useState(defaultPrices)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [applying, setApplying]   = useState(false)
  const [applyResult, setApplyResult] = useState<string | null>(null)
  const [confirmApply, setConfirmApply] = useState(false)

  const [fixingDrone, setFixingDrone] = useState(false)
  const [fixDroneResult, setFixDroneResult] = useState<string | null>(null)
  const [confirmFixDrone, setConfirmFixDrone] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prices }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleApply = async () => {
    setApplying(true)
    setApplyResult(null)
    try {
      const res  = await fetch("/api/admin/pricing/apply-to-bookings", { method: "POST" })
      const data = await res.json()
      setApplyResult(`${data.updated} linha(s) de serviço atualizadas.`)
      setConfirmApply(false)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700">Editar Preços</p>
      {(Object.entries(SERVICE_LABELS) as [ServiceType, string][]).map(([type, label]) => (
        <div key={type} className="flex items-center gap-3">
          <label className="text-sm text-slate-600 flex-1">{label}</label>
          <div className="flex items-center gap-1">
            <span className="text-slate-500 text-sm">€</span>
            <input
              type="number"
              min="0"
              step="5"
              value={prices[type]}
              onChange={(e) =>
                setPrices({ ...prices, [type]: parseFloat(e.target.value) || 0 })
              }
              className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:border-[#0f3460]"
            />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} loading={saving} size="sm">
          {saved ? "Guardado!" : "Guardar Preços"}
        </Button>
      </div>

      {/* Apply to existing bookings */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-sm font-medium text-slate-700 mb-1">Aplicar a marcações existentes</p>
        <p className="text-xs text-slate-500 mb-3">
          Atualiza os preços de todas as marcações pendentes ou aceites (exclui concluídas, canceladas e pagas).
        </p>

        {!confirmApply ? (
          <button
            onClick={() => setConfirmApply(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar marcações ativas
          </button>
        ) : (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
            <p className="text-xs font-semibold text-amber-800">
              Confirmar? Os valores nas marcações pendentes/aceites serão substituídos pelos preços atuais.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleApply}
                disabled={applying}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {applying ? "A atualizar…" : "Sim, atualizar"}
              </button>
              <button
                onClick={() => setConfirmApply(false)}
                className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {applyResult && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-2">
            {applyResult}
          </p>
        )}
      </div>

      {/* Fix drone photo prices this month */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-sm font-medium text-slate-700 mb-1">Corrigir fotografias drone este mês</p>
        <p className="text-xs text-slate-500 mb-3">
          Coloca a 0€ as fotografias drone em marcações deste mês que também têm vídeo com drone (oferta combinada).
        </p>

        {!confirmFixDrone ? (
          <button
            onClick={() => setConfirmFixDrone(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Gift className="w-3.5 h-3.5" />
            Aplicar oferta drone deste mês
          </button>
        ) : (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
            <p className="text-xs font-semibold text-amber-800">
              Confirmar? As marcações deste mês com Vídeo Drone + Fotografia Drone terão a fotografia colocada a 0€.
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setFixingDrone(true)
                  setFixDroneResult(null)
                  try {
                    const res = await fetch("/api/admin/fix-drone-photo-prices", { method: "POST" })
                    const data = await res.json()
                    setFixDroneResult(
                      data.count === 0
                        ? "Nenhuma marcação encontrada para corrigir."
                        : `${data.count} marcação(ões) corrigida(s).`
                    )
                    setConfirmFixDrone(false)
                  } finally {
                    setFixingDrone(false)
                  }
                }}
                disabled={fixingDrone}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {fixingDrone ? "A corrigir…" : "Sim, corrigir"}
              </button>
              <button
                onClick={() => setConfirmFixDrone(false)}
                className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {fixDroneResult && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-2">
            {fixDroneResult}
          </p>
        )}
      </div>
    </div>
  )
}
