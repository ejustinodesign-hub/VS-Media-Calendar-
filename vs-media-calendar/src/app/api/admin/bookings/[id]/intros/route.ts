import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { syncIntroCharges } from "@/lib/charges"
import { MANUAL_INTRO_PREFIX, MAX_INTRO_CONSULTANTS, introConsultantData, introConsultantFilter } from "@/lib/intros"
import { ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"

const VIDEOGRAPHER_FEE = 10

// POST: admin adiciona uma intro de consultor(es) a uma marcação já feita.
// A intro é datada com a data do vídeo, por isso é cobrada no mês em que o
// vídeo aconteceu (um vídeo de setembro cobra em setembro, de imediato).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { consultantIds } = await req.json() as { consultantIds: string[] }

  if (!Array.isArray(consultantIds) || consultantIds.length === 0) {
    return NextResponse.json({ error: "Escolha pelo menos um consultor." }, { status: 400 })
  }
  if (consultantIds.length > MAX_INTRO_CONSULTANTS) {
    return NextResponse.json({ error: `Máximo de ${MAX_INTRO_CONSULTANTS} consultores por intro.` }, { status: 400 })
  }
  const ids = [...new Set(consultantIds.filter(Boolean))]
  if (ids.length !== consultantIds.length) {
    return NextResponse.json({ error: "Consultores duplicados." }, { status: 400 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true, scheduledAt: true, propertyAddress: true, videographerId: true,
      consultant: { select: { name: true } },
    },
  })
  if (!booking) return NextResponse.json({ error: "Marcação não encontrada" }, { status: 404 })

  const consultants = await prisma.user.findMany({
    where: { id: { in: ids }, role: { in: ["CONSULTANT", "ADMIN"] }, active: true },
    select: { id: true, name: true },
  })
  if (consultants.length !== ids.length) {
    return NextResponse.json({ error: "Consultor não encontrado ou inativo." }, { status: 404 })
  }

  // Evitar cobrar duas vezes o mesmo consultor neste vídeo
  const already = await prisma.deliverable.findFirst({
    where: {
      bookingId: id,
      OR: ids.flatMap((cid) => introConsultantFilter(cid)),
    },
    select: { id: true },
  })
  if (already) {
    return NextResponse.json({
      error: "Pelo menos um destes consultores já tem intro neste vídeo.",
    }, { status: 409 })
  }

  const scheduled = new Date(booking.scheduledAt)
  const ordered = ids.map((cid) => consultants.find((c) => c.id === cid)!)

  const intro = await prisma.deliverable.create({
    data: {
      bookingId: booking.id,
      fileName: `intro-${ordered[0].name?.replace(/\s+/g, "-").toLowerCase() ?? "consultor"}.mp4`,
      fileUrl: `${MANUAL_INTRO_PREFIX}${booking.id}:${Date.now()}`,
      uploadedBy: booking.videographerId,
      description: `Intro — ${booking.propertyAddress}${booking.consultant.name ? ` (imóvel de ${booking.consultant.name})` : ""}`,
      ...introConsultantData(ordered.map((c) => c.id)),
      videographerFee: VIDEOGRAPHER_FEE,
      // data do vídeo → cobrada no mês do vídeo
      createdAt: scheduled,
    },
  })

  // Cobrança da intro, uma por consultor
  const month = `${scheduled.getFullYear()}-${String(scheduled.getMonth() + 1).padStart(2, "0")}`
  await syncIntroCharges(intro.id)
  const paidConsultants: string[] = []
  for (const c of ordered) {

    try {
      await prisma.notification.create({
        data: {
          userId: c.id,
          bookingId: booking.id,
          type: "FILE_UPLOADED",
          title: "Intro adicionada",
          message: `Foi registada uma intro sua no vídeo de ${booking.propertyAddress}.`,
        },
      })
    } catch (e) {
      console.error("[booking-intros] notification failed:", e)
    }
  }

  const net = Math.round((ADDITIONAL_INTRO_PRICE / ordered.length) * 100) / 100

  return NextResponse.json({
    success: true,
    month,
    consultants: ordered.map((c) => c.name),
    netEach: net,
    paidConsultants,
  })
}
