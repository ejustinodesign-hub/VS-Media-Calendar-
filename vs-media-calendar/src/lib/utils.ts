import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { BookingStatus } from "@prisma/client"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "Aguarda Pagamento",
  PAID: "Paga",
  PENDING_ACCEPTANCE: "Aguarda Aceitação",
  ACCEPTED: "Aceite",
  REJECTED: "Recusada",
  CANCELLED: "Cancelada",
  IN_PROGRESS: "Em Execução",
  FILE_DELIVERED: "Ficheiro Final Disponível",
  COMPLETED: "Concluída",
}

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  PAID: "bg-blue-100 text-blue-800",
  PENDING_ACCEPTANCE: "bg-purple-100 text-purple-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-cyan-100 text-cyan-800",
  FILE_DELIVERED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function generateTimeSlots(
  date: Date,
  bookedSlots: { start: Date; end: Date }[]
): { time: string; available: boolean; datetime: Date }[] {
  const slots: { time: string; available: boolean; datetime: Date }[] = []
  const start = 8 // 08:00
  const end = 19 // last slot starts at 17:30, ends 19:00
  const duration = 90 // minutes

  for (let hour = start; hour * 60 + 0 + duration <= end * 60; ) {
    const datetime = new Date(date)
    datetime.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0)

    const slotEnd = new Date(datetime)
    slotEnd.setMinutes(slotEnd.getMinutes() + duration)

    const isBooked = bookedSlots.some((b) => {
      return datetime < b.end && slotEnd > b.start
    })

    const timeStr = `${String(datetime.getHours()).padStart(2, "0")}:${String(
      datetime.getMinutes()
    ).padStart(2, "0")}`

    slots.push({ time: timeStr, available: !isBooked, datetime })

    // Advance by 30 min steps
    hour += 0.5
  }

  return slots
}
