import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { AdminBookingForm } from "./admin-booking-form"
import { DEFAULT_PRICES } from "@/lib/pricing"
import type { ServiceType } from "@prisma/client"

export default async function AdminNewBookingPage() {
  const [consultants, videographers, dbRules] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CONSULTANT", active: true, name: { not: null } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "VIDEOGRAPHER", active: true, name: { not: null } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.pricingRule.findMany({
      where: { active: true, teamId: null },
      select: { serviceType: true, basePrice: true },
    }),
  ])

  const activePrices = { ...DEFAULT_PRICES } as Record<ServiceType, number>
  for (const rule of dbRules) activePrices[rule.serviceType as ServiceType] = rule.basePrice

  return (
    <>
      <Header title="Nova Marcação" subtitle="Criação de marcação pelo administrador" />
      <div className="flex-1 p-6">
        <AdminBookingForm
          consultants={consultants}
          videographers={videographers}
          activePrices={activePrices}
        />
      </div>
    </>
  )
}
