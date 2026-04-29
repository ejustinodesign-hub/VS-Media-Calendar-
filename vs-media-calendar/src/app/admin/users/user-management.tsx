"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Check, X } from "lucide-react"
import type { Role } from "@prisma/client"

interface Props {
  userId: string
  currentRole: Role
  currentActive: boolean
  currentName: string | null
}

export function UserManagement({ userId, currentRole, currentActive, currentName }: Props) {
  const [loading, setLoading] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(currentName ?? "")
  const router = useRouter()

  const updateUser = async (data: Partial<{ role: Role; active: boolean; name: string }>) => {
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

  const saveName = async () => {
    if (nameInput.trim() && nameInput.trim() !== currentName) {
      await updateUser({ name: nameInput.trim() })
    }
    setEditingName(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {editingName ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false) }}
            className="text-xs px-2 py-1 border border-[#0f3460] rounded-lg w-36 focus:outline-none"
            placeholder="Nome completo"
          />
          <button onClick={saveName} disabled={loading} className="p-1 text-emerald-600 hover:text-emerald-700">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setNameInput(currentName ?? ""); setEditingName(false) }} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditingName(true)}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors w-fit"
        >
          <Pencil className="w-3 h-3" />
          Editar nome
        </button>
      )}
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
    </div>
  )
}
