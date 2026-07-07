import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const { remaxUrl } = await req.json()

  // Accept empty string to clear the URL
  const url = remaxUrl?.trim() || null

  if (url && !url.startsWith("https://remax.pt/")) {
    return NextResponse.json({ error: "URL inválido. Deve ser um link da remax.pt" }, { status: 400 })
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: { remaxUrl: url, remaxSoldAt: url ? undefined : null },
    select: { id: true, remaxUrl: true, remaxSoldAt: true },
  })

  return NextResponse.json(booking)
}
