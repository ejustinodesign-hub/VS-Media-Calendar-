"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusCircle, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { formatPrice } from "@/lib/pricing"

interface Line {
  label: string
  total: number | null
  outcome: "criado" | "já existia" | "erro"
  error?: string
}

// O que vai ser cobrado, com IVA — mostrado antes de confirmar
const PREVIEW: { label: string; total: number }[] = [
  { label: "Alex — Moradia Azeitão (vídeo + fotografias T3/T4)", total: 190.65 },
  { label: "Filipe Silva — Moradia Lourinhã (vídeo 2)", total: 123 },
  { label: "Filipe Silva — Terreno Odivelas (vídeo)", total: 123 },
  { label: "Farinha — Apartamento Cascais (vídeo)", total: 123 },
  { label: "Farinha — Santarém (fotografias T1/T2 + deslocação)", total: 116.85 },
  { label: "Vialonga — intro Mónica Monteiro", total: 30.75 },
  { label: "Vialonga — intro Sarah Machado", total: 30.75 },
]

// Adiciona os trabalhos de outubro feitos fora da plataforma, com data de
// 31 de outubro, e cria as cobranças.
export function OctoberJobsButton({ alreadyAdded }: { alreadyAdded: boolean }) {
  const [state, setState] = useState<"idle" | "confirm" | "loading" | "done">("idle")
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function run() {
    setState("loading")
    setError(null)
    try {
      const res = await fetch("/api/admin/backfill-october-jobs", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      setLines(data.lines)
      setState("done")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de ligação.")
      setState("confirm")
    }
  }

  // Já está tudo adicionado: não mostrar o botão (o resultado de uma execução
  // feita agora continua visível)
  if (state === "idle" && alreadyAdded) return null

  if (state === "idle") {
    return (
      <button
        onClick={() => setState("confirm")}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
      >
        <PlusCircle className="w-4 h-4" />
        Adicionar trabalhos de outubro em falta
      </button>
    )
  }

  if (state === "done") {
    const failed = lines.filter((l) => l.outcome === "erro")
    return (
      <div className={`rounded-2xl border p-4 text-sm ${failed.length ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
        <p className={`font-semibold flex items-center gap-2 ${failed.length ? "text-red-700" : "text-emerald-700"}`}>
          {failed.length ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {failed.length ? `${failed.length} trabalho(s) com erro` : "Trabalhos adicionados e cobranças criadas"}
        </p>
        <ul className="mt-2 space-y-1">
          {lines.map((l) => (
            <li key={l.label} className="flex justify-between gap-3 text-slate-700">
              <span>
                {l.label} — <span className={l.outcome === "erro" ? "text-red-600 font-medium" : "text-slate-500"}>{l.outcome}{l.error ? `: ${l.error}` : ""}</span>
              </span>
              <span className="font-semibold whitespace-nowrap">{l.total != null ? formatPrice(l.total) : "—"}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const total = PREVIEW.reduce((s, p) => s + p.total, 0)
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <p className="font-semibold text-amber-900">
        Adicionar estes trabalhos com data de 31 de outubro e criar as cobranças?
      </p>
      <ul className="mt-2 space-y-1 text-slate-700">
        {PREVIEW.map((p) => (
          <li key={p.label} className="flex justify-between gap-3">
            <span>{p.label}</span>
            <span className="font-semibold whitespace-nowrap">{formatPrice(p.total)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-3 pt-1 border-t border-amber-200 font-bold text-slate-900">
          <span>Total c/ IVA</span>
          <span>{formatPrice(total)}</span>
        </li>
      </ul>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={run}
          disabled={state === "loading"}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#0f3460] hover:bg-[#1a4a7a] disabled:opacity-50"
        >
          {state === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
          {state === "loading" ? "A adicionar…" : "Confirmar e cobrar"}
        </button>
        <button
          onClick={() => setState("idle")}
          disabled={state === "loading"}
          className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
