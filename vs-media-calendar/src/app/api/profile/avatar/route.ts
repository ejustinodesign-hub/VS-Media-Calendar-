import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { put, del } from "@vercel/blob"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) return NextResponse.json({ error: "Ficheiro em falta" }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Tipo de ficheiro não suportado. Use JPG, PNG ou WebP." }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Ficheiro demasiado grande. Máximo 5MB." }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true },
  })

  const ext = file.type.split("/")[1].replace("jpeg", "jpg")
  const blob = await put(`avatars/${session.user.id}.${ext}`, file, {
    access: "public",
    addRandomSuffix: false,
  })

  // Remove old blob avatar if it was previously uploaded (not a Google/OAuth URL)
  if (user?.image && user.image.includes("blob.vercel-storage.com")) {
    try { await del(user.image) } catch {}
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: blob.url },
  })

  return NextResponse.json({ url: blob.url })
}
