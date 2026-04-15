import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendStatusUpdateEmail } from "@/lib/email"
import { deleteCalendarEvent } from "@/lib/google-calendar"
import { SERVICE_LABELS } from "@/lib/pricing"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const booking = await prisma.booking.findFirst({
    where: {
      id,
      consultantId: session.user.id,
      status: { notIn: ["CANCELLED", "REJECTED", "COMPLETED"] },
    },
    include: {
      consultant: { select: { name: true, email: true } },
      videographer: { select: { name: true, email: true } },
      services: true,
    },
  })

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  })

  // Delete Google Calendar event if it exists
  if (updated.googleCalendarEventId) {
    await deleteCalendarEvent(updated.googleCalendarEventId)
  }

  // Notify both parties
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
      status: "CANCELLED" as const,
    }
    await sendStatusUpdateEmail(emailData, "videographer")
  } catch (e) {
    console.error("Email error:", e)
  }

  return NextResponse.json({ success: true })
}
