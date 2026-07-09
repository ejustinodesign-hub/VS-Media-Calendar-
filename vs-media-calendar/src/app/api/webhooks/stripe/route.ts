import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { sendBookingConfirmationEmail, sendVideographerRequestEmail, sendInvoicePaidEmail, sendInvoicePaidConfirmationEmail } from "@/lib/email"
import { SERVICE_LABELS, ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"
import { createMoloniInvoice } from "@/lib/moloni"
import type { ServiceType } from "@prisma/client"

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
      const invoice = await prisma.monthlyInvoice.update({
        where: { id: invoiceId },
        data: { status: "PAID", paidAt: new Date() },
        include: {
          consultant: {
            select: {
              id: true, name: true, email: true,
              billingNif: true, billingName: true, billingAddress: true,
            },
          },
          bookings: {
            where: { paymentType: "FLAT_FEE" },
            include: { services: true },
          },
        },
      })

      // Notify admin and consultant by email
      try {
        await Promise.all([
          sendInvoicePaidEmail({
            consultantName: invoice.consultant.name || invoice.consultant.email || "—",
            consultantEmail: invoice.consultant.email || "",
            month: invoice.month,
            total: invoice.total,
            invoiceId: invoice.id,
          }),
          sendInvoicePaidConfirmationEmail({
            consultantName: invoice.consultant.name || "—",
            consultantEmail: invoice.consultant.email || "",
            month: invoice.month,
            total: invoice.total,
            invoiceId: invoice.id,
          }),
        ])
      } catch (e) {
        console.error("[webhook] Invoice paid email failed:", e)
      }

      // Create Moloni document now that payment is confirmed
      if (process.env.MOLONI_CLIENT_ID && !invoice.moloniDocumentId) {
        try {
          const [year, m] = invoice.month.split("-").map(Number)
          const monthStart = new Date(year, m - 1, 1)
          const monthEnd = new Date(year, m, 0, 23, 59, 59)

          const regularSharedIntros = await prisma.deliverable.findMany({
            where: {
              targetConsultantId: invoice.consultantId,
              createdAt: { gte: monthStart, lte: monthEnd },
              NOT: { fileUrl: { startsWith: "backfill:intro-junho-2026:" } },
            },
            include: { booking: { select: { propertyAddress: true } } },
          })
          const backfillSharedIntros = ["2026-06", "2026-07"].includes(invoice.month)
            ? await prisma.deliverable.findMany({
                where: {
                  fileUrl: { startsWith: "backfill:intro-junho-2026:" },
                  targetConsultantId: invoice.consultantId,
                  mimeType: `backfill-charged:${invoice.month}`,
                },
                include: { booking: { select: { propertyAddress: true } } },
              })
            : []
          const sharedIntros = [...regularSharedIntros, ...backfillSharedIntros]

          const bookingLines = invoice.bookings.flatMap((b) => {
            const items = b.services.map((svc) => ({
              description: `${SERVICE_LABELS[svc.serviceType as ServiceType]} — ${b.propertyAddress}`,
              qty: 1,
              unitPrice: svc.price,
            }))
            if (b.hasTravelFee && b.travelFeeAmount > 0) {
              items.push({
                description: `Taxa de deslocação — ${b.propertyAddress}`,
                qty: 1,
                unitPrice: b.travelFeeAmount,
              })
            }
            if (b.additionalIntros > 0) {
              items.push({
                description: `Intros adicionais (×${b.additionalIntros}) — ${b.propertyAddress}`,
                qty: b.additionalIntros,
                unitPrice: ADDITIONAL_INTRO_PRICE,
              })
            }
            return items
          })

          const sharedIntroLines = sharedIntros.map((d) => ({
            description: d.description ?? `Intro partilhada — ${d.booking?.propertyAddress ?? d.fileName}`,
            qty: 1,
            unitPrice: ADDITIONAL_INTRO_PRICE,
          }))

          const lines = [...bookingLines, ...sharedIntroLines]
          const dueDate = invoice.dueDate ?? new Date()

          if (lines.length > 0) {
            const moloniDocumentId = await createMoloniInvoice({
              consultant: invoice.consultant,
              month: invoice.month,
              dueDate,
              lines,
            })
            await prisma.monthlyInvoice.update({
              where: { id: invoiceId },
              data: { moloniDocumentId },
            })
          }
        } catch (e) {
          console.error("[webhook] Moloni invoice creation failed:", e)
        }
      }

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
