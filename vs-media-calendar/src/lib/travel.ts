const ORIGIN_ADDRESS = "Metropolitan Business Center, Odivelas, Portugal"
const ORIGIN_LAT = 38.7973
const ORIGIN_LNG = -9.1731

// ~80km radius → above this we charge travel fee
// (Albufeira ~280km, Porto ~310km, far Alentejo ~150km+)
const DISTANCE_THRESHOLD_KM = 80

// 45 min threshold when using Google Maps duration
const THRESHOLD_SECONDS = 2700

export interface TravelEstimate {
  durationSeconds: number
  durationText: string
  distanceMeters: number
  distanceText: string
  hasTravelFee: boolean
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Fallback: geocode with OpenStreetMap Nominatim (no API key required)
async function estimateWithNominatim(destination: string): Promise<TravelEstimate | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1&countrycodes=pt`
    const res = await fetch(url, {
      headers: { "User-Agent": "VSMediaCalendar/1.0" },
    })
    const data = await res.json()
    if (!data?.length) return null

    const { lat, lon } = data[0]
    const destLat = parseFloat(lat)
    const destLng = parseFloat(lon)
    const distKm = haversineKm(ORIGIN_LAT, ORIGIN_LNG, destLat, destLng)
    const distanceMeters = Math.round(distKm * 1000)
    const distanceText = distKm >= 1 ? `${distKm.toFixed(0)} km` : `${distanceMeters} m`

    // Rough driving time estimate: avg 80 km/h
    const durationSeconds = Math.round((distKm / 80) * 3600)
    const hours = Math.floor(durationSeconds / 3600)
    const minutes = Math.round((durationSeconds % 3600) / 60)
    const durationText =
      hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`

    return {
      durationSeconds,
      durationText,
      distanceMeters,
      distanceText,
      hasTravelFee: distKm > DISTANCE_THRESHOLD_KM,
    }
  } catch (err) {
    console.error("Nominatim geocoding error:", err)
    return null
  }
}

export async function estimateTravelTime(
  destination: string
): Promise<TravelEstimate | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  // Try Google Maps first if API key is available
  if (apiKey && apiKey !== "your-google-maps-api-key") {
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

      if (data.status === "OK") {
        const element = data.rows?.[0]?.elements?.[0]
        if (element?.status === "OK") {
          return {
            durationSeconds: element.duration.value,
            durationText: element.duration.text,
            distanceMeters: element.distance.value,
            distanceText: element.distance.text,
            hasTravelFee: element.duration.value > THRESHOLD_SECONDS,
          }
        }
      }
    } catch (err) {
      console.error("Google Maps travel estimation error:", err)
    }
  }

  // Fallback: OpenStreetMap Nominatim + Haversine (no API key needed)
  return estimateWithNominatim(destination)
}
