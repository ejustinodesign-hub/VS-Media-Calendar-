import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendStatusUpdateEmail } from "@/lib/email"
import { SERVICE_LABELS } from "@/lib/pricing"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "VIDEOGRAPHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { bookingId, fileName, fileUrl, mimeType, description } = await req.json()

  if (!bookingId || !fileName || !fileUrl) {
    return NextResponse.json({ error: "Campos em falta" }, { status: 400 })
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, videographerId: session.user.id },
    include: {
      consultant: { select: { name: true, email: true } },
      videographer: { select: { name: true, email: true } },
      services: true,
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Marcação não encontrada" }, { status: 404 })
  }

  await prisma.deliverable.create({
    data: {
      bookingId,
      fileName,
      fileUrl,
      mimeType: mimeType || null,
      uploadedBy: session.user.id,
      description: description || null,
    },
  })

  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "FILE_DELIVERED" },
  })

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
    await sendStatusUpdateEmail(
      emailData,
      "consultant",
      "O conteúdo final foi entregue e está disponível para download na plataforma."
    )
  } catch (e) {
    console.error("Email error:", e)
  }

  return NextResponse.json({ success: true })
}
