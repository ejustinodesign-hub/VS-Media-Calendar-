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
  const role = (session?.user as any)?.role
  if (!session?.user || (role !== "VIDEOGRAPHER" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Admins can delete any deliverable; videographers only their own bookings
  const where = role === "ADMIN"
    ? { id }
    : { id, booking: { videographerId: session.user.id } }

  const deliverable = await prisma.deliverable.findFirst({
    where,
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

  // If no deliverables remain for the booking, revert booking status to ACCEPTED
  if (deliverable.booking) {
    const remaining = await prisma.deliverable.count({
      where: { bookingId: deliverable.booking.id },
    })
    if (remaining === 0) {
      await prisma.booking.update({
        where: { id: deliverable.booking.id },
        data: { status: "ACCEPTED" },
      })
    }
  }

  return NextResponse.json({ success: true })
}
