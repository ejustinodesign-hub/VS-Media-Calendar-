"use client"

import { useState } from "react"
import { DEMO_VIDEOGRAPHER_BOOKINGS, DEMO_STATUS_LABELS, DEMO_STATUS_COLORS } from "@/lib/demo-data"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

const STATUS_DOT: Record<string, string> = {
  PENDING_ACCEPTANCE: "bg-amber-400",
  ACCEPTED: "bg-emerald-500",
  IN_PROGRESS: "bg-cyan-500",
  FILE_DELIVERED: "bg-indigo-500",
  COMPLETED: "bg-slate-400",
}

export default function DemoVideographerSchedulePage() {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())

  const activeBookings = DEMO_VIDEOGRAPHER_BOOKINGS.filter(
    (b) => !["CANCELLED", "REJECTED"].includes(b.status)
  )

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7

  const monthName = new Date(year, month, 1).toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
  })

  const getBookingsForDay = (day: number) =>
    activeBookings.filter((b) => {
      const d = new Date(b.scheduledAt)
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year
    })

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
    setSelectedDay(null)
  }

  const selectedBookings = selectedDay ? getBookingsForDay(selectedDay) : []
  const monthTotal = activeBookings.filter((b) => {
    const d = new Date(b.scheduledAt)
    return d.getMonth() === month && d.getFullYear() === year
  }).length

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Calendário</h2>
          <p className="text-sm text-slate-500">Vista mensal dos seus serviços</p>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-4 max-w-3xl">
        {/* Summary bar */}
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Serviços este mês</p>
              <p className="text-xs text-slate-500 mt-0.5">{monthTotal} serviço(s) agendados</p>
            </div>
            <span className="text-2xl font-bold text-[#0f3460]">{monthTotal}</span>
          </CardContent>
        </Card>

        {/* Month navigation */}
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
          <div className="grid grid-cols-7 border-b border-slate-100">
            {WEEK_DAYS.map((d) => (
              <div key={d} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`e${i}`} className="h-16 border-b border-r border-slate-50" />
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dayBookings = getBookingsForDay(day)
              const isToday =
                day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
              const isSelected = day === selectedDay
              const isPast =
                new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())
              const col = (firstDayOffset + day - 1) % 7

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={cn(
                    "h-16 p-1.5 border-b border-r border-slate-100 flex flex-col items-start transition-colors",
                    col === 6 && "border-r-0",
                    isSelected && "bg-[#0f3460]/5",
                    !isSelected && !isToday && "hover:bg-slate-50"
                  )}
                >
                  <span
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      isToday ? "bg-[#e94560] text-white" :
                      isSelected ? "bg-[#0f3460] text-white" :
                      isPast ? "text-slate-300" : "text-slate-700"
                    )}
                  >
                    {day}
                  </span>
                  <div className="flex gap-0.5 mt-auto flex-wrap">
                    {dayBookings.slice(0, 3).map((b) => (
                      <span
                        key={b.id}
                        className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[b.status] || "bg-slate-300")}
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

        {/* Selected day detail */}
        {selectedDay !== null && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="font-bold text-slate-900">
                {new Date(year, month, selectedDay).toLocaleDateString("pt-PT", {
                  weekday: "long", day: "numeric", month: "long",
                })}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedBookings.length === 0 ? "Sem serviços" : `${selectedBookings.length} serviço(s)`}
              </p>
            </div>

            {selectedBookings.length === 0 ? (
              <div className="py-8 text-center text-slate-300 text-sm">Nenhum serviço neste dia</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {selectedBookings.map((b) => {
                  const d = new Date(b.scheduledAt)
                  const end = new Date(d.getTime() + 90 * 60 * 1000)
                  return (
                    <Link
                      key={b.id}
                      href={`/demo/videographer/bookings/${b.id}`}
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
                        <p className="font-semibold text-slate-900 text-sm">{b.consultantName}</p>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{b.propertyAddress.split(",")[0]}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{b.services.join(", ")}</p>
                      </div>
                      <span className={cn(
                        "flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                        DEMO_STATUS_COLORS[b.status]
                      )}>
                        {DEMO_STATUS_LABELS[b.status]}
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
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", l.color)} />
              <span className="text-xs text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
