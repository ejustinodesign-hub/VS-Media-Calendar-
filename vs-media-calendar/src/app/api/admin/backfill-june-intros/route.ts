import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const INTRO_PRICE_NET = 25
const IVA_RATE = 0.23
const INTRO_WITH_IVA = Math.round(INTRO_PRICE_NET * (1 + IVA_RATE) * 100) / 100
const TARGET_MONTH = "2026-06"
const JUNE_DUE_DATE = new Date(2026, 5, 30, 23, 59, 59)
const JULY_MONTH = "2026-07"
const JULY_DUE_DATE = new Date(2026, 6, 31, 23, 59, 59)

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// Cada linha = um intro individual de junho 2026
// consultor | quem fez a marcação | palavra-chave da morada
const INTROS = [
  { consultant: "evandro almeida", bookingConsultant: "Rúben", location: "estudio podcast" },
  { consultant: "diogo antunes",   bookingConsultant: "Rúben", location: "estudio podcast" },
  { consultant: "joao mendes",     bookingConsultant: "Rúben", location: "estudio podcast" },
  { consultant: "joao mendes",     bookingConsultant: "Lucas", location: "liberdade" },
  { consultant: "sofia andrade",   bookingConsultant: "Lucas", location: "liberdade" },
  { consultant: "joao mendes",     bookingConsultant: "Lucas", location: "riverside" },
  { consultant: "evandro",         bookingConsultant: "Lucas", location: "riverside" },
  { consultant: "diogo antunes",   bookingConsultant: "Lucas", location: "riverside" },
  { consultant: "gabriel",         bookingConsultant: "Lucas", location: "riverside" },
  { consultant: "batista",         bookingConsultant: "Lucas", location: "riverside" },
  { consultant: "joao mendes",     bookingConsultant: "Rúben", location: "benfica" },
  { consultant: "filipe silva",    bookingConsultant: "Rúben", location: "benfica" },
  { consultant: "evandro",         bookingConsultant: "Rúben", location: "ramada" },
  { consultant: "gabriel",         bookingConsultant: "Rúben", location: "ramada" },
  { consultant: "filipe silva",    bookingConsultant: "Rúben", location: "ramada" },
]

async function findUser(nameHint: string) {
  const name = nameHint.trim()
  let user = await prisma.user.findFirst({
    where: { role: { in: ["CONSULTANT", "ADMIN"] }, active: true, name: { contains: name, mode: "insensitive" } },
    select: { id: true, name: true },
  })
  if (!user && name.includes(" ")) {
    user = await prisma.user.findFirst({
      where: { role: { in: ["CONSULTANT", "ADMIN"] }, active: true, name: { contains: name.split(" ")[0], mode: "insensitive" } },
      select: { id: true, name: true },
    })
  }
  return user
}

const bookingCache = new Map<string, { id: string; videographerId: string } | null>()

async function findBooking(location: string, consultantHint: string) {
  const key = `${consultantHint}|${location}`
  if (bookingCache.has(key)) return bookingCache.get(key)!
  const consultant = await prisma.user.findFirst({
    where: { role: { in: ["CONSULTANT", "ADMIN"] }, active: true, name: { contains: consultantHint.trim(), mode: "insensitive" } },
    select: { id: true },
  })
  if (!consultant) { bookingCache.set(key, null); return null }
  const booking = await prisma.booking.findFirst({
    where: { consultantId: consultant.id, propertyAddress: { contains: location, mode: "insensitive" } },
    orderBy: { scheduledAt: "desc" },
    select: { id: true, videographerId: true },
  })
  bookingCache.set(key, booking)
  return booking
}

async function addToInvoice(consultantId: string, month: string, dueDate: Date) {
  const existing = await prisma.monthlyInvoice.findFirst({ where: { consultantId, month } })
  if (existing) {
    await prisma.monthlyInvoice.update({
      where: { id: existing.id },
      data: { subtotal: round2(existing.subtotal + INTRO_PRICE_NET), total: round2(existing.total + INTRO_WITH_IVA) },
    })
  } else {
    await prisma.monthlyInvoice.create({
      data: { consultantId, month, subtotal: INTRO_PRICE_NET, total: INTRO_WITH_IVA, dueDate, status: "PENDING" },
    })
  }
}

async function chargeJuneInvoice(consultantId: string) {
  const june = await prisma.monthlyInvoice.findFirst({ where: { consultantId, month: TARGET_MONTH } })
  // Se junho já está pago, cobrar em julho
  if (june?.status === "PAID") {
    await addToInvoice(consultantId, JULY_MONTH, JULY_DUE_DATE)
  } else {
    await addToInvoice(consultantId, TARGET_MONTH, JUNE_DUE_DATE)
  }
}

export async function POST() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Idempotency: check if already ran (first deliverable already exists)
  const alreadyDone = await prisma.deliverable.findFirst({
    where: { fileUrl: { startsWith: "backfill:intro-junho-2026:" } },
  })
  if (alreadyDone) {
    return NextResponse.json({ error: "Os intros de junho já foram adicionados anteriormente." }, { status: 409 })
  }

  const results: { consultant: string; charged: boolean; deliverable: boolean; error?: string }[] = []
  const notFound: string[] = []

  for (const row of INTROS) {
    const user = await findUser(row.consultant)
    if (!user) {
      notFound.push(row.consultant)
      results.push({ consultant: row.consultant, charged: false, deliverable: false, error: "Consultor não encontrado" })
      continue
    }

    const booking = await findBooking(row.location, row.bookingConsultant)

    if (booking) {
      await prisma.deliverable.create({
        data: {
          bookingId: booking.id,
          fileName: `intro-jun26-${(user.name ?? "consultor").replace(/\s+/g, "-").toLowerCase()}-${row.location.replace(/\s+/g, "-")}.mp4`,
          fileUrl: `backfill:intro-junho-2026:${row.location}:${user.id}`,
          uploadedBy: booking.videographerId,
          description: `Intro junho 2026 — ${row.location}`,
          targetConsultantId: user.id,
          videographerFee: 10,
        },
      })
    }

    await chargeJuneInvoice(user.id)
    results.push({ consultant: user.name ?? row.consultant, charged: true, deliverable: !!booking })
  }

  return NextResponse.json({
    ok: true,
    total: INTROS.length,
    charged: results.filter((r) => r.charged).length,
    notFound,
    results,
  })
}

// PATCH: para cada linha do Excel, se a fatura de junho do consultor está PAID,
// subtrai esse intro de junho e adiciona a julho.
// Processa linha a linha — consultores com múltiplos intros são tratados N vezes.
export async function PATCH() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const moved: string[] = []
  const skipped: string[] = []

  for (const row of INTROS) {
    const user = await findUser(row.consultant)
    if (!user) { skipped.push(row.consultant); continue }

    const juneInvoice = await prisma.monthlyInvoice.findFirst({
      where: { consultantId: user.id, month: TARGET_MONTH },
    })

    if (!juneInvoice || juneInvoice.status !== "PAID") {
      skipped.push(user.name ?? row.consultant)
      continue
    }

    // Subtrair este intro de junho (refrescar o registo para evitar race conditions)
    const fresh = await prisma.monthlyInvoice.findUniqueOrThrow({ where: { id: juneInvoice.id } })
    await prisma.monthlyInvoice.update({
      where: { id: juneInvoice.id },
      data: {
        subtotal: round2(fresh.subtotal - INTRO_PRICE_NET),
        total: round2(fresh.total - INTRO_WITH_IVA),
      },
    })

    // Adicionar a julho
    await addToInvoice(user.id, JULY_MONTH, JULY_DUE_DATE)

    moved.push(user.name ?? row.consultant)
  }

  return NextResponse.json({ ok: true, moved, skipped })
}
