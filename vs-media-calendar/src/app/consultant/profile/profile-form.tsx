"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, FileText, CheckCircle2, Camera, Loader2 } from "lucide-react"

interface UserData {
  name: string | null
  email: string | null
  image: string | null
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.image)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }))
    setSuccess(false)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarLoading(true)
    setAvatarError(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao carregar foto")
      setAvatarUrl(data.url)
      router.refresh()
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Erro inesperado")
    } finally {
      setAvatarLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
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

      {/* Avatar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="w-4 h-4 text-[#e94560]" />
            Foto de Perfil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Foto de perfil"
                  className="w-20 h-20 rounded-full object-cover border-2 border-slate-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#0f3460] flex items-center justify-center text-white text-2xl font-bold border-2 border-slate-200">
                  {user.name?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              {avatarLoading && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
                id="avatar-upload"
              />
              <label
                htmlFor="avatar-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f3460] text-white text-sm font-semibold rounded-lg hover:bg-[#1a4a7a] transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                {avatarLoading ? "A carregar..." : "Alterar foto"}
              </label>
              <p className="text-xs text-slate-400">JPG, PNG ou WebP · Máx. 5MB</p>
              {avatarError && <p className="text-xs text-red-600">{avatarError}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

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
