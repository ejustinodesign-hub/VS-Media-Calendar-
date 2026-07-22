import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { IVA_RATE, ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"

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

  // Só marcações com vídeo já entregue são faturadas
  const bookings = await prisma.booking.findMany({
    where: {
      paymentType: "FLAT_FEE",
      status: { in: ["FILE_DELIVERED", "COMPLETED"] },
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
      created++
    }

    await prisma.booking.updateMany({
      where: { id: { in: consultantBookings.map((b) => b.id) } },
      data: { invoiceId },
    })
  }

  return NextResponse.json({ created, updated })
}
