"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, ArrowLeftRight } from "lucide-react"

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
  const [addOpen, setAddOpen] = useState(false)
  // swappingId = serviceId currently being replaced
  const [swappingId, setSwappingId] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState("")
  const router = useRouter()

  const existingTypes = services.map((s) => s.serviceType)
  const available = allServiceTypes.filter((t) => !existingTypes.includes(t))

  async function removeService(serviceId: string) {
    setLoading(serviceId)
    setError("")
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/services`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Erro")
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro")
    } finally {
      setLoading(null)
    }
  }

  async function addService(serviceType: string) {
    setLoading(serviceType)
    setError("")
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceType }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Erro")
      setAddOpen(false)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro")
    } finally {
      setLoading(null)
    }
  }

  async function swapService(removeId: string, addType: string) {
    setLoading(removeId)
    setError("")
    try {
      // Remove old
      const del = await fetch(`/api/admin/bookings/${bookingId}/services`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: removeId }),
      })
      if (!del.ok) throw new Error((await del.json()).error || "Erro ao remover")

      // Add new
      const add = await fetch(`/api/admin/bookings/${bookingId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceType: addType }),
      })
      if (!add.ok) throw new Error((await add.json()).error || "Erro ao adicionar")

      setSwappingId(null)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-1.5">
      {services.map((s) => {
        const isSwapping = swappingId === s.id
        const swapOptions = allServiceTypes.filter((t) => t !== s.serviceType && !existingTypes.includes(t))

        return (
          <div key={s.id}>
            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-slate-600 flex-1 min-w-0 truncate">
                {serviceLabels[s.serviceType] || s.serviceType}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <span className="font-medium text-slate-900 text-xs">
                  {s.price === 0
                    ? <span className="text-emerald-600 font-semibold">Grátis</span>
                    : `${s.price.toFixed(2).replace(".", ",")} €`}
                </span>
                {swapOptions.length > 0 && (
                  <button
                    onClick={() => setSwappingId(isSwapping ? null : s.id)}
                    title="Trocar serviço"
                    className={`p-1.5 rounded-lg text-xs transition-colors ${
                      isSwapping
                        ? "bg-blue-100 text-blue-600"
                        : "text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                    }`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => removeService(s.id)}
                  disabled={loading === s.id}
                  title="Remover serviço"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Inline swap picker */}
            {isSwapping && (
              <div className="mb-1 bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-blue-600 mb-1.5">Trocar por:</p>
                {swapOptions.map((type) => {
                  const price = servicePrices[type] ?? 0
                  return (
                    <button
                      key={type}
                      onClick={() => swapService(s.id, type)}
                      disabled={loading === s.id}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left bg-white hover:shadow-sm transition-all disabled:opacity-50"
                    >
                      <span className="text-slate-700">{serviceLabels[type] || type}</span>
                      <span className="text-xs text-slate-400 font-medium">
                        {loading === s.id ? "A trocar..." : `${price.toFixed(2).replace(".", ",")} €`}
                      </span>
                    </button>
                  )
                })}
                <button
                  onClick={() => setSwappingId(null)}
                  className="w-full pt-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Add service */}
      {available.length > 0 && (
        <div className="pt-1">
          {addOpen ? (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-1">
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Adicionar serviço</p>
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
                onClick={() => setAddOpen(false)}
                className="w-full mt-1 py-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#0f3460] hover:text-[#1a4a7a] transition-colors mt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar serviço
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded">{error}</p>}
    </div>
  )
}
