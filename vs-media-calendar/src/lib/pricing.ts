import type { ServiceType, TeamType } from "@prisma/client"

// Default pricing table (internal team) — net prices, IVA applied separately
export const DEFAULT_PRICES: Record<ServiceType, number> = {
  VIDEO_STANDARD: 100,
  VIDEO_DRONE: 120,
  PHOTO_DRONE: 35,
  PHOTO_T1_T2: 25,
  PHOTO_T3_T4: 35,
  PHOTO_T5_PLUS: 45,
}

export const ADDITIONAL_INTRO_PRICE = 25
export const TRAVEL_FEE_AMOUNT = 50
export const TRAVEL_FEE_THRESHOLD_HOURS = 1
export const IVA_RATE = 0.23

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
  ivaAmount: number
  totalWithIva: number
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
  const ivaAmount = Math.round(total * IVA_RATE * 100) / 100
  const totalWithIva = Math.round(total * (1 + IVA_RATE) * 100) / 100

  return {
    services,
    additionalIntros,
    additionalIntrosTotal,
    hasTravelFee,
    travelFeeAmount,
    subtotal,
    total,
    ivaAmount,
    totalWithIva,
  }
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

export function applyIva(netAmount: number): number {
  return Math.round(netAmount * (1 + IVA_RATE) * 100) / 100
}
