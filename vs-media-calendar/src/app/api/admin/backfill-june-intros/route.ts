import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const INTRO_PRICE_NET = 25
const IVA_RATE = 0.23
const TARGET_MONTH = "2026-06"
const JULY_MONTH = "2026-07"
const BACKFILL_PREFIX = "backfill:intro-junho-2026:"
const DONE_MARKER = "backfill:intro-junho-2026:DONE"

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// Cada linha = um intro individual de junho 2026, copiado do Excel "para_plataforma_edu.xlsx"
// (colunas: Consultor | Imóvel de | Localização — o label usa o texto literal do Excel)
const INTROS = [
  { consultant: "evandro almeida", bookingConsultant: "Rúben", location: "estudio podcast",  label: "Intro — estudio podcast (imóvel de Rúben)" },
  { consultant: "diogo antunes",   bookingConsultant: "Rúben", location: "estudio podcast",  label: "Intro — estudio podcast (imóvel de Rúben)" },
  { consultant: "joao mendes",     bookingConsultant: "Rúben", location: "estudio podcast",  label: "Intro — estudio podcast (imóvel de Rúben)" },
  { consultant: "joao mendes",     bookingConsultant: "Lucas", location: "liberdade",        label: "Intro — arrendamento escritorios av liberdade (imóvel de Lucas)" },
  { consultant: "sofia andrade",   bookingConsultant: "Lucas", location: "liberdade",        label: "Intro — arrendamento escritorios av liberdade (imóvel de Lucas)" },
  { consultant: "joao mendes",     bookingConsultant: "Lucas", location: "riverside",        label: "Intro — prata riverside (imóvel de Lucas)" },
  { consultant: "evandro",         bookingConsultant: "Lucas", location: "riverside",        label: "Intro — prata riverside (imóvel de Lucas)" },
  { consultant: "diogo antunes",   bookingConsultant: "Lucas", location: "riverside",        label: "Intro — prata riverside (imóvel de Lucas)" },
  { consultant: "gabriel",         bookingConsultant: "Lucas", location: "riverside",        label: "Intro — prata riverside (imóvel de Lucas)" },
  { consultant: "batista",         bookingConsultant: "Lucas", location: "riverside",        label: "Intro — prata riverside (imóvel de Lucas)" },
  { consultant: "joao mendes",     bookingConsultant: "Rúben", location: "benfica",          label: "Intro — s domingos benfica (imóvel de Rúben)" },
  { consultant: "filipe silva",    bookingConsultant: "Rúben", location: "benfica",          label: "Intro — s domingos benfica (imóvel de Rúben)" },
  { consultant: "evandro",         bookingConsultant: "Rúben", location: "ramada",           label: "Intro — t3 ramada (imóvel de Rúben)" },
  { consultant: "gabriel",         bookingConsultant: "Rúben", location: "ramada",           label: "Intro — t3 ramada (imóvel de Rúben)" },
  { consultant: "filipe silva",    bookingConsultant: "Rúben", location: "ramada",           label: "Intro — t3 ramada (imóvel de Rúben)" },
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

// Recalcula a fatura do consultor para o mês do zero:
// marcações FLAT_FEE do mês + intros regulares do mês + intros de backfill cobrados nesse mês.
// Nunca toca em faturas PAID.
async function recomputeInvoice(consultantId: string, month: string): Promise<"updated" | "created" | "skipped-paid"> {
  const [year, m] = month.split("-").map(Number)
  const monthStart = new Date(year, m - 1, 1)
  const monthEnd = new Date(year, m, 0, 23, 59, 59)
  const dueDate = new Date(year, m, 0, 23, 59, 59)

  const bookings = await prisma.booking.findMany({
    where: {
      consultantId,
      paymentType: "FLAT_FEE",
      status: { in: ["ACCEPTED", "IN_PROGRESS", "FILE_DELIVERED", "COMPLETED"] },
      scheduledAt: { gte: monthStart, lte: monthEnd },
    },
    include: { services: true },
  })
  const bookingSubtotal = bookings.reduce((sum, b) => {
    const services = b.services.reduce((s, svc) => s + svc.price, 0)
    const travel = b.hasTravelFee ? b.travelFeeAmount : 0
    const extraIntros = b.additionalIntros * INTRO_PRICE_NET
    return sum + services + travel + extraIntros
  }, 0)

  // Intros regulares criados dentro do mês (excluindo os de backfill, que têm mês próprio)
  const regularIntros = await prisma.deliverable.findMany({
    where: {
      OR: [
        { targetConsultantId: consultantId },
        { secondConsultantId: consultantId },
        { thirdConsultantId: consultantId },
        { fourthConsultantId: consultantId },
      ],
      createdAt: { gte: monthStart, lte: monthEnd },
      NOT: { fileUrl: { startsWith: BACKFILL_PREFIX } },
    },
    select: { secondConsultantId: true, thirdConsultantId: true, fourthConsultantId: true },
  })
  const regularIntroSubtotal = regularIntros.reduce((sum, d) => {
    const split = 1 + (d.secondConsultantId ? 1 : 0) + (d.thirdConsultantId ? 1 : 0) + (d.fourthConsultantId ? 1 : 0)
    return sum + round2(INTRO_PRICE_NET / split)
  }, 0)

  // Intros de backfill cobrados neste mês (marcados via mimeType)
  const backfillCount = await prisma.deliverable.count({
    where: {
      fileUrl: { startsWith: BACKFILL_PREFIX },
      targetConsultantId: consultantId,
      mimeType: `backfill-charged:${month}`,
    },
  })
  const backfillSubtotal = backfillCount * INTRO_PRICE_NET

  const subtotal = round2(bookingSubtotal + regularIntroSubtotal + backfillSubtotal)
  const total = round2(subtotal * (1 + IVA_RATE))

  const existing = await prisma.monthlyInvoice.findFirst({ where: { consultantId, month } })
  if (existing) {
    if (existing.status === "PAID") return "skipped-paid"
    await prisma.monthlyInvoice.update({
      where: { id: existing.id },
      data: { subtotal, total },
    })
    return "updated"
  }
  if (subtotal > 0) {
    await prisma.monthlyInvoice.create({
      data: { consultantId, month, subtotal, total, dueDate, status: "PENDING" },
    })
    return "created"
  }
  return "updated"
}

// Cria os 15 deliverables com descrição legível e recalcula as faturas afetadas.
// Assume que não existem deliverables de backfill (POST valida; DELETE apaga antes).
async function rebuild() {
  // Âncora de último recurso: qualquer marcação do sistema (bookingId é obrigatório;
  // a descrição e o consultor vêm dos próprios campos do deliverable)
  const anyBooking = await prisma.booking.findFirst({
    select: { id: true, videographerId: true },
    orderBy: { scheduledAt: "desc" },
  })

  const results: { consultant: string; charged: boolean; deliverable: boolean; error?: string }[] = []
  const notFound: string[] = []
  const names = new Map<string, string>()
  const monthsToRecompute = new Map<string, Set<string>>()
  let deliverablesCreated = 0

  for (const row of INTROS) {
    const user = await findUser(row.consultant)
    if (!user) {
      notFound.push(row.consultant)
      results.push({ consultant: row.consultant, charged: false, deliverable: false, error: "Consultor não encontrado" })
      continue
    }

    // Junho já pago → cobrar em julho
    const june = await prisma.monthlyInvoice.findFirst({ where: { consultantId: user.id, month: TARGET_MONTH } })
    const chargeMonth = june?.status === "PAID" ? JULY_MONTH : TARGET_MONTH

    const booking = await findBooking(row.location, row.bookingConsultant)
    const anchorBooking =
      booking
      ?? (await prisma.booking.findFirst({
        where: { consultantId: user.id },
        select: { id: true, videographerId: true },
        orderBy: { scheduledAt: "desc" },
      }))
      ?? anyBooking

    if (anchorBooking) {
      await prisma.deliverable.create({
        data: {
          bookingId: anchorBooking.id,
          fileName: `intro-jun26-${(user.name ?? "consultor").replace(/\s+/g, "-").toLowerCase()}-${row.location.replace(/\s+/g, "-")}.mp4`,
          fileUrl: `${BACKFILL_PREFIX}${row.location}:${user.id}`,
          mimeType: `backfill-charged:${chargeMonth}`,
          uploadedBy: anchorBooking.videographerId,
          description: row.label,
          targetConsultantId: user.id,
          videographerFee: 10,
        },
      })
      deliverablesCreated++
    }

    names.set(user.id, user.name ?? row.consultant)
    const months = monthsToRecompute.get(user.id) ?? new Set<string>()
    months.add(chargeMonth)
    monthsToRecompute.set(user.id, months)
    results.push({ consultant: user.name ?? row.consultant, charged: !!anchorBooking, deliverable: !!anchorBooking })
  }

  const skippedPaid: string[] = []
  for (const [userId, months] of monthsToRecompute) {
    for (const month of months) {
      const outcome = await recomputeInvoice(userId, month)
      if (outcome === "skipped-paid") skippedPaid.push(`${names.get(userId)} (${month})`)
    }
  }

  // Marcador de idempotência (videographerId não tem FK — seguro como sentinela)
  await prisma.availabilityBlock.create({
    data: {
      videographerId: "system:backfill-junho-2026",
      startAt: new Date(2026, 5, 1),
      endAt: new Date(2026, 5, 30),
      reason: DONE_MARKER,
    },
  })

  return {
    total: INTROS.length,
    charged: results.filter((r) => r.charged).length,
    deliverables: deliverablesCreated,
    repaired: [...names.values()],
    notFound,
    skippedPaid,
    results,
  }
}

// POST: primeira execução — cria deliverables e recalcula faturas
export async function POST() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const marker = await prisma.availabilityBlock.findFirst({ where: { reason: DONE_MARKER } })
  if (marker) {
    return NextResponse.json({ error: "Os intros de junho já foram adicionados anteriormente. Use «Repor triplicados» para repor tudo de novo." }, { status: 409 })
  }
  const deliverableCheck = await prisma.deliverable.findFirst({
    where: { fileUrl: { startsWith: BACKFILL_PREFIX } },
  })
  if (deliverableCheck) {
    return NextResponse.json({ error: "Os intros de junho já foram adicionados anteriormente. Use «Repor triplicados» para repor tudo de novo." }, { status: 409 })
  }

  const result = await rebuild()
  return NextResponse.json({ ok: true, ...result })
}

// PUT: actualiza as descrições dos deliverables já criados para labels legíveis
export async function PUT() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let updated = 0
  for (const row of INTROS) {
    const user = await findUser(row.consultant)
    if (!user) continue
    const result = await prisma.deliverable.updateMany({
      where: {
        fileUrl: `${BACKFILL_PREFIX}${row.location}:${user.id}`,
      },
      data: { description: row.label },
    })
    updated += result.count
  }

  return NextResponse.json({ ok: true, updated })
}

// PATCH: para consultores com junho PAID, move o intro de junho para julho
// (recalcula ambos os meses a partir do marcador de mês nos deliverables)
export async function PATCH() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const moved: string[] = []
  const skipped: string[] = []
  const processed = new Set<string>()

  for (const row of INTROS) {
    const user = await findUser(row.consultant)
    if (!user) { skipped.push(row.consultant); continue }
    if (processed.has(user.id)) continue
    processed.add(user.id)

    const june = await prisma.monthlyInvoice.findFirst({ where: { consultantId: user.id, month: TARGET_MONTH } })
    if (!june || june.status !== "PAID") {
      skipped.push(user.name ?? row.consultant)
      continue
    }

    // Re-marcar os deliverables deste consultor como cobrados em julho e recalcular
    await prisma.deliverable.updateMany({
      where: { fileUrl: { startsWith: BACKFILL_PREFIX }, targetConsultantId: user.id },
      data: { mimeType: `backfill-charged:${JULY_MONTH}` },
    })
    await recomputeInvoice(user.id, JULY_MONTH)

    moved.push(user.name ?? row.consultant)
  }

  return NextResponse.json({ ok: true, moved, skipped })
}

// DELETE: reparação total — apaga tudo o que o backfill criou e reconstrói do zero.
// Idempotente: recalcula as faturas a partir das marcações + deliverables reais,
// por isso corrige triplicações, duplicações ou qualquer estado intermédio.
export async function DELETE() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const deleted = await prisma.deliverable.deleteMany({
    where: { fileUrl: { startsWith: BACKFILL_PREFIX } },
  })
  await prisma.availabilityBlock.deleteMany({ where: { reason: DONE_MARKER } })

  const result = await rebuild()
  return NextResponse.json({ ok: true, deletedDeliverables: deleted.count, ...result })
}
