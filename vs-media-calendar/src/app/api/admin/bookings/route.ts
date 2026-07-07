import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calculateTotal, DEFAULT_PRICES } from "@/lib/pricing"
import { sendVideographerRequestEmail, sendBookingConfirmationEmail, sendAdminBookingNotificationEmail } from "@/lib/email"
import type { ServiceType, PropertyType } from "@prisma/client"

export async function POST(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const {
    consultantId,
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
    commissionRate = 0.0015,
  } = body

  if (!consultantId || !videographerId || !scheduledAt || !services?.length || !propertyAddress) {
    return NextResponse.json({ error: "Campos obrigatórios em falta" }, { status: 400 })
  }
  const isCommission = paymentType === "COMMISSION"

  const [consultant, videographer] = await Promise.all([
    prisma.user.findFirst({
      where: { id: consultantId, role: "CONSULTANT" },
      select: { id: true, name: true, email: true, teamType: true },
    }),
    prisma.user.findFirst({
      where: { id: videographerId, role: "VIDEOGRAPHER" },
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

  const pricing = calculateTotal(
    services as ServiceType[],
    additionalIntros,
    hasTravelFee,
    consultant.teamType,
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
      commissionRate: isCommission ? commissionRate : null,
      services: {
        // Commission bookings: price 0 (billed on sale), flat fee: normal prices
        create: pricing.services.map((s) => ({ serviceType: s.type, price: isCommission ? 0 : s.price })),
      },
    },
  })

  const emailData = {
    bookingId: booking.id,
    consultantName: consultant.name || "",
    consultantEmail: consultant.email || "",
    videographerName: videographer.name || "",
    videographerEmail: videographer.email || "",
    propertyAddress,
    propertyType: propertyType as string | undefined,
    scheduledAt: new Date(scheduledAt),
    services: pricing.services.map((s) => s.label),
    totalAmount: pricing.total,
    status: "PENDING_ACCEPTANCE" as const,
  }

  await Promise.allSettled([
    sendVideographerRequestEmail(emailData),
    sendBookingConfirmationEmail(emailData),
    sendAdminBookingNotificationEmail(emailData),
  ])

  return NextResponse.json({ bookingId: booking.id })
}
