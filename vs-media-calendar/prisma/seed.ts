import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  // Create default pricing rules (internal team)
  const pricingRules = [
    { serviceType: "VIDEO_STANDARD" as const, basePrice: 150 },
    { serviceType: "VIDEO_DRONE" as const, basePrice: 180 },
    { serviceType: "PHOTO_DRONE" as const, basePrice: 35 },
    { serviceType: "PHOTO_T1_T2" as const, basePrice: 25 },
    { serviceType: "PHOTO_T3_T4" as const, basePrice: 35 },
    { serviceType: "PHOTO_T5_PLUS" as const, basePrice: 45 },
  ]

  for (const rule of pricingRules) {
    const existing = await prisma.pricingRule.findFirst({
      where: { teamType: "INTERNAL", serviceType: rule.serviceType, teamId: null },
    })
    if (existing) {
      await prisma.pricingRule.update({ where: { id: existing.id }, data: { basePrice: rule.basePrice } })
    } else {
      await prisma.pricingRule.create({
        data: { teamType: "INTERNAL", serviceType: rule.serviceType, basePrice: rule.basePrice, active: true },
      })
    }
  }

  // Create default travel fee rule
  await prisma.travelFeeRule.upsert({
    where: { id: "default-travel-rule" },
    create: {
      id: "default-travel-rule",
      originAddress: "Metropolitan Business Center, Odivelas",
      thresholdHours: 1.0,
      feeAmount: 50.0,
      active: true,
    },
    update: {},
  })

  // Create videographer profiles (created after users log in via Google)
  // These will be set up after initial login by admin

  console.log("✅ Seed completed!")
  console.log("")
  console.log("📋 Next steps:")
  console.log("1. Start the app: npm run dev")
  console.log("2. Login with Google as the first user")
  console.log("3. Manually update your role to ADMIN in the database:")
  console.log("   UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'your@email.com';")
  console.log("4. Create videographer accounts for Eduardo Justino, Tomás Almeida, Bernardo Pavão")
  console.log("5. Set their roles to VIDEOGRAPHER via the admin panel")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
