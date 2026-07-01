import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"
import { SERVICE_LABELS } from "@/lib/pricing"

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-03-25.dahlia" })
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const booking = await prisma.booking.findFirst({
    where: {
      id,
      consultantId: session.user.id,
      status: "PENDING_PAYMENT",
    },
    include: {
      services: true,
      payment: true,
      consultant: { select: { email: true } },
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Marcação não encontrada ou já paga" }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const lineItems = [
    ...booking.services.map((s) => ({
      price_data: {
        currency: "eur" as const,
        product_data: {
          name: SERVICE_LABELS[s.serviceType as keyof typeof SERVICE_LABELS],
        },
        unit_amount: Math.round(s.price * 100),
      },
      quantity: 1,
    })),
  ]

  if (booking.additionalIntros > 0) {
    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: { name: `Introduções Adicionais (${booking.additionalIntros}×)` },
        unit_amount: Math.round(booking.additionalIntros * 25 * 100),
      },
      quantity: 1,
    })
  }

  if (booking.hasTravelFee && booking.travelFeeAmount > 0) {
    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: { name: "Taxa de Deslocação" },
        unit_amount: Math.round(booking.travelFeeAmount * 100),
      },
      quantity: 1,
    })
  }

  const checkoutSession = await getStripe().checkout.sessions.create({
    payment_method_types: ["card", "mb_way"],
    mode: "payment",
    line_items: lineItems,
    success_url: `${appUrl}/consultant/bookings/${booking.id}?payment=success`,
    cancel_url: `${appUrl}/consultant/bookings/${booking.id}?payment=cancelled`,
    metadata: { bookingId: booking.id },
    customer_email: booking.consultant.email || undefined,
    locale: "pt",
  })

  // Update payment record with new session ID
  await prisma.payment.update({
    where: { bookingId: booking.id },
    data: { stripeSessionId: checkoutSession.id },
  })

  return NextResponse.json({ checkoutUrl: checkoutSession.url })
}
