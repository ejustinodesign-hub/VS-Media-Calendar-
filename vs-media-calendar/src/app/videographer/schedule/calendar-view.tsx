"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Clock, MapPin, BanIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from "@/lib/utils"
import type { BookingStatus } from "@prisma/client"

export interface CalendarBooking {
  id: string
  scheduledAt: string
  status: BookingStatus
  consultantName: string
  propertyAddress: string
  services: string[]
  propertyType: string | null
}

export interface CalendarBlock {
  id: string
  startAt: string
  endAt: string
  reason?: string | null
}

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

const STATUS_DOT: Partial<Record<BookingStatus, string>> = {
  PENDING_ACCEPTANCE: "bg-amber-400",
  ACCEPTED: "bg-emerald-500",
  IN_PROGRESS: "bg-cyan-500",
  FILE_DELIVERED: "bg-indigo-500",
  COMPLETED: "bg-slate-400",
}

interface Props {
  bookings: CalendarBooking[]
  blocks: CalendarBlock[]
  month: number  // 0-indexed
  year: number
}

export function CalendarView({ bookings, blocks: initialBlocks, month, year }: Props) {
  const router = useRouter()
  const today = new Date()
  const [selectedDay, setSelectedDay] = useState<number | null>(
    today.getMonth() === month && today.getFullYear() === year ? today.getDate() : null
  )
  const [blocks, setBlocks] = useState<CalendarBlock[]>(initialBlocks)
  const [blockLoading, setBlockLoading] = useState(false)

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7

  const monthName = new Date(year, month, 1).toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
  })

  const getBookingsForDay = (day: number) =>
    bookings.filter((b) => {
      const d = new Date(b.scheduledAt)
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year
    })

  function getBlockForDay(day: number): CalendarBlock | undefined {
    const dayStart = new Date(year, month, day, 0, 0, 0)
    const dayEnd   = new Date(year, month, day, 23, 59, 59)
    return blocks.find((b) => {
      const bStart = new Date(b.startAt)
      const bEnd   = new Date(b.endAt)
      return bStart <= dayEnd && bEnd >= dayStart
    })
  }

  const dateStr = (day: number) => {
    const mm = String(month + 1).padStart(2, "0")
    const dd = String(day).padStart(2, "0")
    return `${year}-${mm}-${dd}`
  }

  async function toggleBlock(day: number) {
    setBlockLoading(true)
    const existing = getBlockForDay(day)
    try {
      if (existing) {
        await fetch(`/api/videographer/availability-blocks/${existing.id}`, { method: "DELETE" })
        setBlocks((prev) => prev.filter((b) => b.id !== existing.id))
      } else {
        const res = await fetch("/api/videographer/availability-blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateStr(day) }),
        })
        const data = await res.json()
        if (res.ok) setBlocks((prev) => [...prev, data])
      }
    } finally {
      setBlockLoading(false)
    }
  }

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1)
    router.push(`/videographer/schedule?month=${d.getMonth()}&year=${d.getFullYear()}`)
  }
  const nextMonth = () => {
    const d = new Date(year, month + 1, 1)
    router.push(`/videographer/schedule?month=${d.getMonth()}&year=${d.getFullYear()}`)
  }

  const selectedBookings = selectedDay ? getBookingsForDay(selectedDay) : []
  const selectedBlock = selectedDay ? getBlockForDay(selectedDay) : undefined

  return (
    <div className="space-y-4">
      {/* Month header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-3">
        <button
          onClick={prevMonth}
          className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
        <h3 className="font-bold text-slate-900 capitalize text-lg">{monthName}</h3>
        <button
          onClick={nextMonth}
          className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {WEEK_DAYS.map((d) => (
            <div key={d} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`e${i}`} className="h-16 border-b border-r border-slate-50" />
          ))}

          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dayBookings = getBookingsForDay(day)
            const block = getBlockForDay(day)
            const isToday =
              day === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear()
            const isSelected = day === selectedDay
            const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())
            const col = (firstDayOffset + day - 1) % 7
            const isLastCol = col === 6

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                className={cn(
                  "h-16 p-1.5 border-b border-r border-slate-100 flex flex-col items-start transition-colors relative",
                  isLastCol && "border-r-0",
                  block && "bg-red-50",
                  isSelected && !block && "bg-[#0f3460]/5",
                  isSelected && block && "bg-red-100",
                  !isSelected && !isToday && !block && "hover:bg-slate-50",
                  !isSelected && !isToday && block && "hover:bg-red-100",
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold leading-none",
                      isToday
                        ? "bg-[#e94560] text-white"
                        : isSelected
                        ? block ? "bg-red-600 text-white" : "bg-[#0f3460] text-white"
                        : isPast
                        ? "text-slate-300"
                        : block
                        ? "text-red-600"
                        : "text-slate-700"
                    )}
                  >
                    {day}
                  </span>
                  {block && (
                    <BanIcon className="w-3 h-3 text-red-400 flex-shrink-0" />
                  )}
                </div>
                {/* Booking dots */}
                <div className="flex gap-0.5 mt-auto flex-wrap">
                  {dayBookings.slice(0, 3).map((b) => (
                    <span
                      key={b.id}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        STATUS_DOT[b.status] || "bg-slate-300"
                      )}
                    />
                  ))}
                  {dayBookings.length > 3 && (
                    <span className="text-[9px] text-slate-400 font-bold">+{dayBookings.length - 3}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day panel */}
      {selectedDay !== null && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-slate-900">
                {new Date(year, month, selectedDay).toLocaleDateString("pt-PT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedBlock
                  ? "Dia bloqueado — não aceita novas marcações"
                  : selectedBookings.length === 0
                  ? "Sem serviços"
                  : `${selectedBookings.length} serviço(s)`}
              </p>
            </div>
            <button
              onClick={() => toggleBlock(selectedDay)}
              disabled={blockLoading}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex-shrink-0",
                selectedBlock
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
              )}
            >
              {blockLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <BanIcon className="w-3.5 h-3.5" />}
              {selectedBlock ? "Desbloquear" : "Bloquear dia"}
            </button>
          </div>

          {selectedBlock && (
            <div className="px-5 py-3 bg-red-50 border-b border-red-100 text-xs text-red-700 font-medium">
              Este dia está bloqueado. Os consultores não conseguem marcar neste dia.
              {selectedBookings.length > 0 && (
                <span className="ml-1 text-amber-700">
                  Atenção: há {selectedBookings.length} marcação(ões) existente(s) — o bloqueio não as cancela.
                </span>
              )}
            </div>
          )}

          {selectedBookings.length === 0 && !selectedBlock ? (
            <div className="py-8 text-center text-slate-300 text-sm">Nenhum serviço neste dia</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {selectedBookings.map((b) => {
                const d = new Date(b.scheduledAt)
                const end = new Date(d.getTime() + 90 * 60 * 1000)
                return (
                  <Link
                    key={b.id}
                    href={`/videographer/bookings/${b.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-shrink-0 text-center w-14">
                      <p className="text-sm font-bold text-slate-800">
                        {d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {end.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-slate-900 text-sm truncate">{b.consultantName}</p>
                        {b.propertyType && (
                          <span className="text-xs text-[#0f3460] font-bold bg-[#0f3460]/10 px-1.5 py-0.5 rounded-md flex-shrink-0">
                            {b.propertyType === "T5_PLUS" ? "T5+" : b.propertyType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{b.propertyAddress.split(",")[0]}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{b.services.join(", ")}</p>
                    </div>
                    <span className={cn(
                      "flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                      BOOKING_STATUS_COLORS[b.status]
                    )}>
                      {BOOKING_STATUS_LABELS[b.status]}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        {[
          { color: "bg-amber-400", label: "Aguarda Aceitação" },
          { color: "bg-emerald-500", label: "Aceite" },
          { color: "bg-cyan-500", label: "Em Execução" },
          { color: "bg-indigo-500", label: "Ficheiro Entregue" },
          { color: "bg-slate-400", label: "Concluído" },
          { color: "bg-red-300", label: "Bloqueado", square: true },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", l.color)} />
            <span className="text-xs text-slate-500">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
