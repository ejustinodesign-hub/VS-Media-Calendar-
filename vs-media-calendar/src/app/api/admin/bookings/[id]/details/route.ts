import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { recomputeMonthlyInvoice } from "@/lib/invoices"
import { updateCalendarEvent } from "@/lib/google-calendar"
import type { PropertyType } from "@prisma/client"

const PROPERTY_TYPES = ["T0", "T1", "T2", "T3", "T4", "T5_PLUS"]

function monthOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// PATCH: admin edita os dados de uma marcação já feita.
// Mudar a data muda o mês de faturação — ambos os meses são recalculados,
// pelo que a cobrança aparece logo no mês certo.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json() as {
    propertyAddress?: string
    scheduledAt?: string
    propertyType?: string | null
    notes?: string | null
    additionalIntros?: number
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true, consultantId: true, scheduledAt: true, paymentType: true,
      propertyAddress: true, googleCalendarEventId: true, durationMinutes: true,
    },
  })
  if (!booking) return NextResponse.json({ error: "Marcação não encontrada" }, { status: 404 })

  const data: Record<string, unknown> = {}

  if (body.propertyAddress !== undefined) {
    const address = body.propertyAddress.trim()
    if (!address) return NextResponse.json({ error: "A morada não pode ficar vazia." }, { status: 400 })
    data.propertyAddress = address
  }

  if (body.scheduledAt !== undefined) {
    const when = new Date(body.scheduledAt)
    if (isNaN(when.getTime())) {
      return NextResponse.json({ error: "Data inválida." }, { status: 400 })
    }
    data.scheduledAt = when
  }

  if (body.propertyType !== undefined) {
    if (body.propertyType && !PROPERTY_TYPES.includes(body.propertyType)) {
      return NextResponse.json({ error: "Tipologia inválida." }, { status: 400 })
    }
    data.propertyType = (body.propertyType || null) as PropertyType | null
  }

  if (body.notes !== undefined) {
    data.notes = body.notes?.trim() || null
  }

  if (body.additionalIntros !== undefined) {
    const n = Number(body.additionalIntros)
    if (!Number.isInteger(n) || n < 0 || n > 20) {
      return NextResponse.json({ error: "Intros adicionais tem de ser um número entre 0 e 20." }, { status: 400 })
    }
    data.additionalIntros = n
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para alterar." }, { status: 400 })
  }

  const updated = await prisma.booking.update({ where: { id }, data })

  // Recalcular o(s) mês(es) afetado(s) — a cobrança entra logo no mês certo
  const monthsToRecompute = new Set<string>()
  if (booking.paymentType === "FLAT_FEE") {
    monthsToRecompute.add(monthOf(new Date(booking.scheduledAt)))
    monthsToRecompute.add(monthOf(new Date(updated.scheduledAt)))
  }

  const paidMonths: string[] = []
  for (const month of monthsToRecompute) {
    const before = await prisma.monthlyInvoice.findFirst({
      where: { consultantId: booking.consultantId, month },
      select: { status: true },
    })
    const outcome = await recomputeMonthlyInvoice(booking.consultantId, month)
    if (before?.status === "PAID" || outcome === "skipped-paid") paidMonths.push(month)
  }

  // Manter o evento do Google Calendar alinhado
  if (booking.googleCalendarEventId && (data.propertyAddress || data.scheduledAt)) {
    try {
      await updateCalendarEvent(booking.googleCalendarEventId, {
        propertyAddress: updated.propertyAddress,
        scheduledAt: new Date(updated.scheduledAt),
        durationMinutes: updated.durationMinutes,
      })
    } catch (e) {
      console.error("[booking-details] calendar update failed:", e)
    }
  }

  return NextResponse.json({
    success: true,
    monthsRecomputed: [...monthsToRecompute],
    paidMonths,
  })
}
