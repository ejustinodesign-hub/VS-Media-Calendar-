import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { DEFAULT_PRICES } from "@/lib/pricing"
import type { ServiceType } from "@prisma/client"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { serviceType } = await req.json() as { serviceType: ServiceType }

  if (!serviceType) return NextResponse.json({ error: "Campos em falta" }, { status: 400 })

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { services: { select: { serviceType: true } } },
  })
  if (!booking) return NextResponse.json({ error: "Marcação não encontrada" }, { status: 404 })

  if (booking.services.some((s) => s.serviceType === serviceType)) {
    return NextResponse.json({ error: "Serviço já adicionado" }, { status: 409 })
  }

  // Fetch active pricing rules from DB
  const rules = await prisma.pricingRule.findMany({ where: { active: true, teamId: null }, select: { serviceType: true, basePrice: true } })
  const activePrices: Record<string, number> = { ...DEFAULT_PRICES }
  for (const r of rules) activePrices[r.serviceType] = r.basePrice

  // Drone photo is free when VIDEO_DRONE is already in the booking
  const hasDroneVideo = booking.services.some((s) => s.serviceType === "VIDEO_DRONE") || serviceType === "VIDEO_DRONE"
  let price = activePrices[serviceType] ?? DEFAULT_PRICES[serviceType as ServiceType] ?? 0
  if (serviceType === "PHOTO_DRONE" && hasDroneVideo) price = 0

  // If adding VIDEO_DRONE and PHOTO_DRONE already exists, update its price to 0
  if (serviceType === "VIDEO_DRONE") {
    const photoDrone = await prisma.bookingService.findFirst({ where: { bookingId: id, serviceType: "PHOTO_DRONE" } })
    if (photoDrone) {
      await prisma.bookingService.update({ where: { id: photoDrone.id }, data: { price: 0 } })
    }
  }

  await prisma.bookingService.create({ data: { bookingId: id, serviceType, price } })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { serviceId } = await req.json() as { serviceId: string }

  if (!serviceId) return NextResponse.json({ error: "Campos em falta" }, { status: 400 })

  const svc = await prisma.bookingService.findFirst({ where: { id: serviceId, bookingId: id } })
  if (!svc) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 })

  await prisma.bookingService.delete({ where: { id: serviceId } })

  // If removing VIDEO_DRONE, restore PHOTO_DRONE to its normal price if present
  if (svc.serviceType === "VIDEO_DRONE") {
    const rules = await prisma.pricingRule.findMany({ where: { active: true, teamId: null }, select: { serviceType: true, basePrice: true } })
    const activePrices: Record<string, number> = { ...DEFAULT_PRICES }
    for (const r of rules) activePrices[r.serviceType] = r.basePrice

    const photoDrone = await prisma.bookingService.findFirst({ where: { bookingId: id, serviceType: "PHOTO_DRONE" } })
    if (photoDrone) {
      await prisma.bookingService.update({ where: { id: photoDrone.id }, data: { price: activePrices["PHOTO_DRONE"] ?? DEFAULT_PRICES["PHOTO_DRONE"] } })
    }
  }

  return NextResponse.json({ success: true })
}
