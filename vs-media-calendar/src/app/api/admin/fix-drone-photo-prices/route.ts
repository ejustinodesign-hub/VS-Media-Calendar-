import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const bookings = await prisma.booking.findMany({
    where: {
      scheduledAt: { gte: monthStart, lte: monthEnd },
      services: { some: { serviceType: "VIDEO_DRONE" } },
    },
    include: { services: true },
  })

  const fixed: { bookingId: string; oldPrice: number }[] = []

  for (const booking of bookings) {
    const hasVideoDrone = booking.services.some((s) => s.serviceType === "VIDEO_DRONE")
    const photoDrone = booking.services.find((s) => s.serviceType === "PHOTO_DRONE" && s.price > 0)

    if (hasVideoDrone && photoDrone) {
      await prisma.bookingService.update({
        where: { id: photoDrone.id },
        data: { price: 0 },
      })
      fixed.push({ bookingId: booking.id, oldPrice: photoDrone.price })
    }
  }

  return NextResponse.json({ fixed, count: fixed.length })
}
