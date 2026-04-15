"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { UserPlus } from "lucide-react"

export function InviteUserForm() {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("CONSULTANT")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSuccess(null)
    setError(null)

    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao convidar utilizador")

      setSuccess(`${email} foi convidado como ${role === "CONSULTANT" ? "Consultor" : role === "VIDEOGRAPHER" ? "Videógrafo" : "Admin"}.`)
      setEmail("")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <input
        type="email"
        placeholder="email@gmail.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3460]/20 focus:border-[#0f3460]"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0f3460] bg-white text-slate-700"
      >
        <option value="CONSULTANT">Consultor</option>
        <option value="VIDEOGRAPHER">Videógrafo</option>
        <option value="ADMIN">Admin</option>
      </select>
      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-[#0f3460] text-white text-sm font-semibold rounded-lg hover:bg-[#1a4a7a] transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        <UserPlus className="w-4 h-4" />
        {loading ? "A convidar..." : "Convidar"}
      </button>

      {success && (
        <div className="sm:col-span-full text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {success}
        </div>
      )}
      {error && (
        <div className="sm:col-span-full text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </form>
  )
}
