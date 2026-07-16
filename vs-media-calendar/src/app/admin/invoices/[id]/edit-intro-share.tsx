"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Loader2, Trash2 } from "lucide-react"

interface Consultant {
  id: string
  name: string | null
  email: string | null
}

// Editor de partilha de uma intro (admin): escolhe 1–4 consultores.
// Ao guardar, a API recalcula as faturas do mês para todos os afetados.
export function EditIntroShare({ deliverableId, current }: { deliverableId: string; current: string[] }) {
  const [open, setOpen] = useState(false)
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [selected, setSelected] = useState<string[]>(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  async function openPanel() {
    setOpen(true)
    setSelected(current)
    setError("")
    if (consultants.length === 0) {
      try {
        const res = await fetch("/api/consultants")
        if (res.ok) setConsultants(await res.json())
      } catch { /* ignore */ }
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 4) return prev
      return [...prev, id]
    })
  }

  async function save() {
    if (selected.length === 0) {
      setError("Selecione pelo menos 1 consultor.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultantIds: selected }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao guardar")
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError("Erro de ligação.")
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm("Apagar esta intro? A cobrança será estornada nas faturas não pagas.")) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Erro ao apagar")
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError("Erro de ligação.")
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={openPanel}
        title="Editar com quem esta intro é partilhada"
        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-[#0f3460] transition-colors mt-0.5"
      >
        <Pencil className="w-3 h-3" />
        Editar partilha
      </button>
    )
  }

  return (
    <div className="mt-2 p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2 max-w-sm">
      <p className="text-xs font-semibold text-slate-600">Partilhada por (máx. 4):</p>
      {consultants.length === 0 ? (
        <p className="text-xs text-slate-400">A carregar consultores…</p>
      ) : (
        <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
          {consultants.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
                disabled={!selected.includes(c.id) && selected.length >= 4}
                className="rounded border-slate-300"
              />
              <span className="truncate">{c.name || c.email}</span>
            </label>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <p className="text-[11px] text-violet-600">
          25,00 € ÷ {selected.length} = {(Math.round((25 / selected.length) * 100) / 100).toFixed(2).replace(".", ",")} € s/ IVA por consultor
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0f3460] text-white text-xs font-semibold rounded-lg hover:bg-[#1a4a7a] disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Guardar
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={busy}
          className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={remove}
          disabled={busy}
          title="Apagar intro e estornar cobrança"
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="w-3 h-3" />
          Apagar
        </button>
      </div>
    </div>
  )
}
