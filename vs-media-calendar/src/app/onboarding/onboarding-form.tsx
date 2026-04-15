"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { VsMediaLogo } from "@/components/logo"

interface Field {
  name: string
  label: string
  placeholder: string
  type?: string
  required: boolean
  hint?: string
}

const consultantFields: Field[] = [
  { name: "phone", label: "Telemóvel", placeholder: "+351 9XX XXX XXX", required: true },
  { name: "billingName", label: "Nome de Faturação", placeholder: "Nome completo ou empresa", required: true },
  { name: "billingNif", label: "NIF", placeholder: "Ex: 123456789", required: true },
  { name: "billingCompany", label: "Empresa (opcional)", placeholder: "Nome da empresa", required: false },
  { name: "billingAddress", label: "Morada de Faturação", placeholder: "Rua, nº, código postal, cidade", required: true },
]

const videographerFields: Field[] = [
  { name: "phone", label: "Telemóvel", placeholder: "+351 9XX XXX XXX", required: true },
  { name: "nif", label: "NIF", placeholder: "Ex: 123456789", required: true, hint: "Necessário para processamento de salário" },
  { name: "iban", label: "IBAN", placeholder: "PT50 XXXX XXXX XXXX XXXX XXXX X", required: true, hint: "Para transferência do pagamento mensal" },
]

export function OnboardingForm({ role }: { role: string }) {
  const router = useRouter()
  const { update } = useSession()
  const isVideographer = role === "VIDEOGRAPHER"
  const fields = isVideographer ? videographerFields : consultantFields

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, ""]))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao guardar informações")
      }

      await update()
      router.push(
        role === "VIDEOGRAPHER"
          ? "/videographer/dashboard"
          : "/consultant/dashboard"
      )
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f3460] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1 mb-8">
          <img src="/logo.svg" alt="VS.Media" className="h-8 w-auto object-contain" />
          <span className="text-[9px] text-white/30 uppercase tracking-[0.2em]">Calendar</span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-xl font-bold text-slate-900">Bem-vindo à equipa!</h1>
            <p className="text-slate-500 text-sm mt-1">
              {isVideographer
                ? "Precisamos dos teus dados para processar pagamentos."
                : "Precisamos dos teus dados de faturação para emitir recibos."}
            </p>
          </div>

          {/* Role badge */}
          <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1 mb-6">
            <span className="w-2 h-2 rounded-full bg-[#e94560]" />
            <span className="text-xs font-medium text-slate-600">
              {isVideographer ? "Videógrafo" : "Consultor"}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-[#e94560] ml-0.5">*</span>}
                </label>
                <input
                  name={field.name}
                  type={field.type || "text"}
                  placeholder={field.placeholder}
                  value={values[field.name]}
                  onChange={handleChange}
                  required={field.required}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f3460]/20 focus:border-[#0f3460] transition-colors"
                />
                {field.hint && (
                  <p className="text-xs text-slate-400 mt-1">{field.hint}</p>
                )}
              </div>
            ))}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#0f3460] text-white rounded-xl font-semibold text-sm hover:bg-[#1a4a7a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "A guardar..." : "Guardar e continuar"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            Podes alterar estes dados mais tarde nas definições do perfil
          </p>
        </div>
      </div>
    </div>
  )
}
