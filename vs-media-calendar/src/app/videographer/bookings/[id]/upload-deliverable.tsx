"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { upload } from "@vercel/blob/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, FileVideo, Trash2, Download, UserPlus, X, Users } from "lucide-react"

interface DeliverableFile {
  id: string
  fileName: string
  fileUrl: string
  mimeType?: string | null
  createdAt?: Date | string
  targetConsultantId?: string | null
}

interface Consultant {
  id: string
  name: string | null
  email: string | null
}

interface IntroEntry {
  key: string
  consultantId: string
  file: File | null
  description: string
}

interface Props {
  bookingId: string
  existingFiles: DeliverableFile[]
  primaryConsultantId: string
}

export function UploadDeliverable({ bookingId, existingFiles, primaryConsultantId }: Props) {
  const [localFiles, setLocalFiles] = useState<DeliverableFile[]>(existingFiles)
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Extra intros for other consultants
  const [introEntries, setIntroEntries] = useState<IntroEntry[]>([])
  const [uploadingIntroKey, setUploadingIntroKey] = useState<string | null>(null)
  const [introProgress, setIntroProgress] = useState<Record<string, number>>({})
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [consultantsLoading, setConsultantsLoading] = useState(false)

  const router = useRouter()

  useEffect(() => {
    setLocalFiles(prev => {
      const stillPending = prev.filter(
        p => p.id.startsWith("pending-") && !existingFiles.some(e => e.fileUrl === p.fileUrl)
      )
      return [...existingFiles, ...stillPending]
    })
  }, [existingFiles])

  // Pre-load consultants if there are already intro files, so names display correctly
  useEffect(() => {
    if (existingFiles.some(f => f.targetConsultantId)) {
      loadConsultants()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadConsultants = async () => {
    if (consultants.length > 0) return
    setConsultantsLoading(true)
    try {
      const res = await fetch("/api/consultants")
      const data = await res.json()
      // Exclude the primary consultant from the list
      setConsultants((data as Consultant[]).filter(c => c.id !== primaryConsultantId))
    } catch {
      // ignore
    } finally {
      setConsultantsLoading(false)
    }
  }

  const addIntroEntry = async () => {
    await loadConsultants()
    setIntroEntries(prev => [
      ...prev,
      { key: `intro-${Date.now()}`, consultantId: "", file: null, description: "" },
    ])
  }

  const removeIntroEntry = (key: string) => {
    setIntroEntries(prev => prev.filter(e => e.key !== key))
  }

  const updateIntroEntry = (key: string, patch: Partial<IntroEntry>) => {
    setIntroEntries(prev => prev.map(e => e.key === key ? { ...e, ...patch } : e))
  }

  const doUpload = async (
    f: File,
    opts: { bookingId: string; targetConsultantId?: string; description?: string; onProgress: (p: number) => void }
  ) => {
    const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const pathname = `deliverables/${opts.bookingId}/${Date.now()}-${safeName}`

    const blob = await upload(pathname, f, {
      access: "public",
      handleUploadUrl: "/api/deliverables/upload",
      clientPayload: JSON.stringify({ bookingId: opts.bookingId }),
      multipart: true,
      onUploadProgress: ({ percentage }) => opts.onProgress(Math.round(percentage)),
    })

    const completeRes = await fetch("/api/deliverables/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: opts.bookingId,
        fileName: f.name,
        fileUrl: blob.url,
        mimeType: f.type,
        description: opts.description || null,
        targetConsultantId: opts.targetConsultantId || null,
      }),
    })

    if (!completeRes.ok) {
      const data = await completeRes.json()
      throw new Error(data.error || "Erro ao guardar ficheiro")
    }

    return blob.url
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError("")
    setProgress(0)

    try {
      const blobUrl = await doUpload(file, {
        bookingId,
        description,
        onProgress: setProgress,
      })

      setLocalFiles(prev => [
        ...prev,
        { id: `pending-${Date.now()}`, fileName: file.name, fileUrl: blobUrl, mimeType: file.type, createdAt: new Date() },
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

  const handleIntroUpload = async (entry: IntroEntry) => {
    if (!entry.file || !entry.consultantId) return
    setUploadingIntroKey(entry.key)
    setIntroProgress(prev => ({ ...prev, [entry.key]: 0 }))

    try {
      const blobUrl = await doUpload(entry.file, {
        bookingId,
        targetConsultantId: entry.consultantId,
        description: entry.description,
        onProgress: (p) => setIntroProgress(prev => ({ ...prev, [entry.key]: p })),
      })

      setLocalFiles(prev => [
        ...prev,
        {
          id: `pending-${Date.now()}`,
          fileName: entry.file!.name,
          fileUrl: blobUrl,
          mimeType: entry.file!.type,
          createdAt: new Date(),
          targetConsultantId: entry.consultantId,
        },
      ])
      removeIntroEntry(entry.key)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro no upload da intro")
    } finally {
      setUploadingIntroKey(null)
    }
  }

  const handleDelete = async (deliverableId: string) => {
    if (deliverableId.startsWith("pending-")) return
    setDeletingId(deliverableId)
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao apagar")
      }
      setLocalFiles(prev => prev.filter(f => f.id !== deliverableId))
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao apagar")
    } finally {
      setDeletingId(null)
    }
  }

  const mainFiles = localFiles.filter(f => !f.targetConsultantId)
  const introFiles = localFiles.filter(f => f.targetConsultantId)

  return (
    <div className="space-y-4">
      {/* Main delivery card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#0f3460]" />
            Entrega do Conteúdo Final
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mainFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                {mainFiles.length === 1 ? "1 ficheiro entregue:" : `${mainFiles.length} ficheiros entregues:`}
              </p>
              {mainFiles.map(f => <FileRow key={f.id} f={f} deletingId={deletingId} onDelete={handleDelete} />)}
            </div>
          )}

          <DropZone file={file} inputId="deliverable-upload" onFileChange={setFile} onErrorClear={() => setError("")} />

          {file && (
            <input
              type="text"
              placeholder="Descrição (opcional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#0f3460] focus:ring-2 focus:ring-[#0f3460]/10"
            />
          )}

          {uploading && <ProgressBar progress={progress} />}
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

          {file && (
            <Button onClick={handleUpload} disabled={uploading} loading={uploading} className="w-full">
              <Upload className="w-4 h-4" />
              {uploading ? `A carregar... ${progress}%` : "Fazer Upload"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Extra intros for other consultants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-[#e94560]" />
            Versões para outros consultores
            <span className="ml-auto text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              10€ / consultor
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-500">
            Filmou uma versão com intro personalizada para outro consultor? Entregue aqui.
            Receberá 10€ por cada entrega.
          </p>

          {/* Already uploaded intros */}
          {introFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Intros entregues:</p>
              {introFiles.map(f => (
                <FileRow key={f.id} f={f} deletingId={deletingId} onDelete={handleDelete} showConsultantBadge consultants={consultants} />
              ))}
            </div>
          )}

          {/* Pending intro uploads */}
          {introEntries.map(entry => (
            <div key={entry.key} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Nova intro</p>
                <button
                  onClick={() => removeIntroEntry(entry.key)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <select
                value={entry.consultantId}
                onChange={e => updateIntroEntry(entry.key, { consultantId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3460]/30 focus:border-[#0f3460] bg-white"
              >
                <option value="">
                  {consultantsLoading ? "A carregar consultores..." : "Selecionar consultor..."}
                </option>
                {consultants.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.email}
                  </option>
                ))}
              </select>

              <DropZone
                file={entry.file}
                inputId={`intro-upload-${entry.key}`}
                onFileChange={f => updateIntroEntry(entry.key, { file: f })}
                onErrorClear={() => setError("")}
                label="Clique para selecionar o vídeo desta intro"
              />

              {entry.file && (
                <input
                  type="text"
                  placeholder="Descrição (opcional)"
                  value={entry.description}
                  onChange={e => updateIntroEntry(entry.key, { description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#0f3460] focus:ring-2 focus:ring-[#0f3460]/10"
                />
              )}

              {uploadingIntroKey === entry.key && (
                <ProgressBar progress={introProgress[entry.key] ?? 0} />
              )}

              {entry.file && entry.consultantId && (
                <Button
                  onClick={() => handleIntroUpload(entry)}
                  disabled={uploadingIntroKey === entry.key}
                  loading={uploadingIntroKey === entry.key}
                  className="w-full"
                  variant="secondary"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingIntroKey === entry.key
                    ? `A carregar... ${introProgress[entry.key] ?? 0}%`
                    : "Entregar intro"}
                </Button>
              )}
            </div>
          ))}

          <button
            onClick={addIntroEntry}
            className="flex items-center gap-2 w-full px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-500 hover:border-[#e94560] hover:text-[#e94560] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Adicionar versão para outro consultor
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

function FileRow({
  f,
  deletingId,
  onDelete,
  showConsultantBadge = false,
  consultants = [],
}: {
  f: DeliverableFile
  deletingId: string | null
  onDelete: (id: string) => void
  showConsultantBadge?: boolean
  consultants?: Consultant[]
}) {
  const consultantName = showConsultantBadge && f.targetConsultantId
    ? consultants.find(c => c.id === f.targetConsultantId)?.name || "Consultor"
    : null

  return (
    <div className="rounded-xl border border-emerald-200 overflow-hidden bg-emerald-50">
      {f.mimeType?.startsWith("video/") && (
        <video controls preload="metadata" className="w-full bg-black" style={{ maxHeight: "280px" }}>
          <source src={f.fileUrl} type={f.mimeType} />
        </video>
      )}
      {f.mimeType?.startsWith("image/") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={f.fileUrl} alt={f.fileName} className="w-full object-contain" style={{ maxHeight: "280px" }} />
      )}
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <FileVideo className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{f.fileName}</p>
          {consultantName && (
            <p className="text-xs text-[#e94560] font-medium mt-0.5">Intro para: {consultantName}</p>
          )}
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
          onClick={() => onDelete(f.id)}
          disabled={deletingId === f.id || f.id.startsWith("pending-")}
          title={f.id.startsWith("pending-") ? "A guardar..." : "Apagar ficheiro"}
          className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function DropZone({
  file,
  inputId,
  onFileChange,
  onErrorClear,
  label,
}: {
  file: File | null
  inputId: string
  onFileChange: (f: File | null) => void
  onErrorClear: () => void
  label?: string
}) {
  return (
    <div
      className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
        file ? "border-[#0f3460] bg-[#0f3460]/5" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <input
        type="file"
        id={inputId}
        className="hidden"
        accept="video/*,image/*,.pdf,.zip"
        onChange={e => {
          onFileChange(e.target.files?.[0] || null)
          onErrorClear()
        }}
      />
      <label htmlFor={inputId} className="cursor-pointer">
        {file ? (
          <div>
            <FileVideo className="w-8 h-8 text-[#0f3460] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#0f3460]">{file.name}</p>
            <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        ) : (
          <div>
            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">
              {label || "Clique para selecionar o ficheiro"}
            </p>
            <p className="text-xs text-slate-400 mt-1">Vídeo, imagem, PDF ou ZIP</p>
          </div>
        )}
      </label>
    </div>
  )
}

function ProgressBar({ progress }: { progress: number }) {
  return (
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
  )
}
