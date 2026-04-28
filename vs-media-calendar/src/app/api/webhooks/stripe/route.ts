import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { sendBookingConfirmationEmail, sendVideographerRequestEmail } from "@/lib/email"
import { SERVICE_LABELS } from "@/lib/pricing"

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-03-25.dahlia" })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")!

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error("Webhook signature error:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const stripeSession = event.data.object as Stripe.Checkout.Session

    const invoiceId = stripeSession.metadata?.invoiceId
    if (invoiceId) {
      await prisma.monthlyInvoice.update({
        where: { id: invoiceId },
        data: { status: "PAID", paidAt: new Date() },
      })
      return NextResponse.json({ ok: true })
    }

    const bookingId = stripeSession.metadata?.bookingId
    if (!bookingId) return NextResponse.json({ ok: true })

    // Update booking & payment
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "PENDING_ACCEPTANCE" },
      include: {
        consultant: { select: { name: true, email: true } },
        videographer: { select: { name: true, email: true } },
        services: true,
        payment: true,
      },
    })

    await prisma.payment.update({
      where: { bookingId },
      data: {
        stripeSessionId: stripeSession.id,
        stripePaymentIntentId: stripeSession.payment_intent as string,
        status: "paid",
        paidAt: new Date(),
      },
    })

    // Create notifications
    await prisma.notification.createMany({
      data: [
        {
          userId: booking.consultantId,
          bookingId: booking.id,
          type: "PAYMENT_COMPLETED",
          title: "Pagamento confirmado",
          message: `O pagamento para o serviço de ${booking.scheduledAt.toLocaleDateString("pt-PT")} foi confirmado.`,
          emailSent: false,
        },
        {
          userId: booking.videographerId,
          bookingId: booking.id,
          type: "BOOKING_PENDING",
          title: "Novo pedido de serviço",
          message: `Novo pedido de ${booking.consultant.name} para ${booking.scheduledAt.toLocaleDateString("pt-PT")}.`,
          emailSent: false,
        },
      ],
    })

    const serviceLabels = booking.services.map(
      (s) => SERVICE_LABELS[s.serviceType as keyof typeof SERVICE_LABELS]
    )

    const emailData = {
      bookingId: booking.id,
      consultantName: booking.consultant.name || "",
      consultantEmail: booking.consultant.email || "",
      videographerName: booking.videographer.name || "",
      videographerEmail: booking.videographer.email || "",
      propertyAddress: booking.propertyAddress,
      scheduledAt: new Date(booking.scheduledAt),
      services: serviceLabels,
      totalAmount: booking.payment?.amount,
      status: "PENDING_ACCEPTANCE" as const,
    }

    // Send emails
    try {
      await Promise.all([
        sendBookingConfirmationEmail(emailData),
        sendVideographerRequestEmail(emailData),
      ])
    } catch (e) {
      console.error("Email error:", e)
    }
  }

  return NextResponse.json({ ok: true })
}
