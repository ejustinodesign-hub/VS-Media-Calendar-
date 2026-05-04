import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calculateTotal } from "@/lib/pricing"
import { sendVideographerRequestEmail } from "@/lib/email"
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

  // Check for OVERDUE invoices
  const overdueInvoice = await prisma.monthlyInvoice.findFirst({
    where: { consultantId, status: "OVERDUE" },
    select: { id: true },
  })
  if (overdueInvoice) {
    return NextResponse.json(
      { error: "Tem faturas em atraso. Por favor regularize os pagamentos.", overdueInvoices: true },
      { status: 402 }
    )
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

  if (!videographerId || !scheduledAt || !services?.length || !propertyAddress) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const videographer = await prisma.user.findFirst({
    where: { id: videographerId, role: { in: ["VIDEOGRAPHER", "ADMIN"] }, active: true },
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

  const pricing = calculateTotal(
    services as ServiceType[],
    additionalIntros,
    hasTravelFee,
    consultant?.teamType || "INTERNAL"
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

  try {
    await sendVideographerRequestEmail({
      bookingId: booking.id,
      consultantName: consultant?.name || "",
      consultantEmail: consultant?.email || "",
      videographerName: videographer.name || "",
      videographerEmail: videographer.email || "",
      propertyAddress,
      scheduledAt: new Date(scheduledAt),
      services: pricing.services.map((s) => s.label),
      totalAmount: isCommission ? undefined : pricing.total,
      status: "PENDING_ACCEPTANCE",
    })
  } catch (e) {
    console.error("Email error:", e)
  }

  return NextResponse.json({ bookingId: booking.id })
}
