import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ONE-TIME setup route — delete after running once
export async function POST() {
  const session = await auth()
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const EMAIL_TO_DELETE = "techlib.instagram@gmail.com"
  const results: Record<string, unknown> = {}

  try {
    // ── 1. Add tpalmeida2004@gmail.com as VIDEOGRAPHER ──────────────────
    const videographer = await prisma.user.upsert({
      where: { email: "tpalmeida2004@gmail.com" },
      create: { email: "tpalmeida2004@gmail.com", role: "VIDEOGRAPHER", active: true },
      update: { role: "VIDEOGRAPHER", active: true },
      select: { id: true, email: true, role: true },
    })
    results.videographerAdded = videographer

    // ── 2. Set ejustino.design@gmail.com to ADMIN ───────────────────────
    const adminUpdate = await prisma.user.updateMany({
      where: { email: "ejustino.design@gmail.com" },
      data: { role: "ADMIN" },
    })
    results.ejustino_admin = adminUpdate.count

    // ── 3. Delete techlib.instagram@gmail.com with full cascade ─────────
    const target = await prisma.user.findUnique({
      where: { email: EMAIL_TO_DELETE },
      select: { id: true },
    })

    if (!target) {
      results.techlib_deleted = "user not found — already deleted"
    } else {
      const uid = target.id

      // Find all booking IDs for this user (as consultant OR videographer)
      const bookings = await prisma.booking.findMany({
        where: { OR: [{ consultantId: uid }, { videographerId: uid }] },
        select: { id: true },
      })
      const bookingIds = bookings.map((b) => b.id)

      await prisma.$transaction([
        // notifications on bookings + direct user notifications
        prisma.notification.deleteMany({
          where: { OR: [{ bookingId: { in: bookingIds } }, { userId: uid }] },
        }),
        // deliverables on bookings + deliverables targeting this user
        prisma.deliverable.deleteMany({
          where: { OR: [{ bookingId: { in: bookingIds } }, { targetConsultantId: uid }] },
        }),
        // payments cascade from booking, but delete explicitly
        prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }),
        // booking services
        prisma.bookingService.deleteMany({ where: { bookingId: { in: bookingIds } } }),
        // bookings
        prisma.booking.deleteMany({ where: { id: { in: bookingIds } } }),
        // invoices
        prisma.monthlyInvoice.deleteMany({ where: { consultantId: uid } }),
        // oauth accounts & sessions
        prisma.account.deleteMany({ where: { userId: uid } }),
        prisma.session.deleteMany({ where: { userId: uid } }),
        // finally the user (VideographerProfile cascades automatically)
        prisma.user.delete({ where: { id: uid } }),
      ])

      results.techlib_deleted = { bookingsRemoved: bookingIds.length, ok: true }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, results })
}
