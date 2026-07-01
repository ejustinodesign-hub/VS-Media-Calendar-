import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { IVA_RATE, ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"

// POST /api/admin/invoices/recalculate?month=2026-06
// Recomputes subtotal/total for all FLAT_FEE bookings in the given month,
// even those already linked to an invoice. Safe to run multiple times.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month")
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 })
  }

  const [year, m] = month.split("-").map(Number)
  const monthStart = new Date(year, m - 1, 1)
  const monthEnd = new Date(year, m, 0, 23, 59, 59)
  const dueDate = new Date(year, m, 0, 23, 59, 59) // last day of the month

  // All FLAT_FEE bookings for the month with a countable status
  const bookings = await prisma.booking.findMany({
    where: {
      paymentType: "FLAT_FEE",
      status: { in: ["ACCEPTED", "IN_PROGRESS", "FILE_DELIVERED", "COMPLETED"] },
      scheduledAt: { gte: monthStart, lte: monthEnd },
    },
    include: { services: true },
  })

  const byConsultant = new Map<string, typeof bookings>()
  for (const b of bookings) {
    const arr = byConsultant.get(b.consultantId) ?? []
    arr.push(b)
    byConsultant.set(b.consultantId, arr)
  }

  let updated = 0
  let created = 0

  for (const [consultantId, consultantBookings] of byConsultant) {
    if (consultantBookings.length === 0) continue

    // Recompute correct subtotal from scratch
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
      // Keep any real-time intro charges on the invoice (shared intros billed separately)
      // by preserving the delta that isn't accounted for by these bookings.
      // Strategy: set subtotal = bookingSubtotal + (existing.subtotal - previousBookingSubtotal)
      // Since we can't know the previous booking subtotal easily, we just set the
      // booking portion explicitly. The shared intro portion was added by chargeConsultantInvoice
      // and can be read from deliverables for this month.
      const sharedIntroDeliverables = await prisma.deliverable.findMany({
        where: {
          targetConsultantId: consultantId,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        select: { videographerFee: true },
      })
      // Each shared intro charged the ADDITIONAL_INTRO_PRICE to the consultant
      const sharedIntroSubtotal = sharedIntroDeliverables.length * ADDITIONAL_INTRO_PRICE
      const sharedIntroTotal = Math.round(sharedIntroSubtotal * (1 + IVA_RATE) * 100) / 100

      await prisma.monthlyInvoice.update({
        where: { id: existing.id },
        data: {
          subtotal: bookingSubtotal + sharedIntroSubtotal,
          total: bookingTotal + sharedIntroTotal,
          dueDate,
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

    // Re-link all bookings to this invoice
    await prisma.booking.updateMany({
      where: { id: { in: consultantBookings.map((b) => b.id) } },
      data: { invoiceId },
    })
  }

  return NextResponse.json({ month, updated, created, consultants: byConsultant.size })
}
