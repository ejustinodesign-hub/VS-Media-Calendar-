"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { upload } from "@vercel/blob/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, FileVideo, CheckCircle2, Trash2 } from "lucide-react"

interface DeliverableFile {
  id: string
  fileName: string
  fileUrl: string
  expiresAt?: Date | string | null
}

interface Props {
  bookingId: string
  existingFiles: DeliverableFile[]
}

export function UploadDeliverable({ bookingId, existingFiles }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError("")
    setProgress(0)

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const pathname = `deliverables/${bookingId}/${Date.now()}-${safeName}`

      await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/deliverables/upload",
        clientPayload: JSON.stringify({
          bookingId,
          description,
          originalFileName: file.name,
        }),
        multipart: true,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      })

      setSuccess(true)
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
    setDeletingId(deliverableId)
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao apagar")
      }
      setSuccess(false)
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
        {/* Existing files */}
        {existingFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Ficheiros entregues:</p>
            {existingFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 p-2.5 bg-emerald-50 rounded-lg border border-emerald-200"
              >
                <FileVideo className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-emerald-800 font-medium truncate">{f.fileName}</p>
                  {f.expiresAt && (
                    <p className="text-xs text-amber-600">
                      Expira em {new Date(f.expiresAt).toLocaleDateString("pt-PT")}
                    </p>
                  )}
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <button
                  onClick={() => handleDelete(f.id)}
                  disabled={deletingId === f.id}
                  title="Apagar ficheiro"
                  className="ml-1 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
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
              setSuccess(false)
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
                  {existingFiles.length > 0
                    ? "Clique para adicionar outro ficheiro"
                    : "Clique para selecionar o ficheiro"}
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

        {success && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-lg">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Ficheiro entregue com sucesso!</span>
          </div>
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
