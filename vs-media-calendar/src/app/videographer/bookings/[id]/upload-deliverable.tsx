"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { upload } from "@vercel/blob/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, FileVideo, Trash2, Download } from "lucide-react"

interface DeliverableFile {
  id: string
  fileName: string
  fileUrl: string
  createdAt?: Date | string
}

interface Props {
  bookingId: string
  existingFiles: DeliverableFile[]
}

export function UploadDeliverable({ bookingId, existingFiles }: Props) {
  const [localFiles, setLocalFiles] = useState<DeliverableFile[]>(existingFiles)
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()

  // Merge server data with any pending files not yet confirmed in DB
  useEffect(() => {
    setLocalFiles(prev => {
      const stillPending = prev.filter(
        p => p.id.startsWith("pending-") && !existingFiles.some(e => e.fileUrl === p.fileUrl)
      )
      return [...existingFiles, ...stillPending]
    })
  }, [existingFiles])

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError("")
    setProgress(0)

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const pathname = `deliverables/${bookingId}/${Date.now()}-${safeName}`

      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/deliverables/upload",
        clientPayload: JSON.stringify({ bookingId }),
        multipart: true,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      })

      // Explicitly save to DB
      const completeRes = await fetch("/api/deliverables/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          fileName: file.name,
          fileUrl: blob.url,
          mimeType: file.type,
          description,
        }),
      })
      if (!completeRes.ok) {
        const data = await completeRes.json()
        throw new Error(data.error || "Erro ao guardar ficheiro")
      }

      // Show in list immediately (server will confirm on next refresh)
      setLocalFiles((prev) => [
        ...prev,
        { id: `pending-${Date.now()}`, fileName: file.name, fileUrl: blob.url, createdAt: new Date() },
      ])

      setFile(null)
      setDescription("")
      setProgress(0)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro no upload")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (deliverableId: string) => {
    if (deliverableId.startsWith("pending-")) return // not yet in DB
    setDeletingId(deliverableId)
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao apagar")
      }
      setLocalFiles((prev) => prev.filter((f) => f.id !== deliverableId))
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao apagar")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-[#0f3460]" />
          Entrega do Conteúdo Final
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Uploaded files list */}
        {localFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              {localFiles.length === 1 ? "1 ficheiro entregue:" : `${localFiles.length} ficheiros entregues:`}
            </p>
            {localFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200"
              >
                <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileVideo className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{f.fileName}</p>
                  {f.createdAt && (() => {
                    const exp = new Date(f.createdAt); exp.setDate(exp.getDate() + 15)
                    return <p className="text-xs text-amber-600">Disponível até {exp.toLocaleDateString("pt-PT")}</p>
                  })()}
                </div>
                <a
                  href={f.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Descarregar"
                  className="p-1.5 rounded text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleDelete(f.id)}
                  disabled={deletingId === f.id || f.id.startsWith("pending-")}
                  title={f.id.startsWith("pending-") ? "A guardar..." : "Apagar ficheiro"}
                  className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload area */}
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
            file ? "border-[#0f3460] bg-[#0f3460]/5" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <input
            type="file"
            id="deliverable-upload"
            className="hidden"
            accept="video/*,image/*,.pdf,.zip"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null)
              setError("")
            }}
          />
          <label htmlFor="deliverable-upload" className="cursor-pointer">
            {file ? (
              <div>
                <FileVideo className="w-8 h-8 text-[#0f3460] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#0f3460]">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">
                  {localFiles.length > 0 ? "Adicionar outro ficheiro" : "Clique para selecionar o ficheiro"}
                </p>
                <p className="text-xs text-slate-400 mt-1">Vídeo, imagem, PDF ou ZIP</p>
              </div>
            )}
          </label>
        </div>

        {file && (
          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#0f3460] focus:ring-2 focus:ring-[#0f3460]/10"
          />
        )}

        {uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>A carregar...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-[#0f3460] h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
        )}

        {file && (
          <Button
            onClick={handleUpload}
            disabled={uploading}
            loading={uploading}
            className="w-full"
          >
            <Upload className="w-4 h-4" />
            {uploading ? `A carregar... ${progress}%` : "Fazer Upload"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
