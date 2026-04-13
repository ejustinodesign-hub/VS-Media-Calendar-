import type { ServiceType, TeamType } from "@prisma/client"

// Default pricing table (internal team)
export const DEFAULT_PRICES: Record<ServiceType, number> = {
  VIDEO_STANDARD: 50,
  VIDEO_DRONE: 60,
  PHOTO_DRONE: 35,
  PHOTO_T1_T2: 25,
  PHOTO_T3_T4: 35,
  PHOTO_T5_PLUS: 45,
}

export const ADDITIONAL_INTRO_PRICE = 25
export const TRAVEL_FEE_AMOUNT = 50
export const TRAVEL_FEE_THRESHOLD_HOURS = 1

export const SERVICE_LABELS: Record<ServiceType, string> = {
  VIDEO_STANDARD: "Vídeo Standard",
  VIDEO_DRONE: "Vídeo Standard + Drone",
  PHOTO_DRONE: "Fotografia Drone",
  PHOTO_T1_T2: "Fotografia T1/T2",
  PHOTO_T3_T4: "Fotografia T3/T4",
  PHOTO_T5_PLUS: "Fotografia T5+",
}

export const VIDEO_SERVICES: ServiceType[] = ["VIDEO_STANDARD", "VIDEO_DRONE"]
export const PHOTO_SERVICES: ServiceType[] = [
  "PHOTO_DRONE",
  "PHOTO_T1_T2",
  "PHOTO_T3_T4",
  "PHOTO_T5_PLUS",
]

export interface PriceCalculation {
  services: { type: ServiceType; label: string; price: number }[]
  additionalIntros: number
  additionalIntrosTotal: number
  hasTravelFee: boolean
  travelFeeAmount: number
  subtotal: number
  total: number
}

export function calculateTotal(
  selectedServices: ServiceType[],
  additionalIntros: number,
  hasTravelFee: boolean,
  teamType: TeamType = "INTERNAL",
  customPrices?: Partial<Record<ServiceType, number>>
): PriceCalculation {
  const prices = { ...DEFAULT_PRICES, ...customPrices }

  const services = selectedServices.map((type) => ({
    type,
    label: SERVICE_LABELS[type],
    price: prices[type],
  }))

  const servicesTotal = services.reduce((sum, s) => sum + s.price, 0)
  const additionalIntrosTotal = additionalIntros * ADDITIONAL_INTRO_PRICE
  const travelFeeAmount = hasTravelFee ? TRAVEL_FEE_AMOUNT : 0

  const subtotal = servicesTotal + additionalIntrosTotal
  const total = subtotal + travelFeeAmount

  return {
    services,
    additionalIntros,
    additionalIntrosTotal,
    hasTravelFee,
    travelFeeAmount,
    subtotal,
    total,
  }
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}
