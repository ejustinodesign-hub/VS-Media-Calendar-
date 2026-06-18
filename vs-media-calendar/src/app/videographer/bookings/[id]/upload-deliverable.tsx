"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { upload } from "@vercel/blob/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, FileVideo, Trash2, Download, UserPlus, X, Users } from "lucide-react"

const INTRO_PRICE_NET = 25
const IVA = 0.23

function pricePerConsultant(count: number) {
  const net = Math.round((INTRO_PRICE_NET / count) * 100) / 100
  const gross = Math.round(net * (1 + IVA) * 100) / 100
  return { net, gross }
}

interface DeliverableFile {
  id: string
  fileName: string
  fileUrl: string
  mimeType?: string | null
  createdAt?: Date | string
  targetConsultantId?: string | null
  secondConsultantId?: string | null
  thirdConsultantId?: string | null
  fourthConsultantId?: string | null
}

interface Consultant {
  id: string
  name: string | null
  email: string | null
}

interface IntroEntry {
  key: string
  count: 1 | 2 | 3 | 4
  consultantIds: string[]
  hasCta: boolean
  file: File | null
  description: string
}

interface Props {
  bookingId: string
  existingFiles: DeliverableFile[]
  primaryConsultantId: string
  videographerHasCta?: boolean
}

export function UploadDeliverable({ bookingId, existingFiles, primaryConsultantId, videographerHasCta = false }: Props) {
  const [localFiles, setLocalFiles] = useState<DeliverableFile[]>(existingFiles)
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  useEffect(() => {
    if (existingFiles.some(f => f.targetConsultantId)) loadConsultants()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadConsultants = async () => {
    if (consultants.length > 0) return
    setConsultantsLoading(true)
    try {
      const res = await fetch("/api/consultants")
      const data = await res.json()
      setConsultants((data as Consultant[]).filter(c => c.id !== primaryConsultantId))
    } catch { /* ignore */ }
    finally { setConsultantsLoading(false) }
  }

  const makeEntry = (): IntroEntry => ({
    key: `intro-${Date.now()}`,
    count: 1,
    consultantIds: [""],
    hasCta: false,
    file: null,
    description: "",
  })

  const addIntroEntry = async () => {
    await loadConsultants()
    setIntroEntries(prev => [...prev, makeEntry()])
  }

  const removeIntroEntry = (key: string) =>
    setIntroEntries(prev => prev.filter(e => e.key !== key))

  const updateEntry = (key: string, patch: Partial<IntroEntry>) =>
    setIntroEntries(prev => prev.map(e => e.key === key ? { ...e, ...patch } : e))

  const setCount = (key: string, count: 1 | 2 | 3 | 4) => {
    setIntroEntries(prev => prev.map(e => {
      if (e.key !== key) return e
      const ids = [...e.consultantIds]
      while (ids.length < count) ids.push("")
      return { ...e, count, consultantIds: ids.slice(0, count) }
    }))
  }

  const setConsultantId = (key: string, idx: number, id: string) => {
    setIntroEntries(prev => prev.map(e => {
      if (e.key !== key) return e
      const ids = [...e.consultantIds]
      ids[idx] = id
      return { ...e, consultantIds: ids }
    }))
  }

  const doUpload = async (
    f: File,
    opts: {
      bookingId: string
      consultantIds?: string[]
      hasCta?: boolean
      description?: string
      onProgress: (p: number) => void
    }
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
        consultantIds: opts.consultantIds?.filter(Boolean) || [],
        hasCta: opts.hasCta || false,
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
      const blobUrl = await doUpload(file, { bookingId, description, onProgress: setProgress })
      setLocalFiles(prev => [...prev, {
        id: `pending-${Date.now()}`, fileName: file.name, fileUrl: blobUrl,
        mimeType: file.type, createdAt: new Date(),
      }])
      setFile(null); setDescription(""); setProgress(0)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro no upload")
    } finally { setUploading(false) }
  }

  const handleIntroUpload = async (entry: IntroEntry) => {
    if (!entry.file) return
    const validIds = entry.consultantIds.filter(Boolean)
    if (validIds.length !== entry.count) return
    setUploadingIntroKey(entry.key)
    setIntroProgress(prev => ({ ...prev, [entry.key]: 0 }))
    try {
      const blobUrl = await doUpload(entry.file, {
        bookingId,
        consultantIds: validIds,
        hasCta: entry.hasCta,
        description: entry.description,
        onProgress: (p) => setIntroProgress(prev => ({ ...prev, [entry.key]: p })),
      })
      setLocalFiles(prev => [...prev, {
        id: `pending-${Date.now()}`,
        fileName: entry.file!.name,
        fileUrl: blobUrl,
        mimeType: entry.file!.type,
        createdAt: new Date(),
        targetConsultantId: validIds[0] || null,
        secondConsultantId: validIds[1] || null,
        thirdConsultantId: validIds[2] || null,
        fourthConsultantId: validIds[3] || null,
      }])
      removeIntroEntry(entry.key)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro no upload da intro")
    } finally { setUploadingIntroKey(null) }
  }

  const handleDelete = async (deliverableId: string) => {
    if (deliverableId.startsWith("pending-")) return
    setDeletingId(deliverableId)
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error || "Erro ao apagar")
      setLocalFiles(prev => prev.filter(f => f.id !== deliverableId))
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao apagar")
    } finally { setDeletingId(null) }
  }

  const mainFiles = localFiles.filter(f => !f.targetConsultantId)
  const introFiles = localFiles.filter(f => f.targetConsultantId)

  return (
    <div className="space-y-4">
      {/* Main delivery */}
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
            <input type="text" placeholder="Descrição (opcional)" value={description}
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

      {/* Extra intros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-[#e94560]" />
            Versões para outros consultores
            <span className="ml-auto text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              10€ / entrega
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-500">
            Filmou uma intro personalizada para outros consultores? Os 25€ são divididos pelo número de consultores.
          </p>

          {introFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Intros entregues:</p>
              {introFiles.map(f => (
                <FileRow key={f.id} f={f} deletingId={deletingId} onDelete={handleDelete}
                  showConsultantBadge consultants={consultants} />
              ))}
            </div>
          )}

          {introEntries.map(entry => {
            const { gross } = pricePerConsultant(entry.count)
            const validIds = entry.consultantIds.filter(Boolean)
            const canUpload = entry.file && validIds.length === entry.count
            const usedIds = new Set(validIds)

            return (
              <div key={entry.key} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Nova intro</p>
                  <button onClick={() => removeIntroEntry(entry.key)}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Count selector */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500">Número de consultores</p>
                  <div className="flex gap-1.5">
                    {([1, 2, 3, 4] as const).map(n => {
                      const { gross: g } = pricePerConsultant(n)
                      return (
                        <button key={n} onClick={() => setCount(entry.key, n)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border ${
                            entry.count === n
                              ? "bg-[#e94560] text-white border-[#e94560]"
                              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {n}×
                          <span className="block text-[10px] font-normal opacity-80 leading-none mt-0.5">
                            {g.toFixed(2).replace(".", ",")}€
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {entry.count > 1 && (
                    <p className="text-[10px] text-slate-400 text-center">
                      25,00€ ÷ {entry.count} = {gross.toFixed(2).replace(".", ",")}€ c/ IVA por consultor
                    </p>
                  )}
                </div>

                {/* CTA option — only for eligible videographers */}
                {videographerHasCta && (
                  <label className="flex items-center gap-2.5 cursor-pointer select-none bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <input
                      type="checkbox"
                      checked={entry.hasCta}
                      onChange={e => updateEntry(entry.key, { hasCta: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <span className="text-sm font-medium text-amber-800">
                      Intro com CTA
                      <span className="ml-1.5 text-xs font-normal text-amber-600">(+5€ para ti)</span>
                    </span>
                  </label>
                )}

                {/* Consultant selectors */}
                {Array.from({ length: entry.count }).map((_, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">
                      {entry.count === 1 ? "Consultor" : `${idx + 1}.º Consultor`}
                    </p>
                    <select
                      value={entry.consultantIds[idx] || ""}
                      onChange={e => setConsultantId(entry.key, idx, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3460]/30 focus:border-[#0f3460] bg-white"
                    >
                      <option value="">
                        {consultantsLoading ? "A carregar..." : "Selecionar consultor..."}
                      </option>
                      {consultants.map(c => (
                        <option key={c.id} value={c.id}
                          disabled={usedIds.has(c.id) && entry.consultantIds[idx] !== c.id}>
                          {c.name || c.email}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

                <DropZone file={entry.file} inputId={`intro-upload-${entry.key}`}
                  onFileChange={f => updateEntry(entry.key, { file: f })}
                  onErrorClear={() => setError("")}
                  label="Clique para selecionar o vídeo desta intro"
                />

                {entry.file && (
                  <input type="text" placeholder="Descrição (opcional)" value={entry.description}
                    onChange={e => updateEntry(entry.key, { description: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-[#0f3460] focus:ring-2 focus:ring-[#0f3460]/10"
                  />
                )}

                {uploadingIntroKey === entry.key && (
                  <ProgressBar progress={introProgress[entry.key] ?? 0} />
                )}

                {canUpload && (
                  <Button onClick={() => handleIntroUpload(entry)}
                    disabled={uploadingIntroKey === entry.key}
                    loading={uploadingIntroKey === entry.key}
                    className="w-full" variant="secondary"
                  >
                    <Upload className="w-4 h-4" />
                    {uploadingIntroKey === entry.key
                      ? `A carregar... ${introProgress[entry.key] ?? 0}%`
                      : entry.count === 1 ? "Entregar intro" : `Entregar intro (${entry.count} consultores)`}
                  </Button>
                )}
              </div>
            )
          })}

          <button onClick={addIntroEntry}
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
  f, deletingId, onDelete, showConsultantBadge = false, consultants = [],
}: {
  f: DeliverableFile
  deletingId: string | null
  onDelete: (id: string) => void
  showConsultantBadge?: boolean
  consultants?: Consultant[]
}) {
  const ids = [f.targetConsultantId, f.secondConsultantId, f.thirdConsultantId, f.fourthConsultantId].filter(Boolean) as string[]
  const names = showConsultantBadge
    ? ids.map(id => consultants.find(c => c.id === id)?.name || "Consultor")
    : []
  const count = ids.length
  const { gross } = count > 0 ? pricePerConsultant(count) : { gross: 0 }

  return (
    <div className="rounded-xl border border-emerald-200 overflow-hidden bg-emerald-50">
      {f.mimeType?.startsWith("video/") && (
        <video controls preload="none" className="w-full bg-black" style={{ maxHeight: "280px" }}>
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
          {names.length === 1 && (
            <p className="text-xs text-[#e94560] font-medium mt-0.5">Intro para: {names[0]}</p>
          )}
          {names.length > 1 && (
            <p className="text-xs text-[#e94560] font-medium mt-0.5">
              Intro partilhada ({names.length}×): {names.join(", ")} — {gross.toFixed(2).replace(".", ",")}€ cada
            </p>
          )}
          {f.createdAt && (() => {
            const exp = new Date(f.createdAt); exp.setDate(exp.getDate() + 15)
            return <p className="text-xs text-amber-600">Disponível até {exp.toLocaleDateString("pt-PT")}</p>
          })()}
        </div>
        <a
          href={`/api/download?url=${encodeURIComponent(f.fileUrl)}&filename=${encodeURIComponent(f.fileName)}`}
          download={f.fileName}
          title="Descarregar"
          className="p-1.5 rounded text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          <Download className="w-4 h-4" />
        </a>
        <button onClick={() => onDelete(f.id)}
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

function DropZone({ file, inputId, onFileChange, onErrorClear, label }: {
  file: File | null; inputId: string
  onFileChange: (f: File | null) => void; onErrorClear: () => void; label?: string
}) {
  return (
    <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
      file ? "border-[#0f3460] bg-[#0f3460]/5" : "border-slate-200 hover:border-slate-300"
    }`}>
      <input type="file" id={inputId} className="hidden" accept="video/*,image/*,.pdf,.zip"
        onChange={e => { onFileChange(e.target.files?.[0] || null); onErrorClear() }}
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
            <p className="text-sm font-medium text-slate-600">{label || "Clique para selecionar o ficheiro"}</p>
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
        <span>A carregar...</span><span>{progress}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div className="bg-[#0f3460] h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
