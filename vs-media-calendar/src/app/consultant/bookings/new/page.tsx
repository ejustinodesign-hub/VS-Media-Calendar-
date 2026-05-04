import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { NewBookingForm } from "./new-booking-form"
import { DEFAULT_PRICES } from "@/lib/pricing"
import type { ServiceType } from "@prisma/client"

export default async function NewBookingPage() {
  const session = await auth()
  const user = session?.user as any

  const [videographers, dbRules] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["VIDEOGRAPHER", "ADMIN"] }, active: true },
      select: {
        id: true,
        name: true,
        image: true,
        videographerProfile: {
          select: { displayName: true, bio: true, weeklyCapacity: true, acceptingWork: true },
        },
      },
    }),
    prisma.pricingRule.findMany({
      where: { active: true, teamId: null },
      select: { serviceType: true, basePrice: true },
    }),
  ])

  const activePrices = { ...DEFAULT_PRICES } as Record<ServiceType, number>
  for (const rule of dbRules) {
    activePrices[rule.serviceType as ServiceType] = rule.basePrice
  }

  return (
    <>
      <Header title="Nova Marcação" subtitle="Agende um novo serviço de vídeo ou fotografia" />
      <div className="flex-1 p-6">
        <NewBookingForm
          videographers={videographers}
          consultantId={user?.id || ""}
          consultantTeamType={user?.teamType || "INTERNAL"}
          activePrices={activePrices}
        />
      </div>
    </>
  )
}
