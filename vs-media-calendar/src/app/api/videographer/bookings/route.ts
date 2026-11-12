import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calculateTotal, DEFAULT_PRICES, SERVICE_LABELS, TRAVEL_FEE_AMOUNT } from "@/lib/pricing"
import { markOverdueInvoices } from "@/lib/invoices"
import { overdueChargeCount } from "@/lib/charges"
import { createCalendarEvent } from "@/lib/google-calendar"
import { sendStatusUpdateEmail, sendAdminBookingNotificationEmail, generateICS } from "@/lib/email"
import type { ServiceType } from "@prisma/client"

// POST: o videógrafo cria uma marcação para um consultor, atribuída a si
// próprio. Entra já como aceite — não há pedido para aprovar — e é sempre em
// taxa fixa. Serve também para registar trabalhos já feitos (data no passado).
export async function POST(req: NextRequest) {
  const session = await auth()
  const user = session?.user as { id?: string; role?: string; active?: boolean } | undefined
  if (!user?.id || user.role !== "VIDEOGRAPHER" || user.active === false) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const videographerId = user.id

  const body = await req.json()
  const {
    consultantId,
    scheduledAt,
    services,
    propertyAddress,
    notes,
    hasTravelFee = false,
  } = body

  if (!consultantId || !scheduledAt || !services?.length || !propertyAddress?.trim()) {
    return NextResponse.json({ error: "Campos obrigatórios em falta" }, { status: 400 })
  }
  if (!Array.isArray(services) || services.some((s: unknown) => typeof s !== "string" || !(s in SERVICE_LABELS))) {
    return NextResponse.json({ error: "Serviço inválido" }, { status: 400 })
  }
  const when = new Date(scheduledAt)
  if (Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: "Data inválida" }, { status: 400 })
  }

  const [consultant, videographer] = await Promise.all([
    prisma.user.findFirst({
      where: { id: consultantId, role: "CONSULTANT", active: true },
      select: { id: true, name: true, email: true, teamType: true },
    }),
    prisma.user.findUnique({
      where: { id: videographerId },
      select: { id: true, name: true, email: true },
    }),
  ])
  if (!consultant) return NextResponse.json({ error: "Consultor não encontrado" }, { status: 404 })
  if (!videographer) return NextResponse.json({ error: "Videógrafo não encontrado" }, { status: 404 })

  const dbRules = await prisma.pricingRule.findMany({
    where: { active: true, teamId: null },
    select: { serviceType: true, basePrice: true },
  })
  const customPrices = { ...DEFAULT_PRICES } as Partial<Record<ServiceType, number>>
  for (const rule of dbRules) customPrices[rule.serviceType as ServiceType] = rule.basePrice

  const pricing = calculateTotal(services as ServiceType[], 0, !!hasTravelFee, consultant.teamType, customPrices)

  const booking = await prisma.booking.create({
    data: {
      consultantId: consultant.id,
      videographerId,
      scheduledAt: when,
      propertyAddress: propertyAddress.trim(),
      hasTravelFee: !!hasTravelFee,
      travelFeeAmount: hasTravelFee ? TRAVEL_FEE_AMOUNT : 0,
      notes: notes?.trim() || null,
      status: "ACCEPTED",
      paymentType: "FLAT_FEE",
      services: {
        create: pricing.services.map((s) => ({ serviceType: s.type, price: s.price })),
      },
    },
  })

  // Consultor com pagamentos em atraso: a marcação é criada na mesma (para o
  // trabalho não ficar fora da plataforma), mas o videógrafo é avisado
  let overdueWarning = false
  try {
    await markOverdueInvoices(consultant.id)
    const [overdueInvoice, staleCharges] = await Promise.all([
      prisma.monthlyInvoice.findFirst({ where: { consultantId: consultant.id, status: "OVERDUE" }, select: { id: true } }),
      overdueChargeCount(consultant.id),
    ])
    overdueWarning = !!overdueInvoice || staleCharges > 0
  } catch (e) {
    console.error("[videographer/bookings] overdue check failed:", e)
  }

  const emailData = {
    bookingId: booking.id,
    consultantName: consultant.name || "",
    consultantEmail: consultant.email || "",
    videographerName: videographer.name || "",
    videographerEmail: videographer.email || "",
    propertyAddress: booking.propertyAddress,
    scheduledAt: when,
    services: pricing.services.map((s) => s.label),
    totalAmount: pricing.total,
    status: "ACCEPTED" as const,
    durationMinutes: booking.durationMinutes,
    paymentType: "FLAT_FEE" as const,
  }

  const isFuture = when.getTime() > Date.now()
  const by = videographer.name ? ` por ${videographer.name}` : ""

  if (isFuture) {
    // Marcação futura: evento no calendário e convite (.ics) para os dois,
    // tal como quando o videógrafo aceita um pedido
    try {
      const calendarEventId = await createCalendarEvent({
        bookingId: booking.id,
        propertyAddress: booking.propertyAddress,
        scheduledAt: when,
        durationMinutes: booking.durationMinutes,
        consultantName: emailData.consultantName,
        consultantEmail: emailData.consultantEmail,
        videographerName: emailData.videographerName,
        videographerEmail: emailData.videographerEmail,
        services: emailData.services,
        notes: booking.notes,
      })
      if (calendarEventId) {
        await prisma.booking.update({ where: { id: booking.id }, data: { googleCalendarEventId: calendarEventId } })
      }
    } catch (e) {
      console.error("[videographer/bookings] calendar event failed:", e)
    }

    const ics = generateICS(emailData)
    await Promise.allSettled([
      sendStatusUpdateEmail(emailData, "consultant", `Foi criada uma marcação em seu nome${by}. Encontra em anexo o ficheiro para adicionar ao calendário.`, ics),
      sendStatusUpdateEmail(emailData, "videographer", "A marcação foi criada. Encontra em anexo o ficheiro para adicionar ao teu calendário.", ics),
      sendAdminBookingNotificationEmail(emailData),
    ])
  } else {
    // Trabalho já feito: sem convite de calendário, só o aviso
    await Promise.allSettled([
      sendStatusUpdateEmail(emailData, "consultant", `Foi registado na plataforma um serviço já realizado em seu nome${by}.`),
      sendAdminBookingNotificationEmail(emailData),
    ])
  }

  return NextResponse.json({ bookingId: booking.id, overdueWarning })
}
