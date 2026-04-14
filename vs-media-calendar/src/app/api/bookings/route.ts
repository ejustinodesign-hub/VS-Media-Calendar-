import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"
import { calculateTotal, SERVICE_LABELS } from "@/lib/pricing"
import { sendVideographerRequestEmail } from "@/lib/email"
import type { ServiceType, PropertyType } from "@prisma/client"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session?.user as any)?.role !== "CONSULTANT") {
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
    totalAmount,
  } = body

  if (!videographerId || !scheduledAt || !services?.length || !propertyAddress) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Verify videographer exists
  const videographer = await prisma.user.findFirst({
    where: { id: videographerId, role: "VIDEOGRAPHER", active: true },
    select: { id: true, name: true, email: true },
  })
  if (!videographer) {
    return NextResponse.json({ error: "Videographer not found" }, { status: 404 })
  }

  // Calculate pricing server-side
  const consultant = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, teamType: true },
  })

  const pricing = calculateTotal(
    services as ServiceType[],
    additionalIntros,
    hasTravelFee,
    consultant?.teamType || "INTERNAL"
  )

  // Create booking in PENDING_PAYMENT state
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
      status: "PENDING_PAYMENT",
      services: {
        create: pricing.services.map((s) => ({
          serviceType: s.type,
          price: s.price,
        })),
      },
      payment: {
        create: {
          amount: pricing.total,
          currency: "eur",
          status: "pending",
        },
      },
    },
  })

  // Create Stripe checkout session
  const lineItems = [
    ...pricing.services.map((s) => ({
      price_data: {
        currency: "eur",
        product_data: { name: SERVICE_LABELS[s.type] },
        unit_amount: Math.round(s.price * 100),
      },
      quantity: 1,
    })),
  ]

  if (pricing.additionalIntros > 0) {
    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: { name: `Introduções Adicionais (${pricing.additionalIntros}×)` },
        unit_amount: Math.round(pricing.additionalIntrosTotal * 100),
      },
      quantity: 1,
    })
  }

  if (pricing.hasTravelFee) {
    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: { name: "Taxa de Deslocação" },
        unit_amount: Math.round(pricing.travelFeeAmount * 100),
      },
      quantity: 1,
    })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: lineItems,
    success_url: `${appUrl}/consultant/bookings/${booking.id}?payment=success`,
    cancel_url: `${appUrl}/consultant/bookings/${booking.id}?payment=cancelled`,
    metadata: { bookingId: booking.id },
    customer_email: consultant?.email || undefined,
    locale: "pt",
  })

  // Update payment with Stripe session ID
  await prisma.payment.update({
    where: { bookingId: booking.id },
    data: { stripeSessionId: checkoutSession.id },
  })

  return NextResponse.json({
    bookingId: booking.id,
    checkoutUrl: checkoutSession.url,
  })
}
