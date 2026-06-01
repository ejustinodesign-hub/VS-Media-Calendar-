import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { DEFAULT_PRICES } from "@/lib/pricing"
import type { ServiceType } from "@prisma/client"

// Statuses where the booking is still "active" and price hasn't been settled
const UPDATABLE_STATUSES = [
  "PENDING_PAYMENT",
  "PENDING_ACCEPTANCE",
  "ACCEPTED",
  "IN_PROGRESS",
] as const

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get current active pricing rules
  const dbRules = await prisma.pricingRule.findMany({
    where: { active: true, teamId: null },
    select: { serviceType: true, basePrice: true },
  })
  const prices = { ...DEFAULT_PRICES } as Record<ServiceType, number>
  for (const rule of dbRules) prices[rule.serviceType as ServiceType] = rule.basePrice

  // Find all BookingService rows for active bookings (non-commission only)
  const services = await prisma.bookingService.findMany({
    where: {
      booking: {
        status: { in: UPDATABLE_STATUSES as unknown as any },
        paymentType: "FLAT_FEE",
      },
    },
    select: { id: true, serviceType: true },
  })

  if (services.length === 0) {
    return NextResponse.json({ updated: 0 })
  }

  // Update each service to the current price
  await Promise.all(
    services.map((s) =>
      prisma.bookingService.update({
        where: { id: s.id },
        data: { price: prices[s.serviceType as ServiceType] ?? 0 },
      })
    )
  )

  return NextResponse.json({ updated: services.length })
}

// GET — returns count of updatable booking services
export async function GET() {
  const session = await auth()
  if (!session?.user || (session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const count = await prisma.bookingService.count({
    where: {
      booking: {
        status: { in: UPDATABLE_STATUSES as unknown as any },
        paymentType: "FLAT_FEE",
      },
    },
  })

  return NextResponse.json({ count })
}
