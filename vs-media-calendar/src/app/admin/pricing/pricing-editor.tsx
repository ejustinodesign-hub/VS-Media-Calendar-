"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { SERVICE_LABELS } from "@/lib/pricing"
import type { ServiceType } from "@prisma/client"

interface Props {
  defaultPrices: Record<ServiceType, number>
  additionalIntroPrice: number
}

export function PricingEditor({ defaultPrices, additionalIntroPrice }: Props) {
  const [prices, setPrices] = useState(defaultPrices)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
      <div className="pt-2">
        <Button onClick={handleSave} loading={saving} size="sm">
          {saved ? "Guardado!" : "Guardar Preços"}
        </Button>
      </div>
    </div>
  )
}
