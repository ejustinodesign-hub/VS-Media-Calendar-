import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  // Find bookings this month that have both VIDEO_DRONE and PHOTO_DRONE
  const bookings = await prisma.booking.findMany({
    where: {
      scheduledAt: { gte: monthStart, lte: monthEnd },
      services: {
        some: { serviceType: "VIDEO_DRONE" },
      },
    },
    include: {
      services: true,
    },
  })

  const toFix = bookings.filter((b) =>
    b.services.some((s) => s.serviceType === "VIDEO_DRONE") &&
    b.services.some((s) => s.serviceType === "PHOTO_DRONE" && s.price > 0)
  )

  if (toFix.length === 0) {
    console.log("Nenhuma marcação para corrigir.")
    return
  }

  console.log(`Encontradas ${toFix.length} marcação(ões) para corrigir:`)

  for (const booking of toFix) {
    const photoDroneSvc = booking.services.find((s) => s.serviceType === "PHOTO_DRONE")!
    console.log(`  Booking ${booking.id} — PHOTO_DRONE: ${photoDroneSvc.price}€ → 0€`)

    await prisma.bookingService.update({
      where: { id: photoDroneSvc.id },
      data: { price: 0 },
    })
  }

  console.log("Concluído.")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
