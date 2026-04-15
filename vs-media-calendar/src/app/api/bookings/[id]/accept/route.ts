import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendStatusUpdateEmail } from "@/lib/email"
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
  })

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })

  await prisma.booking.update({
    where: { id },
    data: { status: "ACCEPTED" },
  })

  // Create Google Calendar event
  const calendarEventId = await createCalendarEvent({
    bookingId: booking.id,
    propertyAddress: booking.propertyAddress,
    scheduledAt: new Date(booking.scheduledAt),
    durationMinutes: booking.durationMinutes,
    consultantName: booking.consultant.name || "",
    videographerName: booking.videographer.name || "",
    services: booking.services.map(
      (s) => SERVICE_LABELS[s.serviceType as keyof typeof SERVICE_LABELS]
    ),
    notes: booking.notes,
  })

  if (calendarEventId) {
    await prisma.booking.update({
      where: { id },
      data: { googleCalendarEventId: calendarEventId },
    })
  }

  try {
    const emailData = {
      bookingId: booking.id,
      consultantName: booking.consultant.name || "",
      consultantEmail: booking.consultant.email || "",
      videographerName: booking.videographer.name || "",
      videographerEmail: booking.videographer.email || "",
      propertyAddress: booking.propertyAddress,
      scheduledAt: new Date(booking.scheduledAt),
      services: booking.services.map(
        (s) => SERVICE_LABELS[s.serviceType as keyof typeof SERVICE_LABELS]
      ),
      status: "ACCEPTED" as const,
    }
    await sendStatusUpdateEmail(emailData, "consultant")
  } catch (e) {
    console.error("Email error:", e)
  }

  return NextResponse.json({ success: true })
}
