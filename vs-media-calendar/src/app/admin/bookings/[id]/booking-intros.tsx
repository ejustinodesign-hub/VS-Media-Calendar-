"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, AlertCircle, Trash2, Package, X } from "lucide-react"

interface Consultant { id: string; name: string | null; email: string | null }

export interface BookingIntro {
  id: string
  description: string | null
  consultantNames: string[]
  netEach: number
}

interface Props {
  bookingId: string
  intros: BookingIntro[]
  monthLabel: string
  introPrice: number
}

// Lista e adiciona intros de consultores numa marcação já feita.
// A intro é cobrada no mês do vídeo.
export function BookingIntros({ bookingId, intros, monthLabel, introPrice }: Props) {
  const [adding, setAdding] = useState(false)
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const router = useRouter()

  async function openAdd() {
    setAdding(true)
    setSelected([])
    setError("")
    if (consultants.length === 0) {
      try {
        const res = await fetch("/api/consultants")
        if (res.ok) setConsultants(await res.json())
      } catch { /* ignore */ }
    }
  }

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id]
    )
  }

  async function save() {
    if (selected.length === 0) { setError("Escolha pelo menos um consultor."); return }
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/intros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultantIds: selected }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Erro ao guardar"); return }
      if (data.paidConsultants?.length) {
        setNotice(`Fatura já paga, valor não alterado: ${data.paidConsultants.join(", ")}. Acerte à parte.`)
      }
      setAdding(false)
      router.refresh()
    } catch {
      setError("Erro de ligação.")
    } finally {
      setBusy(false)
    }
  }

  async function remove(introId: string) {
    if (!confirm("Remover esta intro? A cobrança é estornada nas faturas não pagas.")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/deliverables/${introId}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || "Erro ao remover")
        return
      }
      router.refresh()
    } catch {
      setError("Erro de ligação.")
    } finally {
      setBusy(false)
    }
  }

  const netEach = selected.length > 0
    ? Math.round((introPrice / selected.length) * 100) / 100
    : introPrice

  return (
    <div className="space-y-3">
      {notice && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{notice}</p>
            <button onClick={() => setNotice("")} className="underline font-semibold mt-1">Fechar</button>
          </div>
        </div>
      )}

      {intros.length > 0 ? (
        <div className="space-y-1.5">
          {intros.map((i) => (
            <div key={i.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-slate-50 last:border-0">
              <Package className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-slate-700 truncate">{i.consultantNames.join(", ")}</p>
                {i.consultantNames.length > 1 && (
                  <p className="text-[11px] text-violet-500">
                    Partilhada por {i.consultantNames.length} — {introPrice.toFixed(2).replace(".", ",")} € ÷ {i.consultantNames.length}
                  </p>
                )}
              </div>
              <p className="text-sm font-medium text-slate-800 whitespace-nowrap">
                {i.netEach.toFixed(2).replace(".", ",")} € <span className="text-xs text-slate-400">cada</span>
              </p>
              <button
                onClick={() => remove(i.id)}
                disabled={busy}
                title="Remover intro"
                className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Sem intros de outros consultores neste vídeo.</p>
      )}

      {adding ? (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600">Consultores na intro (máx. 4):</p>
            <button onClick={() => setAdding(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {consultants.length === 0 ? (
            <p className="text-xs text-slate-400">A carregar consultores…</p>
          ) : (
            <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
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
              {netEach.toFixed(2).replace(".", ",")} € s/ IVA por consultor · cobrado na fatura de {monthLabel}
            </p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={busy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0f3460] text-white text-xs font-semibold rounded-lg hover:bg-[#1a4a7a] disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3 h-3 animate-spin" />}
              Adicionar intro
            </button>
            <button
              onClick={() => setAdding(false)}
              disabled={busy}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar intro de consultor
        </button>
      )}

      {error && !adding && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
