import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { del } from "@vercel/blob"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "VIDEOGRAPHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Find deliverable and verify it belongs to this videographer's booking
  const deliverable = await prisma.deliverable.findFirst({
    where: {
      id,
      booking: { videographerId: session.user.id },
    },
    include: { booking: { select: { id: true } } },
  })

  if (!deliverable) {
    return NextResponse.json({ error: "Ficheiro não encontrado" }, { status: 404 })
  }

  // Delete from Vercel Blob
  try {
    await del(deliverable.fileUrl)
  } catch (e) {
    console.error("Blob delete error:", e)
    // Continue even if blob deletion fails (file may already be gone)
  }

  // Delete DB record
  await prisma.deliverable.delete({ where: { id } })

  // If no deliverables remain, revert booking status to ACCEPTED
  const remaining = await prisma.deliverable.count({
    where: { bookingId: deliverable.booking.id },
  })

  if (remaining === 0) {
    await prisma.booking.update({
      where: { id: deliverable.booking.id },
      data: { status: "ACCEPTED" },
    })
  }

  return NextResponse.json({ success: true })
}
