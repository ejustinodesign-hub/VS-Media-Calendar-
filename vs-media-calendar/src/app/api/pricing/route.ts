import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { DEFAULT_PRICES } from "@/lib/pricing"
import type { ServiceType } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function GET() {
  const dbRules = await prisma.pricingRule.findMany({
    where: { active: true, teamId: null },
    select: { serviceType: true, basePrice: true },
  })

  const prices = { ...DEFAULT_PRICES } as Record<ServiceType, number>
  for (const rule of dbRules) {
    prices[rule.serviceType as ServiceType] = rule.basePrice
  }

  return NextResponse.json({ prices }, {
    headers: { "Cache-Control": "no-store" },
  })
}
