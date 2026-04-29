import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { IVA_RATE } from "@/lib/pricing"

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

  for (const [consultantId, consultantBookings] of byConsultant) {
    const existing = await prisma.monthlyInvoice.findFirst({
      where: { consultantId, month },
    })
    if (existing) continue

    const subtotal = consultantBookings.reduce((sum, b) => {
      const servicesTotal = b.services.reduce((s, svc) => s + svc.price, 0)
      const introsTotal = b.additionalIntros * 25
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

    created++
  }

  return NextResponse.json({ created })
}
