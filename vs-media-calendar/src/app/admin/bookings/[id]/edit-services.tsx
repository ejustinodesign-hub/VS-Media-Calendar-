"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, ChevronDown } from "lucide-react"

interface Service {
  id: string
  serviceType: string
  price: number
}

interface Props {
  bookingId: string
  services: Service[]
  serviceLabels: Record<string, string>
  servicePrices: Record<string, number>
  allServiceTypes: string[]
}

export function EditServices({ bookingId, services, serviceLabels, servicePrices, allServiceTypes }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState("")
  const router = useRouter()

  const existingTypes = services.map((s) => s.serviceType)
  const available = allServiceTypes.filter((t) => !existingTypes.includes(t))

  async function addService(serviceType: string) {
    setLoading(serviceType)
    setError("")
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceType }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Erro")
      }
      setOpen(false)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro")
    } finally {
      setLoading(null)
    }
  }

  async function removeService(serviceId: string) {
    setLoading(serviceId)
    setError("")
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/services`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Erro")
      }
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-2">
      {/* Existing services with remove button */}
      {services.map((s) => (
        <div key={s.id} className="flex items-center justify-between text-sm group">
          <span className="text-slate-600">{serviceLabels[s.serviceType] || s.serviceType}</span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">
              {s.price === 0 ? <span className="text-emerald-600 text-xs font-semibold">Grátis</span> : `${s.price.toFixed(2).replace(".", ",")} €`}
            </span>
            <button
              onClick={() => removeService(s.id)}
              disabled={loading === s.id}
              title="Remover serviço"
              className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {/* Add service */}
      {available.length > 0 && (
        <div className="pt-1">
          {open ? (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-1">
              <p className="text-xs font-semibold text-slate-500 mb-2">Adicionar serviço</p>
              {available.map((type) => {
                const price = servicePrices[type] ?? 0
                return (
                  <button
                    key={type}
                    onClick={() => addService(type)}
                    disabled={loading === type}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left hover:bg-white hover:shadow-sm transition-all disabled:opacity-50"
                  >
                    <span className="text-slate-700">{serviceLabels[type] || type}</span>
                    <span className="text-xs text-slate-400 font-medium">
                      {loading === type ? "A adicionar..." : `${price.toFixed(2).replace(".", ",")} €`}
                    </span>
                  </button>
                )
              })}
              <button
                onClick={() => setOpen(false)}
                className="w-full mt-1 py-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#0f3460] hover:text-[#1a4a7a] transition-colors mt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar serviço
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
