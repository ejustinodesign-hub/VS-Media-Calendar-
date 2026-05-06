import { google } from "googleapis"

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

export interface BookingEventData {
  bookingId: string
  propertyAddress: string
  scheduledAt: Date
  durationMinutes: number
  consultantName: string
  consultantEmail: string
  videographerName: string
  videographerEmail: string
  services: string[]
  notes?: string | null
}

function buildDescription(data: BookingEventData): string {
  return [
    `📍 Imóvel: ${data.propertyAddress}`,
    `👤 Consultor: ${data.consultantName}`,
    `🎥 Videógrafo: ${data.videographerName}`,
    `🎬 Serviços: ${data.services.join(", ")}`,
    data.notes ? `📝 Notas: ${data.notes}` : null,
    ``,
    `🔗 Ver marcação: ${process.env.NEXT_PUBLIC_APP_URL}/consultant/bookings/${data.bookingId}`,
  ]
    .filter(Boolean)
    .join("\n")
}

export async function createCalendarEvent(data: BookingEventData): Promise<string | null> {
  try {
    const calendar = getCalendar()

    const endTime = new Date(data.scheduledAt)
    endTime.setMinutes(endTime.getMinutes() + data.durationMinutes)

    const event = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      sendUpdates: "all", // sends email invites to all attendees
      requestBody: {
        summary: `📸 ${data.propertyAddress}`,
        description: buildDescription(data),
        location: data.propertyAddress,
        start: {
          dateTime: data.scheduledAt.toISOString(),
          timeZone: "Europe/Lisbon",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "Europe/Lisbon",
        },
        colorId: "7",
        attendees: [
          { email: data.consultantEmail, displayName: data.consultantName },
          { email: data.videographerEmail, displayName: data.videographerName },
        ],
        // Allow attendees to see each other
        guestsCanSeeOtherGuests: true,
      },
    })

    return event.data.id ?? null
  } catch (err) {
    console.error("Google Calendar createEvent error:", err)
    return null
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

    // Rebuild description if any content field changed
    if (data.propertyAddress || data.notes !== undefined || data.services) {
      patch.description = data as any // will be rebuilt by the caller passing full data
    }

    await calendar.events.patch({
      calendarId: CALENDAR_ID,
      eventId,
      sendUpdates: "all",
      requestBody: patch,
    })
  } catch (err) {
    console.error("Google Calendar updateEvent error:", err)
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  try {
    const calendar = getCalendar()
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId,
      sendUpdates: "all", // notifies attendees of cancellation
    })
  } catch (err) {
    console.error("Google Calendar deleteEvent error:", err)
  }
}
