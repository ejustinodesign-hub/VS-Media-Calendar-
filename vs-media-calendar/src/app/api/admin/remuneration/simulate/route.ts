import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const NEW_STANDARD_RATE = 80
const NEW_DRONE_RATE    = 90
const PHOTO_RATE        = 10
const INTRO_RATE        = 10

// Current model rates (for profit comparison baseline)
const CUR_VIDEO_RATE = 10
const CUR_PHOTO_RATE = 10
const CUR_INTRO_RATE = 10

const INTRO_PRICE_NET = 25 // what the company charges per intro

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

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
        additionalIntros: true,
        hasTravelFee: true,
        travelFeeAmount: true,
        services: { select: { serviceType: true, price: true } },
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

  // ── Revenue (net, before IVA) ──────────────────────────────────────────────
  // Revenue is global — tied to bookings, not split by "who would have paid"
  let revenueServices  = 0
  let revenueTravel    = 0
  let revenueBookingIntros = 0
  for (const b of allBookings) {
    revenueServices      += b.services.reduce((s, sv) => s + sv.price, 0)
    revenueTravel        += b.hasTravelFee ? b.travelFeeAmount : 0
    revenueBookingIntros += b.additionalIntros * INTRO_PRICE_NET
  }
  const revenueSharedIntros = allIntros.length * INTRO_PRICE_NET
  const totalRevenue = revenueServices + revenueTravel + revenueBookingIntros + revenueSharedIntros

  // ── Per-videographer ───────────────────────────────────────────────────────
  const results = videographers.map((v) => {
    const currentBaseSalary = salaryMap[v.id] ?? 1200
    const bookings = allBookings.filter((b) => b.videographerId === v.id)
    const intros   = allIntros.filter((d) => d.uploadedBy === v.id)

    let standardCount = 0
    let droneCount    = 0
    let photoCount    = 0
    let bookingIntros = 0

    for (const b of bookings) {
      const hasDroneVideo = b.services.some((s) => s.serviceType === "VIDEO_DRONE")
      bookingIntros += b.additionalIntros
      for (const s of b.services) {
        if      (s.serviceType === "VIDEO_STANDARD") standardCount++
        else if (s.serviceType === "VIDEO_DRONE")    droneCount++
        else if (s.serviceType.startsWith("PHOTO_")) {
          if (s.serviceType === "PHOTO_DRONE" && hasDroneVideo) continue
          photoCount++
        }
      }
    }

    const introCount = intros.length

    // Current model variable pay (no base salary changes — we track it separately)
    const curVideoTotal  = (standardCount + droneCount) * CUR_VIDEO_RATE
    const curPhotoTotal  = photoCount  * CUR_PHOTO_RATE
    const curIntroTotal  = (bookingIntros + introCount) * CUR_INTRO_RATE
    const curTravel      = bookings.reduce((s, b) => s + (b.hasTravelFee ? b.travelFeeAmount : 0), 0)
    const currentTotal   = currentBaseSalary + curVideoTotal + curPhotoTotal + curIntroTotal + curTravel

    // Simulated model (no base salary)
    const simVideoTotal  = standardCount * NEW_STANDARD_RATE + droneCount * NEW_DRONE_RATE
    const simPhotoTotal  = photoCount  * PHOTO_RATE
    const simIntroTotal  = (bookingIntros + introCount) * INTRO_RATE
    const newTotal       = simVideoTotal + simPhotoTotal + simIntroTotal

    return {
      id: v.id,
      name: v.name,
      email: v.email,
      currentBaseSalary,
      standardCount,
      droneCount,
      photoCount,
      introCount: bookingIntros + introCount,
      currentTotal,
      newTotal,
    }
  })

  const grandCurrentTotal = results.reduce((s, r) => s + r.currentTotal, 0)
  const grandNewTotal     = results.reduce((s, r) => s + r.newTotal, 0)

  return NextResponse.json({
    month: now.toLocaleDateString("pt-PT", { month: "long", year: "numeric" }),
    rates: { standard: NEW_STANDARD_RATE, drone: NEW_DRONE_RATE, photo: PHOTO_RATE, intro: INTRO_RATE },
    revenue: {
      services:      revenueServices,
      travel:        revenueTravel,
      bookingIntros: revenueBookingIntros,
      sharedIntros:  revenueSharedIntros,
      total:         totalRevenue,
    },
    results,
    grandCurrentTotal,
    grandNewTotal,
    profitCurrent: totalRevenue - grandCurrentTotal,
    profitNew:     totalRevenue - grandNewTotal,
  })
}
