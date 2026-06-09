import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendStatusUpdateEmail } from "@/lib/email"
import { SERVICE_LABELS, IVA_RATE } from "@/lib/pricing"

const INTRO_PRICE_NET = 25
const INTRO_PRICE_WITH_IVA = Math.round(INTRO_PRICE_NET * (1 + IVA_RATE) * 100) / 100
const VIDEOGRAPHER_FEE = 10

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "VIDEOGRAPHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { bookingId, fileName, fileUrl, mimeType, description, targetConsultantId } =
    await req.json()

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

  // Handle extra intro for another consultant
  if (targetConsultantId) {
    const targetConsultant = await prisma.user.findFirst({
      where: { id: targetConsultantId, role: { in: ["CONSULTANT", "ADMIN"] }, active: true },
      select: { id: true, name: true, email: true },
    })
    if (!targetConsultant) {
      return NextResponse.json({ error: "Consultor não encontrado" }, { status: 404 })
    }

    await prisma.deliverable.create({
      data: {
        bookingId,
        fileName,
        fileUrl,
        mimeType: mimeType || null,
        uploadedBy: session.user.id,
        description: description || null,
        targetConsultantId,
        videographerFee: VIDEOGRAPHER_FEE,
      },
    })

    // Charge intro to target consultant's current month invoice (net + IVA)
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const existingInvoice = await prisma.monthlyInvoice.findFirst({
      where: { consultantId: targetConsultantId, month },
    })
    if (existingInvoice) {
      await prisma.monthlyInvoice.update({
        where: { id: existingInvoice.id },
        data: {
          subtotal: existingInvoice.subtotal + INTRO_PRICE_NET,
          total: existingInvoice.total + INTRO_PRICE_WITH_IVA,
        },
      })
    } else {
      await prisma.monthlyInvoice.create({
        data: {
          consultantId: targetConsultantId,
          month,
          subtotal: INTRO_PRICE_NET,
          total: INTRO_PRICE_WITH_IVA,
          dueDate,
          status: "PENDING",
        },
      })
    }

    await prisma.notification.create({
      data: {
        userId: targetConsultantId,
        bookingId: booking.id,
        type: "FILE_UPLOADED",
        title: "Intro de vídeo disponível",
        message: `Uma versão de vídeo com a sua introdução para o imóvel ${booking.propertyAddress} está disponível (${INTRO_PRICE_WITH_IVA.toFixed(2).replace(".", ",")}€ c/ IVA adicionados à sua fatura).`,
      },
    })

    return NextResponse.json({ success: true })
  }

  // Standard delivery to booking's own consultant
  await prisma.deliverable.create({
    data: {
      bookingId,
      fileName,
      fileUrl,
      mimeType: mimeType || null,
      uploadedBy: session.user.id,
      description: description || null,
      videographerFee: VIDEOGRAPHER_FEE,
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
