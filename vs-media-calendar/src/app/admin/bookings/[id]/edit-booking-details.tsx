"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Loader2, AlertCircle, X } from "lucide-react"

interface Props {
  bookingId: string
  propertyAddress: string
  scheduledAt: string // ISO
  propertyType: string | null
  notes: string | null
  additionalIntros: number
}

const PROPERTY_TYPES = ["T0", "T1", "T2", "T3", "T4", "T5_PLUS"]

// Converte ISO → "YYYY-MM-DDTHH:mm" em hora local, para o input datetime-local
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EditBookingDetails(props: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const router = useRouter()

  const [address, setAddress] = useState(props.propertyAddress)
  const [when, setWhen] = useState(toLocalInput(props.scheduledAt))
  const [type, setType] = useState(props.propertyType ?? "")
  const [notes, setNotes] = useState(props.notes ?? "")
  const [intros, setIntros] = useState(String(props.additionalIntros))

  function reset() {
    setAddress(props.propertyAddress)
    setWhen(toLocalInput(props.scheduledAt))
    setType(props.propertyType ?? "")
    setNotes(props.notes ?? "")
    setIntros(String(props.additionalIntros))
    setError("")
  }

  const monthChanged = new Date(when).getMonth() !== new Date(props.scheduledAt).getMonth()
    || new Date(when).getFullYear() !== new Date(props.scheduledAt).getFullYear()

  async function save() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/bookings/${props.bookingId}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyAddress: address,
          scheduledAt: new Date(when).toISOString(),
          propertyType: type || null,
          notes,
          additionalIntros: Number(intros),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao guardar")
        return
      }
      if (data.paidMonths?.length) {
        setNotice(`Fatura(s) já paga(s) não alterada(s): ${data.paidMonths.join(", ")}. Acerte com o consultor à parte.`)
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
      <div className="space-y-2">
        {notice && (
          <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{notice}</p>
              <button onClick={() => setNotice("")} className="underline font-semibold mt-1">Fechar</button>
            </div>
          </div>
        )}
        <button
          onClick={() => { reset(); setOpen(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar dados
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Editar marcação</p>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <Field label="Morada">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#0f3460]"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Data e hora">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#0f3460]"
          />
        </Field>
        <Field label="Tipologia">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#0f3460]"
          >
            <option value="">—</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>{t === "T5_PLUS" ? "T5+" : t}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Intros adicionais (25 € cada)">
        <input
          type="number"
          min={0}
          max={20}
          value={intros}
          onChange={(e) => setIntros(e.target.value)}
          className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#0f3460]"
        />
      </Field>

      <Field label="Notas">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#0f3460]"
        />
      </Field>

      {monthChanged && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          A nova data é de outro mês — a cobrança passa para a fatura de{" "}
          {new Date(when).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })} e sai da anterior.
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f3460] text-white text-xs font-semibold rounded-lg hover:bg-[#1a4a7a] disabled:opacity-50"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Guardar
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
