import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateTimeSlots } from "@/lib/utils"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const videographerId = searchParams.get("videographerId")
  const dateStr = searchParams.get("date")

  if (!videographerId || !dateStr) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 })
  }

  // Start and end of day
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  // Get existing bookings for this videographer on this day
  const existingBookings = await prisma.booking.findMany({
    where: {
      videographerId,
      scheduledAt: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["CANCELLED", "REJECTED", "PENDING_PAYMENT"] },
    },
    select: { scheduledAt: true, durationMinutes: true },
  })

  // Get availability blocks
  const blocks = await prisma.availabilityBlock.findMany({
    where: {
      videographerId,
      startAt: { lte: dayEnd },
      endAt: { gte: dayStart },
    },
  })

  const bookedSlots = [
    ...existingBookings.map((b) => ({
      start: new Date(b.scheduledAt),
      end: new Date(new Date(b.scheduledAt).getTime() + b.durationMinutes * 60 * 1000),
    })),
    ...blocks.map((b) => ({
      start: new Date(b.startAt),
      end: new Date(b.endAt),
    })),
  ]

  const slots = generateTimeSlots(date, bookedSlots).map((s) => ({
    time: s.time,
    available: s.available,
    datetime: s.datetime.toISOString(),
  }))

  return NextResponse.json({ slots })
}
