"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileVideo, Download, Trash2 } from "lucide-react"

interface Deliverable {
  id: string
  fileName: string
  fileUrl: string
  mimeType: string | null
  description: string | null
}

export function DeliverablesList({ deliverables }: { deliverables: Deliverable[] }) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const router = useRouter()

  async function handleDelete(id: string) {
    if (!confirm("Apagar este ficheiro permanentemente?")) return
    setDeletingId(id)
    setError("")
    try {
      const res = await fetch(`/api/deliverables/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Erro ao apagar")
      }
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
      {deliverables.map((d) => (
        <div key={d.id} className="rounded-xl border border-emerald-200 overflow-hidden bg-emerald-50">
          {d.mimeType?.startsWith("video/") && (
            <video controls preload="none" className="w-full bg-black" style={{ maxHeight: 360 }}>
              <source src={d.fileUrl} type={d.mimeType} />
            </video>
          )}
          <div className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileVideo className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{d.fileName}</p>
              {d.description && <p className="text-xs text-slate-500">{d.description}</p>}
            </div>
            <a
              href={`/api/download?url=${encodeURIComponent(d.fileUrl)}&filename=${encodeURIComponent(d.fileName)}`}
              download={d.fileName}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
            <button
              onClick={() => handleDelete(d.id)}
              disabled={deletingId === d.id}
              title="Apagar ficheiro"
              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
