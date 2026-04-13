const ORIGIN_ADDRESS = "Metropolitan Business Center, Odivelas, Portugal"
const THRESHOLD_SECONDS = 3600 // 1 hour

export interface TravelEstimate {
  durationSeconds: number
  durationText: string
  distanceMeters: number
  distanceText: string
  hasTravelFee: boolean
}

export async function estimateTravelTime(
  destination: string
): Promise<TravelEstimate | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.warn("GOOGLE_MAPS_API_KEY not set, skipping travel calculation")
    return null
  }

  try {
    const params = new URLSearchParams({
      origins: ORIGIN_ADDRESS,
      destinations: destination,
      key: apiKey,
      language: "pt",
      units: "metric",
    })

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`
    )
    const data = await res.json()

    if (data.status !== "OK") return null

    const element = data.rows?.[0]?.elements?.[0]
    if (!element || element.status !== "OK") return null

    const durationSeconds = element.duration.value
    const durationText = element.duration.text
    const distanceMeters = element.distance.value
    const distanceText = element.distance.text

    return {
      durationSeconds,
      durationText,
      distanceMeters,
      distanceText,
      hasTravelFee: durationSeconds > THRESHOLD_SECONDS,
    }
  } catch (err) {
    console.error("Travel estimation error:", err)
    return null
  }
}
