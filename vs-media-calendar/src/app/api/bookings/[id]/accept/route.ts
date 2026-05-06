import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendStatusUpdateEmail, generateICS } from "@/lib/email"
import { createCalendarEvent } from "@/lib/google-calendar"
import { SERVICE_LABELS } from "@/lib/pricing"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await auth()
  if (!session?.user || (session?.user as any)?.role !== "VIDEOGRAPHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const booking = await prisma.booking.findFirst({
    where: { id, videographerId: session.user.id, status: "PENDING_ACCEPTANCE" },
    include: {
      consultant: { select: { name: true, email: true } },
      videographer: { select: { name: true, email: true } },
      services: true,
    },
    // propertyType is a scalar field, included automatically
  })

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })

  await prisma.booking.update({
    where: { id },
    data: { status: "ACCEPTED" },
  })

  const serviceLabels = booking.services.map(
    (s) => SERVICE_LABELS[s.serviceType as keyof typeof SERVICE_LABELS]
  )

  // Create Google Calendar event — both consultant and videographer receive email invite (.ics)
  const calendarEventId = await createCalendarEvent({
    bookingId: booking.id,
    propertyAddress: booking.propertyAddress,
    scheduledAt: new Date(booking.scheduledAt),
    durationMinutes: booking.durationMinutes,
    consultantName: booking.consultant.name || "",
    consultantEmail: booking.consultant.email || "",
    videographerName: booking.videographer.name || "",
    videographerEmail: booking.videographer.email || "",
    services: serviceLabels,
    notes: booking.notes,
  })

  if (calendarEventId) {
    await prisma.booking.update({
      where: { id },
      data: { googleCalendarEventId: calendarEventId },
    })
  }

  const emailData = {
    bookingId: booking.id,
    consultantName: booking.consultant.name || "",
    consultantEmail: booking.consultant.email || "",
    videographerName: booking.videographer.name || "",
    videographerEmail: booking.videographer.email || "",
    propertyAddress: booking.propertyAddress,
    propertyType: booking.propertyType as string | null,
    scheduledAt: new Date(booking.scheduledAt),
    services: serviceLabels,
    status: "ACCEPTED" as const,
    durationMinutes: booking.durationMinutes,
  }
  const ics = generateICS(emailData)

  // Email both parties with .ics attachment
  await Promise.allSettled([
    sendStatusUpdateEmail(emailData, "consultant", undefined, ics),
    sendStatusUpdateEmail(emailData, "videographer", "A marcação foi confirmada. Encontra em anexo o ficheiro para adicionar ao teu calendário.", ics),
  ])

  return NextResponse.json({ success: true })
}
