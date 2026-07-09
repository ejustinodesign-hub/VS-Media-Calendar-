/**
 * Backfill: intros de junho 2026
 * Cria deliverables e cobra as faturas de junho para cada consultor.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/add-june-intros.ts
 *
 * Flags:
 *   --dry-run   Mostra o que faria mas não escreve nada
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const DRY_RUN = process.argv.includes("--dry-run")
const INTRO_PRICE_NET = 25
const IVA_RATE = 0.23
const TARGET_MONTH = "2026-06"
// Último dia de junho a local-time (Portugal = UTC+1 em junho)
const JUNE_DUE_DATE = new Date(2026, 5, 30, 23, 59, 59)

if (DRY_RUN) console.log("🔍 DRY RUN — nada será escrito\n")

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function splitPrice(count: number) {
  const net = round2(INTRO_PRICE_NET / count)
  const withIva = round2(net * (1 + IVA_RATE))
  return { net, withIva }
}

async function chargeJuneInvoice(consultantId: string, net: number, withIva: number) {
  if (DRY_RUN) return
  const existing = await prisma.monthlyInvoice.findFirst({
    where: { consultantId, month: TARGET_MONTH },
  })
  if (existing) {
    await prisma.monthlyInvoice.update({
      where: { id: existing.id },
      data: {
        subtotal: round2(existing.subtotal + net),
        total: round2(existing.total + withIva),
      },
    })
  } else {
    await prisma.monthlyInvoice.create({
      data: {
        consultantId,
        month: TARGET_MONTH,
        subtotal: net,
        total: withIva,
        dueDate: JUNE_DUE_DATE,
        status: "PENDING",
      },
    })
  }
}

async function findUser(nameHint: string) {
  const name = nameHint.trim()
  // Try full name first, then first/last word
  let user = await prisma.user.findFirst({
    where: {
      role: { in: ["CONSULTANT", "ADMIN"] as any },
      active: true,
      name: { contains: name, mode: "insensitive" },
    },
    select: { id: true, name: true, email: true },
  })
  if (!user && name.includes(" ")) {
    // Try first word only
    const first = name.split(" ")[0]
    user = await prisma.user.findFirst({
      where: {
        role: { in: ["CONSULTANT", "ADMIN"] as any },
        active: true,
        name: { contains: first, mode: "insensitive" },
      },
      select: { id: true, name: true, email: true },
    })
  }
  return user
}

async function findBooking(locationKeyword: string, bookingConsultantHint: string) {
  // Find the booking consultant
  const consultant = await prisma.user.findFirst({
    where: {
      role: { in: ["CONSULTANT", "ADMIN"] as any },
      active: true,
      name: { contains: bookingConsultantHint.trim(), mode: "insensitive" },
    },
    select: { id: true, name: true },
  })
  if (!consultant) return null

  // Use the first meaningful word of the location (>3 chars) as keyword
  const keyword = locationKeyword.split(" ").find((w) => w.length > 3) || locationKeyword.split(" ")[0]

  return prisma.booking.findFirst({
    where: {
      consultantId: consultant.id,
      propertyAddress: { contains: keyword, mode: "insensitive" },
    },
    orderBy: { scheduledAt: "desc" },
    select: { id: true, propertyAddress: true, videographerId: true },
  })
}

// ─── Dados do Excel ────────────────────────────────────────────────────────
// Cada grupo = uma sessão com os consultores que apareceram no intro
// A coluna "Imóvel de" identifica o consultor que fez a marcação original
const GROUPS = [
  {
    label: "Estúdio Podcast (Rúben)",
    location: "estudio podcast",
    bookingConsultant: "Rúben",
    // 3 consultores → 25/3 ≈ 8,33€ net cada
    consultantNames: ["evandro almeida", "diogo antunes", "joao mendes"],
  },
  {
    label: "Arrendamento Escritórios Av. Liberdade (Lucas)",
    location: "liberdade",
    bookingConsultant: "Lucas",
    // 2 consultores → 12,50€ net cada
    consultantNames: ["joao mendes", "sofia andrade"],
  },
  {
    label: "Prata Riverside (Lucas)",
    location: "riverside",
    bookingConsultant: "Lucas",
    // 5 consultores → 5€ net cada
    // Nota: deliverable suporta max 4 campos; o 5.º (batista) fica na descrição
    consultantNames: ["joao mendes", "evandro", "diogo antunes", "gabriel", "batista"],
  },
  {
    label: "S. Domingos Benfica (Rúben)",
    location: "benfica",
    bookingConsultant: "Rúben",
    // 2 consultores → 12,50€ net cada
    consultantNames: ["joao mendes", "filipe silva"],
  },
  {
    label: "T3 Ramada (Rúben)",
    location: "ramada",
    bookingConsultant: "Rúben",
    // 3 consultores → 8,33€ net cada
    consultantNames: ["evandro", "gabriel", "filipe silva"],
  },
]

async function main() {
  console.log("=== Backfill Intros Junho 2026 ===\n")
  let totalCharges = 0
  const errors: string[] = []

  for (const group of GROUPS) {
    console.log(`📍 ${group.label}`)

    // ── 1. Encontrar consultores ──────────────────────────────────────────
    const consultants: { id: string; name: string; email: string | null }[] = []
    for (const name of group.consultantNames) {
      const user = await findUser(name)
      if (!user) {
        const msg = `❌ Consultor não encontrado: "${name}" (grupo: ${group.label})`
        console.error("  " + msg)
        errors.push(msg)
        continue
      }
      consultants.push(user)
      console.log(`  👤 ${user.name} [${user.id}]`)
    }

    if (consultants.length !== group.consultantNames.length) {
      console.error("  ⚠️  Consultor(es) em falta — a saltar este grupo\n")
      continue
    }

    // ── 2. Encontrar marcação ─────────────────────────────────────────────
    const booking = await findBooking(group.location, group.bookingConsultant)
    if (!booking) {
      console.warn(`  ⚠️  Marcação não encontrada para "${group.location}" de ${group.bookingConsultant}`)
      console.warn("      A cobrar nas faturas sem deliverable associado")
    } else {
      console.log(`  📋 Marcação: ${booking.id} (${booking.propertyAddress})`)
    }

    // ── 3. Calcular split ─────────────────────────────────────────────────
    const count = consultants.length
    const { net, withIva } = splitPrice(count)
    console.log(`  💰 ${count} consultores → ${net}€ net / ${withIva}€ c/ IVA cada`)

    // ── 4. Criar deliverable (se houver marcação) ─────────────────────────
    if (booking) {
      // Deliverable suporta máx. 4 campos de consultor
      const [c1, c2, c3, c4] = consultants
      const extraNote = count > 4
        ? ` + ${consultants.slice(4).map((c) => c.name).join(", ")}`
        : ""

      if (!DRY_RUN) {
        const deliverable = await prisma.deliverable.create({
          data: {
            bookingId: booking.id,
            fileName: `intro-jun26-${group.location.replace(/\s+/g, "-")}.mp4`,
            fileUrl: `backfill:intro-junho-2026:${group.location.replace(/\s+/g, "-")}`,
            uploadedBy: booking.videographerId,
            description: `Intro junho 2026 — ${group.label}${extraNote}`,
            targetConsultantId: c1.id,
            secondConsultantId: c2?.id ?? null,
            thirdConsultantId: c3?.id ?? null,
            fourthConsultantId: c4?.id ?? null,
            videographerFee: 10,
          },
        })
        console.log(`  📎 Deliverable criado: ${deliverable.id}`)
      } else {
        console.log(`  📎 [dry-run] criaria deliverable com ${Math.min(count, 4)} consultores`)
      }
    }

    // ── 5. Cobrar fatura de junho a cada consultor ────────────────────────
    for (const c of consultants) {
      await chargeJuneInvoice(c.id, net, withIva)
      console.log(`  ✅ ${c.name}: +${net}€ net (+${withIva}€ c/ IVA) → fatura Jun 2026`)
      totalCharges++
    }

    console.log()
  }

  if (errors.length > 0) {
    console.error("⚠️  Erros encontrados:")
    errors.forEach((e) => console.error("   " + e))
  }

  const totalNet = GROUPS.reduce((sum, g) => {
    const { net } = splitPrice(g.consultantNames.length)
    return sum + net * g.consultantNames.length
  }, 0)
  const totalWithIva = GROUPS.reduce((sum, g) => {
    const { withIva } = splitPrice(g.consultantNames.length)
    return sum + withIva * g.consultantNames.length
  }, 0)

  console.log(`\n📊 Resumo:`)
  console.log(`   ${totalCharges} cobranças${DRY_RUN ? " (simuladas)" : " aplicadas"}`)
  console.log(`   Total líquido: ~${round2(totalNet)}€`)
  console.log(`   Total c/ IVA:  ~${round2(totalWithIva)}€`)
  console.log(DRY_RUN ? "\n✅ Dry run concluído (nada foi escrito)" : "\n✅ Concluído!")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
