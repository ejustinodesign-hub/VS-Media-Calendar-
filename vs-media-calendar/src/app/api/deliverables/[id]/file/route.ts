import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getDeliverableAccess, type AccessRole } from "@/lib/deliverable-access"

const ALLOWED_HOSTS = ["public.blob.vercel-storage.com", "blob.vercel-storage.com"]

// GET /api/deliverables/[id]/file?mode=download|preview
//
// Serve o ficheiro através do servidor em vez de expor o URL do armazenamento.
// O download do ficheiro final exige que a fatura que o cobre esteja paga;
// a pré-visualização fica disponível para o consultor ver o que vai pagar.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const role = (session?.user as any)?.role as AccessRole | undefined
  const userId = (session?.user as any)?.id as string | undefined
  if (!session?.user || !role || !userId) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { id } = await params
  const mode = req.nextUrl.searchParams.get("mode") === "preview" ? "preview" : "download"

  const access = await getDeliverableAccess(id, { id: userId, role })

  if (!access.fileUrl) return new NextResponse("Ficheiro não encontrado", { status: 404 })
  if (!access.canView) return new NextResponse("Sem acesso a este ficheiro", { status: 403 })
  if (mode === "download" && !access.canDownload) {
    return new NextResponse(
      "Pagamento em falta. O ficheiro final fica disponível assim que a fatura for paga.",
      { status: 402 }
    )
  }

  // Ficheiros registados à mão (intros de backfill) não têm ficheiro real
  let parsed: URL
  try {
    parsed = new URL(access.fileUrl)
  } catch {
    return new NextResponse("Este registo não tem ficheiro associado", { status: 404 })
  }
  if (!ALLOWED_HOSTS.some((h) => parsed.hostname.endsWith(h))) {
    return new NextResponse("Origem não permitida", { status: 403 })
  }

  // Repassar o Range para o <video> poder saltar à frente
  const range = req.headers.get("range")
  const upstream = await fetch(access.fileUrl, range ? { headers: { range } } : undefined)
  if (!upstream.ok && upstream.status !== 206) {
    return new NextResponse("Ficheiro não encontrado", { status: 404 })
  }

  const headers = new Headers()
  headers.set("Content-Type", upstream.headers.get("content-type") || access.mimeType || "application/octet-stream")
  for (const h of ["content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }
  headers.set("Cache-Control", "private, no-store")

  if (mode === "download") {
    const safeName = encodeURIComponent(access.fileName || "ficheiro").replace(/%20/g, "_")
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${safeName}`)
  } else {
    headers.set("Content-Disposition", "inline")
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers })
}
