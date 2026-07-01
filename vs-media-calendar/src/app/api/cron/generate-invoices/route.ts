import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { IVA_RATE, SERVICE_LABELS, ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"
import { createMoloniInvoice } from "@/lib/moloni"
import type { ServiceType } from "@prisma/client"

export async function GET(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development"
  if (!isDev) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const now = new Date()
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const month = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`
  const monthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1)
  const monthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59)
  const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const bookings = await prisma.booking.findMany({
    where: {
      paymentType: "FLAT_FEE",
      status: { in: ["ACCEPTED", "IN_PROGRESS", "FILE_DELIVERED", "COMPLETED"] },
      scheduledAt: { gte: monthStart, lte: monthEnd },
      invoiceId: null,
    },
    include: { services: true },
  })

  const byConsultant = new Map<string, typeof bookings>()
  for (const booking of bookings) {
    const existing = byConsultant.get(booking.consultantId) ?? []
    existing.push(booking)
    byConsultant.set(booking.consultantId, existing)
  }

  let created = 0
  let updated = 0
  const moloniErrors: string[] = []

  for (const [consultantId, consultantBookings] of byConsultant) {
    // Skip if no unlinked bookings to charge
    if (consultantBookings.length === 0) continue

    const consultant = await prisma.user.findUnique({
      where: { id: consultantId },
      select: {
        name: true,
        email: true,
        billingNif: true,
        billingName: true,
        billingAddress: true,
      },
    })

    // Bookings subtotal: services + travel + additionalIntros
    // Note: shared intro deliverables are charged in real-time by chargeConsultantInvoice
    const bookingSubtotal = consultantBookings.reduce((sum, b) => {
      const servicesTotal = b.services.reduce((s, svc) => s + svc.price, 0)
      const travelTotal = b.hasTravelFee ? b.travelFeeAmount : 0
      const introsTotal = b.additionalIntros * ADDITIONAL_INTRO_PRICE
      return sum + servicesTotal + travelTotal + introsTotal
    }, 0)

    const bookingTotal = Math.round(bookingSubtotal * (1 + IVA_RATE) * 100) / 100

    const existing = await prisma.monthlyInvoice.findFirst({
      where: { consultantId, month },
    })

    let invoiceId: string

    if (existing) {
      // Invoice already exists (created by a real-time intro charge) — add booking charges
      await prisma.monthlyInvoice.update({
        where: { id: existing.id },
        data: {
          subtotal: existing.subtotal + bookingSubtotal,
          total: existing.total + bookingTotal,
        },
      })
      invoiceId = existing.id
      updated++
    } else {
      const invoice = await prisma.monthlyInvoice.create({
        data: {
          consultantId,
          month,
          subtotal: bookingSubtotal,
          total: bookingTotal,
          dueDate,
          status: "PENDING",
        },
      })
      invoiceId = invoice.id

      // Create invoice in Moloni — non-blocking, failure doesn't abort the cron
      if (process.env.MOLONI_CLIENT_ID && consultant) {
        try {
          const lines = consultantBookings.flatMap((b) => {
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

          const moloniDocumentId = await createMoloniInvoice({
            consultant,
            month,
            dueDate,
            lines,
          })

          await prisma.monthlyInvoice.update({
            where: { id: invoiceId },
            data: { moloniDocumentId },
          })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.error(`[Moloni] Failed for consultant ${consultantId}:`, msg)
          moloniErrors.push(`${consultantId}: ${msg}`)
        }
      }

      created++
    }

    await prisma.booking.updateMany({
      where: { id: { in: consultantBookings.map((b) => b.id) } },
      data: { invoiceId },
    })
  }

  return NextResponse.json({ created, moloniErrors })
}
