"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Role } from "@prisma/client"

interface Props {
  userId: string
  currentRole: Role
  currentActive: boolean
}

export function UserManagement({ userId, currentRole, currentActive }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const updateUser = async (data: Partial<{ role: Role; active: boolean }>) => {
    setLoading(true)
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentRole}
        onChange={(e) => updateUser({ role: e.target.value as Role })}
        disabled={loading}
        className="text-xs px-2 py-1 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-[#0f3460]"
      >
        <option value="CONSULTANT">Consultor</option>
        <option value="VIDEOGRAPHER">Videógrafo</option>
        <option value="ADMIN">Admin</option>
      </select>
      <button
        onClick={() => updateUser({ active: !currentActive })}
        disabled={loading}
        className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
          currentActive
            ? "bg-red-50 text-red-600 hover:bg-red-100"
            : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
        }`}
      >
        {currentActive ? "Desativar" : "Ativar"}
      </button>
    </div>
  )
}
