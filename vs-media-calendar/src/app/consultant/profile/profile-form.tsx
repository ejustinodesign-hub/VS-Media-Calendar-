"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, FileText, CheckCircle2 } from "lucide-react"

interface UserData {
  name: string | null
  email: string | null
  phone: string | null
  billingName: string | null
  billingCompany: string | null
  billingNif: string | null
  billingAddress: string | null
}

export function ProfileForm({ user }: { user: UserData }) {
  const [values, setValues] = useState({
    phone: user.phone || "",
    billingName: user.billingName || "",
    billingCompany: user.billingCompany || "",
    billingNif: user.billingNif || "",
    billingAddress: user.billingAddress || "",
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao guardar")
      }
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Account info (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4 text-[#e94560]" />
            Conta Google
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nome</label>
            <p className="text-sm text-slate-900 font-medium">{user.name || "—"}</p>
            <p className="text-xs text-slate-400 mt-0.5">Alterado automaticamente pelo Google</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
            <p className="text-sm text-slate-900 font-medium">{user.email}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Telemóvel</label>
            <input
              name="phone"
              type="tel"
              value={values.phone}
              onChange={handleChange}
              placeholder="+351 9XX XXX XXX"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3460]/20 focus:border-[#0f3460]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Billing info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-[#e94560]" />
            Dados de Faturação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { name: "billingName", label: "Nome de Faturação", placeholder: "Nome completo ou empresa", required: true },
            { name: "billingNif", label: "NIF", placeholder: "Ex: 123456789", required: true },
            { name: "billingCompany", label: "Empresa (opcional)", placeholder: "Nome da empresa", required: false },
            { name: "billingAddress", label: "Morada de Faturação", placeholder: "Rua, nº, código postal, cidade", required: true },
          ].map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {field.label}
                {field.required && <span className="text-[#e94560] ml-0.5">*</span>}
              </label>
              <input
                name={field.name}
                type="text"
                value={values[field.name as keyof typeof values]}
                onChange={handleChange}
                placeholder={field.placeholder}
                required={field.required}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3460]/20 focus:border-[#0f3460]"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Dados guardados com sucesso.
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-[#0f3460] text-white rounded-xl font-semibold text-sm hover:bg-[#1a4a7a] transition-colors disabled:opacity-50"
      >
        {loading ? "A guardar..." : "Guardar alterações"}
      </button>
    </form>
  )
}
