import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendStatusUpdateEmail } from "@/lib/email"
import { SERVICE_LABELS, IVA_RATE } from "@/lib/pricing"
import { recomputeMonthlyInvoice } from "@/lib/invoices"

const INTRO_PRICE_NET = 25
const VIDEOGRAPHER_FEE = 10

function splitPrice(count: number) {
  const net = Math.round((INTRO_PRICE_NET / count) * 100) / 100
  const withIva = Math.round(net * (1 + IVA_RATE) * 100) / 100
  return { net, withIva }
}

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
    if (rawIds.length > 4) {
      return NextResponse.json({ error: "Máximo de 4 consultores" }, { status: 400 })
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

    const [id1, id2, id3, id4] = rawIds

    await prisma.deliverable.create({
      data: {
        bookingId,
        fileName,
        fileUrl,
        mimeType: mimeType || null,
        uploadedBy: session.user.id,
        description: description || null,
        targetConsultantId: id1,
        secondConsultantId: id2 || null,
        thirdConsultantId: id3 || null,
        fourthConsultantId: id4 || null,
        videographerFee: VIDEOGRAPHER_FEE,
        ctaBonus: hasCta ? 5 : null,
      },
    })

    const isShared = rawIds.length > 1
    const names = consultants.map((c) => c!.name || "Consultor")
    const sharedLabel = isShared
      ? `partilhada (${rawIds.length} consultores, ${withIva.toFixed(2).replace(".", ",")}€ c/ IVA cada)`
      : `(${withIva.toFixed(2).replace(".", ",")}€ c/ IVA adicionados à sua fatura)`

    // Charge & notify each consultant
    await Promise.all(
      rawIds.map((cid) =>
        chargeConsultantInvoice(cid, net, withIva).then(() =>
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

  // Só vídeos entregues são faturados. Se a marcação é de um mês que o cron
  // já fechou, recalcular a fatura desse mês agora — senão a entrega tardia
  // nunca chegaria a ser cobrada.
  const scheduled = new Date(booking.scheduledAt)
  const bookingMonth = `${scheduled.getFullYear()}-${String(scheduled.getMonth() + 1).padStart(2, "0")}`
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  if (bookingMonth < currentMonth) {
    try {
      await recomputeMonthlyInvoice(booking.consultantId, bookingMonth)
    } catch (e) {
      console.error("[deliverables/complete] recompute failed:", e)
    }
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
