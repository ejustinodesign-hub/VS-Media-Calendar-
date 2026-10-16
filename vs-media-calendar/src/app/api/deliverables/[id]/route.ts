import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { del } from "@vercel/blob"
import { IVA_RATE, ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"
import { syncIntroCharges, syncBookingCharge } from "@/lib/charges"
import { INTRO_CONSULTANT_FIELDS, introConsultantData, MAX_INTRO_CONSULTANTS } from "@/lib/intros"

function round2(n: number) {
  return Math.round(n * 100) / 100
}

interface RouteContext {
  params: Promise<{ id: string }>
}

// PATCH: admin edita com que consultores uma intro é partilhada.
// Recalcula as faturas do mês do upload para todos os consultores afetados
// (removidos e adicionados), pelo que a cobrança passa a 25€ ÷ nº de consultores.
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { consultantIds } = await req.json()
  if (!Array.isArray(consultantIds) || consultantIds.length < 1 || consultantIds.length > MAX_INTRO_CONSULTANTS) {
    return NextResponse.json({ error: `Indique entre 1 e ${MAX_INTRO_CONSULTANTS} consultores.` }, { status: 400 })
  }
  const unique = [...new Set(consultantIds.filter(Boolean))] as string[]
  if (unique.length !== consultantIds.length) {
    return NextResponse.json({ error: "Consultores duplicados." }, { status: 400 })
  }

  const deliverable = await prisma.deliverable.findUnique({ where: { id } })
  if (!deliverable) {
    return NextResponse.json({ error: "Ficheiro não encontrado" }, { status: 404 })
  }
  if (deliverable.fileUrl.startsWith("backfill:")) {
    return NextResponse.json({ error: "As intros de junho são geridas pelo botão «Repor triplicados»." }, { status: 400 })
  }
  if (!deliverable.targetConsultantId) {
    return NextResponse.json({ error: "Este ficheiro não é uma intro partilhada." }, { status: 400 })
  }

  const validCount = await prisma.user.count({
    where: { id: { in: unique }, role: { in: ["CONSULTANT", "ADMIN"] }, active: true },
  })
  if (validCount !== unique.length) {
    return NextResponse.json({ error: "Consultor não encontrado." }, { status: 404 })
  }

  const before = [
    ...INTRO_CONSULTANT_FIELDS.map((f) => deliverable[f]),
  ].filter(Boolean) as string[]

  await prisma.deliverable.update({
    where: { id },
    data: {
      ...introConsultantData(unique),
    },
  })

  const charges = await syncIntroCharges(id)
  const affected = new Set([...before, ...unique])
  const skippedPaid = charges.filter((c) => c.status === "PAID").map((c) => c.consultantId)

  return NextResponse.json({ ok: true, recomputed: affected.size, skippedPaid })
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
    include: { booking: { select: { id: true, consultantId: true, scheduledAt: true } } },
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

  // As cobranças deste ficheiro desaparecem com ele (cascade). Se a marcação
  // deixou de ter ficheiros, volta a não estar entregue e a cobrança do vídeo
  // é removida — só se cobra o que foi entregue.
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
    try {
      await syncBookingCharge(deliverable.booking.id)
    } catch (e) {
      console.error("[deliverables/delete] syncBookingCharge failed:", e)
    }
  }

  return NextResponse.json({ success: true })
}
