import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendStatusUpdateEmail } from "@/lib/email"
import { SERVICE_LABELS, IVA_RATE } from "@/lib/pricing"
import { syncBookingCharge, syncIntroCharges } from "@/lib/charges"
import { introConsultantData, MAX_INTRO_CONSULTANTS } from "@/lib/intros"

const INTRO_PRICE_NET = 25
const VIDEOGRAPHER_FEE = 10

function splitPrice(count: number) {
  const net = Math.round((INTRO_PRICE_NET / count) * 100) / 100
  const withIva = Math.round(net * (1 + IVA_RATE) * 100) / 100
  return { net, withIva }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "VIDEOGRAPHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const {
    bookingId, fileName, fileUrl, mimeType, description,
    // consultantIds is preferred; legacy single-id fields kept for compat
    consultantIds,
    targetConsultantId,
    secondConsultantId,
    hasCta,
  } = await req.json()

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

  // Build the list of target consultant IDs (new array format or legacy fields)
  const rawIds: string[] = consultantIds?.length
    ? consultantIds
    : [targetConsultantId, secondConsultantId].filter(Boolean)

  // Extra intro(s) for other consultant(s)
  if (rawIds.length > 0) {
    if (rawIds.length > MAX_INTRO_CONSULTANTS) {
      return NextResponse.json({ error: `Máximo de ${MAX_INTRO_CONSULTANTS} consultores` }, { status: 400 })
    }

    // Validate all consultants
    const consultants = await Promise.all(
      rawIds.map((cid) =>
        prisma.user.findFirst({
          where: { id: cid, role: { in: ["CONSULTANT", "ADMIN"] }, active: true },
          select: { id: true, name: true },
        })
      )
    )
    const missing = consultants.findIndex((c) => !c)
    if (missing !== -1) {
      return NextResponse.json({ error: `Consultor ${missing + 1} não encontrado` }, { status: 404 })
    }

    const { net, withIva } = splitPrice(rawIds.length)

    const introDeliverable = await prisma.deliverable.create({
      data: {
        bookingId,
        fileName,
        fileUrl,
        mimeType: mimeType || null,
        uploadedBy: session.user.id,
        description: description || null,
        ...introConsultantData(rawIds),
        videographerFee: VIDEOGRAPHER_FEE,
        ctaBonus: hasCta ? 5 : null,
      },
    })

    const isShared = rawIds.length > 1
    const names = consultants.map((c) => c!.name || "Consultor")
    const sharedLabel = isShared
      ? `partilhada (${rawIds.length} consultores, ${withIva.toFixed(2).replace(".", ",")}€ c/ IVA cada)`
      : `(${withIva.toFixed(2).replace(".", ",")}€ c/ IVA adicionados à sua fatura)`

    // Cobrança por intro, uma por consultor — paga individualmente
    await syncIntroCharges(introDeliverable.id)

    await Promise.all(
      rawIds.map((cid) =>
        prisma.notification.create({
          data: {
            userId: cid,
            bookingId: booking.id,
            type: "FILE_UPLOADED",
            title: "Intro de vídeo disponível",
            message: `Uma versão de vídeo ${sharedLabel} para o imóvel ${booking.propertyAddress} está disponível.`,
          },
        })
      )
    )

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

  // Vídeo entregue → cobrança deste vídeo ao consultor da marcação.
  // É o pagamento desta cobrança que liberta o download do ficheiro final.
  try {
    await syncBookingCharge(bookingId)
  } catch (e) {
    console.error("[deliverables/complete] syncBookingCharge failed:", e)
  }

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
