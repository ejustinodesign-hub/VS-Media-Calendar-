import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const NEW_STANDARD_RATE = 80
const NEW_DRONE_RATE = 90

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const COUNTED_STATUSES = ["ACCEPTED", "IN_PROGRESS", "FILE_DELIVERED", "COMPLETED"] as const

  const videographers = await prisma.user.findMany({
    where: { role: "VIDEOGRAPHER", active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  })

  let salaryMap: Record<string, number> = {}
  try {
    const profiles = await prisma.$queryRawUnsafe<{ userId: string; baseSalary: number }[]>(
      'SELECT "userId", "baseSalary" FROM "VideographerProfile"'
    )
    for (const p of profiles) salaryMap[p.userId] = p.baseSalary
  } catch {}

  const allBookings = await prisma.booking.findMany({
    where: {
      videographerId: { in: videographers.map((v) => v.id) },
      scheduledAt: { gte: monthStart, lte: monthEnd },
      status: { in: [...COUNTED_STATUSES] },
    },
    select: {
      videographerId: true,
      services: { select: { serviceType: true } },
    },
  })

  const results = videographers.map((v) => {
    const baseSalary = salaryMap[v.id] ?? 1200
    const bookings = allBookings.filter((b) => b.videographerId === v.id)

    let standardCount = 0
    let droneCount = 0
    for (const b of bookings) {
      for (const s of b.services) {
        if (s.serviceType === "VIDEO_STANDARD") standardCount++
        if (s.serviceType === "VIDEO_DRONE") droneCount++
      }
    }

    const simulatedVariable = standardCount * NEW_STANDARD_RATE + droneCount * NEW_DRONE_RATE
    const simulatedTotal = baseSalary + simulatedVariable

    return {
      id: v.id,
      name: v.name,
      email: v.email,
      baseSalary,
      standardCount,
      droneCount,
      simulatedVariable,
      simulatedTotal,
    }
  })

  return NextResponse.json({
    month: now.toLocaleDateString("pt-PT", { month: "long", year: "numeric" }),
    rates: { standard: NEW_STANDARD_RATE, drone: NEW_DRONE_RATE },
    results,
    grandTotal: results.reduce((sum, r) => sum + r.simulatedTotal, 0),
  })
}
