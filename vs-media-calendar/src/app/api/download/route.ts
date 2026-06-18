import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

const ALLOWED_HOSTS = [
  "public.blob.vercel-storage.com",
  "blob.vercel-storage.com",
]

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const url = req.nextUrl.searchParams.get("url")
  const filename = req.nextUrl.searchParams.get("filename") || "download"

  if (!url) return new NextResponse("Missing url", { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return new NextResponse("Invalid url", { status: 400 })
  }

  // Only proxy from Vercel Blob to prevent SSRF
  if (!ALLOWED_HOSTS.some((h) => parsed.hostname.endsWith(h))) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const upstream = await fetch(url)
  if (!upstream.ok) {
    return new NextResponse("File not found", { status: 404 })
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream"
  const safeFilename = encodeURIComponent(filename).replace(/%20/g, "_")

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
