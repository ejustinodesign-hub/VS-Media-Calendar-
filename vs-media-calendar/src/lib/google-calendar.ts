import { google } from "googleapis"

// Lazy-initialize to avoid build-time errors if env vars aren't set
function getCalendar() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!email || !key) {
    throw new Error("Google Calendar service account credentials not configured")
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  })

  return google.calendar({ version: "v3", auth })
}

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary"

interface BookingEventData {
  bookingId: string
  propertyAddress: string
  scheduledAt: Date
  durationMinutes: number
  consultantName: string
  videographerName: string
  services: string[]
  notes?: string | null
}

export async function createCalendarEvent(data: BookingEventData): Promise<string | null> {
  try {
    const calendar = getCalendar()

    const endTime = new Date(data.scheduledAt)
    endTime.setMinutes(endTime.getMinutes() + data.durationMinutes)

    const description = [
      `📍 Imóvel: ${data.propertyAddress}`,
      `👤 Consultor: ${data.consultantName}`,
      `🎥 Videógrafo: ${data.videographerName}`,
      `🎬 Serviços: ${data.services.join(", ")}`,
      data.notes ? `📝 Notas: ${data.notes}` : null,
      ``,
      `🔗 Ver marcação: ${process.env.NEXT_PUBLIC_APP_URL}/admin/bookings`,
    ]
      .filter(Boolean)
      .join("\n")

    const event = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: `📸 ${data.propertyAddress}`,
        description,
        location: data.propertyAddress,
        start: {
          dateTime: data.scheduledAt.toISOString(),
          timeZone: "Europe/Lisbon",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "Europe/Lisbon",
        },
        colorId: "7", // Peacock blue
      },
    })

    return event.data.id ?? null
  } catch (err) {
    console.error("Google Calendar createEvent error:", err)
    return null
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  try {
    const calendar = getCalendar()
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId,
    })
  } catch (err) {
    console.error("Google Calendar deleteEvent error:", err)
  }
}

export async function updateCalendarEvent(
  eventId: string,
  data: Partial<BookingEventData>
): Promise<void> {
  try {
    const calendar = getCalendar()

    const patch: Record<string, any> = {}

    if (data.propertyAddress) {
      patch.summary = `📸 ${data.propertyAddress}`
      patch.location = data.propertyAddress
    }

    if (data.scheduledAt) {
      const endTime = new Date(data.scheduledAt)
      endTime.setMinutes(endTime.getMinutes() + (data.durationMinutes ?? 90))
      patch.start = { dateTime: data.scheduledAt.toISOString(), timeZone: "Europe/Lisbon" }
      patch.end = { dateTime: endTime.toISOString(), timeZone: "Europe/Lisbon" }
    }

    await calendar.events.patch({
      calendarId: CALENDAR_ID,
      eventId,
      requestBody: patch,
    })
  } catch (err) {
    console.error("Google Calendar updateEvent error:", err)
  }
}
