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
  const moloniErrors: string[] = []

  for (const [consultantId, consultantBookings] of byConsultant) {
    const existing = await prisma.monthlyInvoice.findFirst({
      where: { consultantId, month },
    })
    if (existing) continue

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

    const subtotal = consultantBookings.reduce((sum, b) => {
      const servicesTotal = b.services.reduce((s, svc) => s + svc.price, 0)
      const introsTotal = b.additionalIntros * ADDITIONAL_INTRO_PRICE
      const travelTotal = b.hasTravelFee ? b.travelFeeAmount : 0
      return sum + servicesTotal + introsTotal + travelTotal
    }, 0)

    const total = Math.round(subtotal * (1 + IVA_RATE) * 100) / 100

    const invoice = await prisma.monthlyInvoice.create({
      data: {
        consultantId,
        month,
        subtotal,
        total,
        dueDate,
        status: "PENDING",
      },
    })

    await prisma.booking.updateMany({
      where: { id: { in: consultantBookings.map((b) => b.id) } },
      data: { invoiceId: invoice.id },
    })

    // Create invoice in Moloni — non-blocking, failure doesn't abort the cron
    if (process.env.MOLONI_CLIENT_ID && consultant) {
      try {
        const lines = consultantBookings.flatMap((b) => {
          const items = b.services.map((svc) => ({
            description: `${SERVICE_LABELS[svc.serviceType as ServiceType]} — ${b.propertyAddress}`,
            qty: 1,
            unitPrice: svc.price,
          }))
          if (b.additionalIntros > 0) {
            items.push({
              description: `Introduções adicionais (${b.additionalIntros}×) — ${b.propertyAddress}`,
              qty: b.additionalIntros,
              unitPrice: ADDITIONAL_INTRO_PRICE,
            })
          }
          if (b.hasTravelFee && b.travelFeeAmount > 0) {
            items.push({
              description: `Taxa de deslocação — ${b.propertyAddress}`,
              qty: 1,
              unitPrice: b.travelFeeAmount,
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
          where: { id: invoice.id },
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

  return NextResponse.json({ created, moloniErrors })
}
