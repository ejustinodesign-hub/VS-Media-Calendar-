import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calculateTotal, DEFAULT_PRICES } from "@/lib/pricing"
import { sendVideographerRequestEmail, sendBookingConfirmationEmail, sendAdminBookingNotificationEmail } from "@/lib/email"
import type { ServiceType, PropertyType } from "@prisma/client"

export async function POST(req: NextRequest) {
  const session = await auth()
  const userRole = (session?.user as any)?.role
  if (!session?.user || (userRole !== "CONSULTANT" && userRole !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const consultantId = session.user.id
  if (!consultantId) {
    return NextResponse.json({ error: "User ID not found" }, { status: 401 })
  }

  const body = await req.json()
  const {
    videographerId,
    scheduledAt,
    services,
    additionalIntros = 0,
    propertyAddress,
    propertyType,
    hasTravelFee = false,
    travelFeeAmount = 0,
    notes,
    paymentType = "FLAT_FEE",
  } = body

  // Block unpaid invoices only for flat-fee bookings; commission bookings are always allowed
  if (paymentType !== "COMMISSION") {
    const unpaidInvoice = await prisma.monthlyInvoice.findFirst({
      where: { consultantId, status: "OVERDUE" },
      select: { id: true },
    })
    if (unpaidInvoice) {
      return NextResponse.json(
        { error: "Tem faturas por pagar. Regularize os pagamentos antes de criar novas marcações.", overdueInvoices: true },
        { status: 402 }
      )
    }
  }

  if (!videographerId || !scheduledAt || !services?.length || !propertyAddress) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const BOOKINGS_OPEN_DATE = new Date("2026-06-01T00:00:00.000Z")
  if (new Date(scheduledAt) < BOOKINGS_OPEN_DATE) {
    return NextResponse.json(
      { error: "As marcações só estão disponíveis a partir de 1 de Junho de 2026." },
      { status: 403 }
    )
  }

  const videographer = await prisma.user.findFirst({
    where: { id: videographerId, role: "VIDEOGRAPHER", active: true },
    select: { id: true, name: true, email: true },
  })
  if (!videographer) {
    return NextResponse.json({ error: "Videographer not found" }, { status: 404 })
  }

  const consultant = await prisma.user.findUnique({
    where: { id: consultantId },
    select: { name: true, email: true, teamType: true },
  })

  const isCommission = paymentType === "COMMISSION"

  const dbRules = await prisma.pricingRule.findMany({
    where: { active: true, teamId: null },
    select: { serviceType: true, basePrice: true },
  })
  const customPrices = { ...DEFAULT_PRICES } as Partial<Record<ServiceType, number>>
  for (const rule of dbRules) customPrices[rule.serviceType as ServiceType] = rule.basePrice

  const pricing = calculateTotal(
    services as ServiceType[],
    additionalIntros,
    hasTravelFee,
    consultant?.teamType || "INTERNAL",
    customPrices
  )

  const booking = await prisma.booking.create({
    data: {
      consultantId,
      videographerId,
      scheduledAt: new Date(scheduledAt),
      propertyAddress,
      propertyType: propertyType as PropertyType | undefined,
      hasTravelFee,
      travelFeeAmount: hasTravelFee ? travelFeeAmount : 0,
      additionalIntros,
      notes,
      status: "PENDING_ACCEPTANCE",
      paymentType: isCommission ? "COMMISSION" : "FLAT_FEE",
      commissionRate: isCommission ? 0.0015 : undefined,
      services: {
        create: pricing.services.map((s) => ({
          serviceType: s.type,
          price: isCommission ? 0 : s.price,
        })),
      },
    },
  })

  const emailData = {
    bookingId: booking.id,
    consultantName: consultant?.name || "",
    consultantEmail: consultant?.email || "",
    videographerName: videographer.name || "",
    videographerEmail: videographer.email || "",
    propertyAddress,
    propertyType: propertyType as string | undefined,
    scheduledAt: new Date(scheduledAt),
    services: pricing.services.map((s) => s.label),
    totalAmount: isCommission ? undefined : pricing.total,
    status: "PENDING_ACCEPTANCE" as const,
  }

  console.log(`[bookings] sending emails → videographer: ${emailData.videographerEmail}, consultant: ${emailData.consultantEmail}`)
  const emailResults = await Promise.allSettled([
    sendVideographerRequestEmail(emailData),
    sendBookingConfirmationEmail(emailData),
    sendAdminBookingNotificationEmail(emailData),
  ])
  emailResults.forEach((r, i) => {
    const label = i === 0 ? "videographer" : "consultant"
    if (r.status === "rejected") {
      console.error(`[bookings] email[${label}] failed:`, r.reason)
    } else {
      console.log(`[bookings] email[${label}] result:`, JSON.stringify(r.value))
    }
  })

  return NextResponse.json({ bookingId: booking.id })
}
