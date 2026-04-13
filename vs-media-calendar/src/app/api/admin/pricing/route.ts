import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import type { ServiceType } from "@prisma/client"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prices } = await req.json()

  // Upsert pricing rules for INTERNAL team
  // We use createMany with skipDuplicates + update pattern instead of upsert
  // since compound unique with nullable fields can be tricky
  for (const [serviceType, basePrice] of Object.entries(prices)) {
    const existing = await prisma.pricingRule.findFirst({
      where: {
        teamType: "INTERNAL",
        serviceType: serviceType as ServiceType,
        teamId: null,
      },
    })

    if (existing) {
      await prisma.pricingRule.update({
        where: { id: existing.id },
        data: { basePrice: basePrice as number },
      })
    } else {
      await prisma.pricingRule.create({
        data: {
          teamType: "INTERNAL",
          serviceType: serviceType as ServiceType,
          basePrice: basePrice as number,
          active: true,
        },
      })
    }
  }

  return NextResponse.json({ success: true })
}
