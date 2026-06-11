import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendStatusUpdateEmail } from "@/lib/email"
import { SERVICE_LABELS, IVA_RATE } from "@/lib/pricing"

const INTRO_PRICE_NET = 25
const INTRO_PRICE_WITH_IVA = Math.round(INTRO_PRICE_NET * (1 + IVA_RATE) * 100) / 100
const INTRO_SPLIT_NET = INTRO_PRICE_NET / 2
const INTRO_SPLIT_WITH_IVA = Math.round(INTRO_SPLIT_NET * (1 + IVA_RATE) * 100) / 100
const VIDEOGRAPHER_FEE = 10

async function chargeConsultantInvoice(consultantId: string, net: number, withIva: number) {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const existing = await prisma.monthlyInvoice.findFirst({ where: { consultantId, month } })
  if (existing) {
    await prisma.monthlyInvoice.update({
      where: { id: existing.id },
      data: { subtotal: existing.subtotal + net, total: existing.total + withIva },
    })
  } else {
    await prisma.monthlyInvoice.create({
      data: { consultantId, month, subtotal: net, total: withIva, dueDate, status: "PENDING" },
    })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "VIDEOGRAPHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { bookingId, fileName, fileUrl, mimeType, description, targetConsultantId, secondConsultantId } =
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

  // Handle extra intro for other consultant(s)
  if (targetConsultantId) {
    const targetConsultant = await prisma.user.findFirst({
      where: { id: targetConsultantId, role: { in: ["CONSULTANT", "ADMIN"] }, active: true },
      select: { id: true, name: true, email: true },
    })
    if (!targetConsultant) {
      return NextResponse.json({ error: "Consultor não encontrado" }, { status: 404 })
    }

    // Optional second consultant (shared intro — 25€ split in two)
    let secondConsultant: { id: string; name: string | null; email: string | null } | null = null
    if (secondConsultantId) {
      secondConsultant = await prisma.user.findFirst({
        where: { id: secondConsultantId, role: { in: ["CONSULTANT", "ADMIN"] }, active: true },
        select: { id: true, name: true, email: true },
      })
      if (!secondConsultant) {
        return NextResponse.json({ error: "Segundo consultor não encontrado" }, { status: 404 })
      }
    }

    const isShared = !!secondConsultant
    const priceNet = isShared ? INTRO_SPLIT_NET : INTRO_PRICE_NET
    const priceWithIva = isShared ? INTRO_SPLIT_WITH_IVA : INTRO_PRICE_WITH_IVA

    await prisma.deliverable.create({
      data: {
        bookingId,
        fileName,
        fileUrl,
        mimeType: mimeType || null,
        uploadedBy: session.user.id,
        description: description || null,
        targetConsultantId,
        secondConsultantId: secondConsultantId || null,
        videographerFee: VIDEOGRAPHER_FEE,
      },
    })

    // Charge first consultant
    await chargeConsultantInvoice(targetConsultantId, priceNet, priceWithIva)

    await prisma.notification.create({
      data: {
        userId: targetConsultantId,
        bookingId: booking.id,
        type: "FILE_UPLOADED",
        title: "Intro de vídeo disponível",
        message: isShared
          ? `Uma versão de vídeo partilhada com a sua introdução para o imóvel ${booking.propertyAddress} está disponível (${priceWithIva.toFixed(2).replace(".", ",")}€ c/ IVA adicionados à sua fatura).`
          : `Uma versão de vídeo com a sua introdução para o imóvel ${booking.propertyAddress} está disponível (${priceWithIva.toFixed(2).replace(".", ",")}€ c/ IVA adicionados à sua fatura).`,
      },
    })

    // Charge second consultant and notify
    if (secondConsultant) {
      await chargeConsultantInvoice(secondConsultantId, priceNet, priceWithIva)

      await prisma.notification.create({
        data: {
          userId: secondConsultantId,
          bookingId: booking.id,
          type: "FILE_UPLOADED",
          title: "Intro de vídeo disponível",
          message: `Uma versão de vídeo partilhada com a sua introdução para o imóvel ${booking.propertyAddress} está disponível (${priceWithIva.toFixed(2).replace(".", ",")}€ c/ IVA adicionados à sua fatura).`,
        },
      })
    }

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
