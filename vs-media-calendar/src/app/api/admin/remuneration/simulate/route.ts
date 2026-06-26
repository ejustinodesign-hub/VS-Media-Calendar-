import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const NEW_STANDARD_RATE = 80
const NEW_DRONE_RATE = 90
const PHOTO_RATE = 10
const INTRO_RATE = 10

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

  const [allBookings, allIntros] = await Promise.all([
    prisma.booking.findMany({
      where: {
        videographerId: { in: videographers.map((v) => v.id) },
        scheduledAt: { gte: monthStart, lte: monthEnd },
        status: { in: [...COUNTED_STATUSES] },
      },
      select: {
        videographerId: true,
        services: { select: { serviceType: true } },
      },
    }),
    prisma.deliverable.findMany({
      where: {
        uploadedBy: { in: videographers.map((v) => v.id) },
        targetConsultantId: { not: null },
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      select: { uploadedBy: true },
    }),
  ])

  const results = videographers.map((v) => {
    const currentBaseSalary = salaryMap[v.id] ?? 1200
    const bookings = allBookings.filter((b) => b.videographerId === v.id)
    const intros = allIntros.filter((d) => d.uploadedBy === v.id)

    let standardCount = 0
    let droneCount = 0
    let photoCount = 0

    for (const b of bookings) {
      const hasDroneVideo = b.services.some((s) => s.serviceType === "VIDEO_DRONE")
      for (const s of b.services) {
        if (s.serviceType === "VIDEO_STANDARD") standardCount++
        else if (s.serviceType === "VIDEO_DRONE") droneCount++
        else if (s.serviceType.startsWith("PHOTO_")) {
          // PHOTO_DRONE is free when VIDEO_DRONE is in the same booking
          if (s.serviceType === "PHOTO_DRONE" && hasDroneVideo) continue
          photoCount++
        }
      }
    }

    const introCount = intros.length

    const videoTotal = standardCount * NEW_STANDARD_RATE + droneCount * NEW_DRONE_RATE
    const photoTotal = photoCount * PHOTO_RATE
    const introTotal = introCount * INTRO_RATE
    const newTotal = videoTotal + photoTotal + introTotal

    return {
      id: v.id,
      name: v.name,
      email: v.email,
      currentBaseSalary,
      standardCount,
      droneCount,
      photoCount,
      introCount,
      videoTotal,
      photoTotal,
      introTotal,
      newTotal,
    }
  })

  return NextResponse.json({
    month: now.toLocaleDateString("pt-PT", { month: "long", year: "numeric" }),
    rates: { standard: NEW_STANDARD_RATE, drone: NEW_DRONE_RATE, photo: PHOTO_RATE, intro: INTRO_RATE },
    results,
    grandNewTotal: results.reduce((sum, r) => sum + r.newTotal, 0),
  })
}
