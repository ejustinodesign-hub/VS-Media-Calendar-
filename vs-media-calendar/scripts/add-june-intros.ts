/**
 * Backfill: intros individuais de junho 2026
 * Cada linha do Excel = um intro individual → 25€ net por consultor.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/add-june-intros.ts
 *   DATABASE_URL="postgresql://..." npx tsx scripts/add-june-intros.ts --dry-run
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const DRY_RUN = process.argv.includes("--dry-run")
const INTRO_PRICE_NET = 25
const IVA_RATE = 0.23
const INTRO_PRICE_WITH_IVA = Math.round(INTRO_PRICE_NET * (1 + IVA_RATE) * 100) / 100
const TARGET_MONTH = "2026-06"
const JUNE_DUE_DATE = new Date(2026, 5, 30, 23, 59, 59)

if (DRY_RUN) console.log("🔍 DRY RUN — nada será escrito\n")

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// ─── Dados do Excel (cada linha = um intro individual) ─────────────────────
// consultor | imóvel de (consultor que fez a marcação) | localização
const INTROS: { consultant: string; bookingConsultant: string; location: string }[] = [
  { consultant: "evandro almeida",  bookingConsultant: "Rúben", location: "estudio podcast" },
  { consultant: "diogo antunes",    bookingConsultant: "Rúben", location: "estudio podcast" },
  { consultant: "joao mendes",      bookingConsultant: "Rúben", location: "estudio podcast" },
  { consultant: "joao mendes",      bookingConsultant: "Lucas", location: "liberdade" },
  { consultant: "sofia andrade",    bookingConsultant: "Lucas", location: "liberdade" },
  { consultant: "joao mendes",      bookingConsultant: "Lucas", location: "riverside" },
  { consultant: "evandro",          bookingConsultant: "Lucas", location: "riverside" },
  { consultant: "diogo antunes",    bookingConsultant: "Lucas", location: "riverside" },
  { consultant: "gabriel",          bookingConsultant: "Lucas", location: "riverside" },
  { consultant: "batista",          bookingConsultant: "Lucas", location: "riverside" },
  { consultant: "joao mendes",      bookingConsultant: "Rúben", location: "benfica" },
  { consultant: "filipe silva",     bookingConsultant: "Rúben", location: "benfica" },
  { consultant: "evandro",          bookingConsultant: "Rúben", location: "ramada" },
  { consultant: "gabriel",          bookingConsultant: "Rúben", location: "ramada" },
  { consultant: "filipe silva",     bookingConsultant: "Rúben", location: "ramada" },
]

async function findUser(nameHint: string) {
  const name = nameHint.trim()
  let user = await prisma.user.findFirst({
    where: {
      role: { in: ["CONSULTANT", "ADMIN"] as any },
      active: true,
      name: { contains: name, mode: "insensitive" },
    },
    select: { id: true, name: true, email: true },
  })
  // fallback: only first word
  if (!user && name.includes(" ")) {
    user = await prisma.user.findFirst({
      where: {
        role: { in: ["CONSULTANT", "ADMIN"] as any },
        active: true,
        name: { contains: name.split(" ")[0], mode: "insensitive" },
      },
      select: { id: true, name: true, email: true },
    })
  }
  return user
}

// Cache bookings to avoid repeated queries for the same location
const bookingCache = new Map<string, { id: string; propertyAddress: string; videographerId: string } | null>()

async function findBooking(location: string, bookingConsultantHint: string) {
  const key = `${bookingConsultantHint}|${location}`
  if (bookingCache.has(key)) return bookingCache.get(key)!

  const consultant = await prisma.user.findFirst({
    where: {
      role: { in: ["CONSULTANT", "ADMIN"] as any },
      active: true,
      name: { contains: bookingConsultantHint.trim(), mode: "insensitive" },
    },
    select: { id: true },
  })

  if (!consultant) { bookingCache.set(key, null); return null }

  const booking = await prisma.booking.findFirst({
    where: {
      consultantId: consultant.id,
      propertyAddress: { contains: location, mode: "insensitive" },
    },
    orderBy: { scheduledAt: "desc" },
    select: { id: true, propertyAddress: true, videographerId: true },
  })

  bookingCache.set(key, booking)
  return booking
}

async function chargeJuneInvoice(consultantId: string) {
  if (DRY_RUN) return
  const existing = await prisma.monthlyInvoice.findFirst({
    where: { consultantId, month: TARGET_MONTH },
  })
  if (existing) {
    await prisma.monthlyInvoice.update({
      where: { id: existing.id },
      data: {
        subtotal: round2(existing.subtotal + INTRO_PRICE_NET),
        total: round2(existing.total + INTRO_PRICE_WITH_IVA),
      },
    })
  } else {
    await prisma.monthlyInvoice.create({
      data: {
        consultantId,
        month: TARGET_MONTH,
        subtotal: INTRO_PRICE_NET,
        total: INTRO_PRICE_WITH_IVA,
        dueDate: JUNE_DUE_DATE,
        status: "PENDING",
      },
    })
  }
}

async function main() {
  console.log("=== Backfill Intros Individuais — Junho 2026 ===")
  console.log(`    ${INTRO_PRICE_NET}€ net / ${INTRO_PRICE_WITH_IVA}€ c/ IVA por intro\n`)

  let ok = 0
  const errors: string[] = []

  for (const row of INTROS) {
    const user = await findUser(row.consultant)
    if (!user) {
      const msg = `Consultor não encontrado: "${row.consultant}"`
      console.error(`❌ ${msg}`)
      errors.push(msg)
      continue
    }

    const booking = await findBooking(row.location, row.bookingConsultant)
    if (!booking) {
      console.warn(`⚠️  Marcação não encontrada: ${row.location} / ${row.bookingConsultant} — a cobrar sem deliverable`)
    }

    if (!DRY_RUN) {
      if (booking) {
        await prisma.deliverable.create({
          data: {
            bookingId: booking.id,
            fileName: `intro-jun26-${user.name?.replace(/\s+/g, "-").toLowerCase()}-${row.location.replace(/\s+/g, "-")}.mp4`,
            fileUrl: `backfill:intro-junho-2026:${row.location}:${user.id}`,
            uploadedBy: booking.videographerId,
            description: `Intro junho 2026 — ${row.location}`,
            targetConsultantId: user.id,
            videographerFee: 10,
          },
        })
      }
      await chargeJuneInvoice(user.id)
    }

    console.log(`✅ ${user.name.padEnd(25)} → +${INTRO_PRICE_NET}€ net (${row.location})${booking ? "" : " [sem deliverable]"}`)
    ok++
  }

  console.log(`\n📊 ${ok}/${INTROS.length} intros processados`)
  console.log(`   Total net: ${round2(ok * INTRO_PRICE_NET)}€`)
  console.log(`   Total c/ IVA: ${round2(ok * INTRO_PRICE_WITH_IVA)}€`)

  if (errors.length) {
    console.error(`\n⚠️  ${errors.length} erro(s):`)
    errors.forEach((e) => console.error("   " + e))
    process.exit(1)
  }
  console.log(DRY_RUN ? "\n✅ Dry run — corre sem --dry-run para aplicar" : "\n✅ Concluído!")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
