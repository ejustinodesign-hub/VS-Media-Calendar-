import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarView } from "./calendar-view"

interface Props {
  searchParams: Promise<{ month?: string; year?: string }>
}

export default async function VideographerSchedulePage({ searchParams }: Props) {
  const session = await auth()
  const userId = session!.user.id

  const { month: monthParam, year: yearParam } = await searchParams
  const today = new Date()
  const month = monthParam !== undefined ? parseInt(monthParam) : today.getMonth()
  const year = yearParam !== undefined ? parseInt(yearParam) : today.getFullYear()

  const monthStart = new Date(year, month, 1, 0, 0, 0, 0)
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999)

  const [bookings, rawBlocks, profile] = await Promise.all([
    prisma.booking.findMany({
      where: {
        videographerId: userId,
        scheduledAt: { gte: monthStart, lte: monthEnd },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      include: {
        consultant: { select: { name: true } },
        services: { select: { serviceType: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.availabilityBlock.findMany({
      where: {
        videographerId: userId,
        startAt: { lte: monthEnd },
        endAt:   { gte: monthStart },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.videographerProfile.findUnique({
      where: { userId },
      select: { weeklyCapacity: true },
    }),
  ])

  const calendarBookings = bookings.map((b) => ({
    id: b.id,
    scheduledAt: b.scheduledAt.toISOString(),
    status: b.status,
    consultantName: b.consultant.name || "—",
    propertyAddress: b.propertyAddress,
    services: b.services.map((s) => s.serviceType),
    propertyType: b.propertyType,
  }))

  const calendarBlocks = rawBlocks.map((b) => ({
    id: b.id,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    reason: b.reason,
  }))

  const monthTotal = bookings.filter((b) =>
    ["ACCEPTED", "IN_PROGRESS"].includes(b.status)
  ).length

  return (
    <>
      <Header title="Calendário" subtitle="Vista mensal dos seus serviços" />
      <div className="flex-1 p-6 space-y-4 max-w-3xl">
        {/* Monthly summary */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Serviços este mês</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {monthTotal} aceite(s) · {bookings.length} no total (exc. cancelados)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0f3460] rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (monthTotal / (profile?.weeklyCapacity || 5)) * 25)}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-bold text-slate-700">{monthTotal}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <CalendarView bookings={calendarBookings} blocks={calendarBlocks} month={month} year={year} />
      </div>
    </>
  )
}
