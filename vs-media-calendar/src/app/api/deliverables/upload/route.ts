import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { put } from "@vercel/blob"
import { sendStatusUpdateEmail } from "@/lib/email"
import { SERVICE_LABELS } from "@/lib/pricing"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session?.user as any)?.role !== "VIDEOGRAPHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File
  const bookingId = formData.get("bookingId") as string
  const description = formData.get("description") as string

  if (!file || !bookingId) {
    return NextResponse.json({ error: "Missing file or bookingId" }, { status: 400 })
  }

  // Verify this booking belongs to this videographer
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      videographerId: session.user.id,
      status: { in: ["ACCEPTED", "IN_PROGRESS"] },
    },
    include: {
      consultant: { select: { name: true, email: true } },
      videographer: { select: { name: true, email: true } },
      services: true,
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found or not in correct state" }, { status: 404 })
  }

  // Upload to Vercel Blob
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  const blob = await put(`deliverables/${bookingId}/${fileName}`, file, {
    access: "public",
  })
  const fileUrl = blob.url

  // Create deliverable record
  await prisma.deliverable.create({
    data: {
      bookingId,
      fileName: file.name,
      fileUrl,
      fileSize: file.size,
      mimeType: file.type,
      uploadedBy: session.user.id,
      description: description || null,
    },
  })

  // Update booking status to FILE_DELIVERED
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "FILE_DELIVERED" },
  })

  // Notify consultant
  await prisma.notification.create({
    data: {
      userId: booking.consultantId,
      bookingId: booking.id,
      type: "FILE_UPLOADED",
      title: "Conteúdo final entregue",
      message: `O conteúdo final do serviço de ${new Date(booking.scheduledAt).toLocaleDateString("pt-PT")} está disponível.`,
    },
  })

  try {
    const emailData = {
      bookingId: booking.id,
      consultantName: booking.consultant.name || "",
      consultantEmail: booking.consultant.email || "",
      videographerName: booking.videographer.name || "",
      videographerEmail: booking.videographer.email || "",
      propertyAddress: booking.propertyAddress,
      scheduledAt: new Date(booking.scheduledAt),
      services: booking.services.map(
        (s) => SERVICE_LABELS[s.serviceType as keyof typeof SERVICE_LABELS]
      ),
      status: "FILE_DELIVERED" as const,
    }
    await sendStatusUpdateEmail(emailData, "consultant", "O conteúdo final foi entregue e está disponível para download na plataforma.")
  } catch (e) {
    console.error("Email error:", e)
  }

  return NextResponse.json({ success: true, fileUrl })
}
