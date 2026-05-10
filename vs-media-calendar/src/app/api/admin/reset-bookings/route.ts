import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ONE-TIME reset route — delete after running once
export async function POST() {
  const session = await auth()
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [notifications, deliverables, payments, services, bookings, invoices] =
      await prisma.$transaction([
        prisma.notification.deleteMany({ where: { bookingId: { not: null } } }),
        prisma.deliverable.deleteMany({}),
        prisma.payment.deleteMany({}),
        prisma.bookingService.deleteMany({}),
        prisma.booking.deleteMany({}),
        prisma.monthlyInvoice.deleteMany({}),
      ])

    return NextResponse.json({
      ok: true,
      deleted: {
        notifications: notifications.count,
        deliverables: deliverables.count,
        payments: payments.count,
        bookingServices: services.count,
        bookings: bookings.count,
        invoices: invoices.count,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
