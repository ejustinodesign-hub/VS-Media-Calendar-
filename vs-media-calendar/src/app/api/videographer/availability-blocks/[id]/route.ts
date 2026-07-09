import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "VIDEOGRAPHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const videographerId = session.user.id!
  const { id } = await params

  const block = await prisma.availabilityBlock.findFirst({
    where: { id, videographerId },
  })
  if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.availabilityBlock.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
