import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { recomputeMonthlyInvoice, BACKFILL_PREFIX } from "@/lib/invoices"

const TARGET_MONTH = "2026-06"
const JULY_MONTH = "2026-07"
const DONE_MARKER = "backfill:intro-junho-2026:DONE"

// Cada linha = um intro de junho 2026, copiado do Excel "para_plataforma_edu.xlsx"
// (colunas: Consultor | Imóvel de | Localização — o label usa o texto literal do Excel)
// consultants com mais de um nome = intro partilhada (25€ ÷ nº de consultores)
const INTROS = [
  { consultants: ["evandro almeida", "diogo antunes"], bookingConsultant: "Rúben", location: "estudio podcast",  label: "Intro — estudio podcast (imóvel de Rúben)" },
  { consultants: ["joao mendes"],     bookingConsultant: "Rúben", location: "estudio podcast",  label: "Intro — estudio podcast (imóvel de Rúben)" },
  { consultants: ["joao mendes"],     bookingConsultant: "Lucas", location: "liberdade",        label: "Intro — arrendamento escritorios av liberdade (imóvel de Lucas)" },
  { consultants: ["sofia andrade"],   bookingConsultant: "Lucas", location: "liberdade",        label: "Intro — arrendamento escritorios av liberdade (imóvel de Lucas)" },
  { consultants: ["joao mendes"],     bookingConsultant: "Lucas", location: "riverside",        label: "Intro — prata riverside (imóvel de Lucas)" },
  { consultants: ["evandro"],         bookingConsultant: "Lucas", location: "riverside",        label: "Intro — prata riverside (imóvel de Lucas)" },
  { consultants: ["diogo antunes"],   bookingConsultant: "Lucas", location: "riverside",        label: "Intro — prata riverside (imóvel de Lucas)" },
  { consultants: ["gabriel"],         bookingConsultant: "Lucas", location: "riverside",        label: "Intro — prata riverside (imóvel de Lucas)" },
  { consultants: ["batista"],         bookingConsultant: "Lucas", location: "riverside",        label: "Intro — prata riverside (imóvel de Lucas)" },
  { consultants: ["joao mendes"],     bookingConsultant: "Rúben", location: "benfica",          label: "Intro — s domingos benfica (imóvel de Rúben)" },
  { consultants: ["filipe silva"],    bookingConsultant: "Rúben", location: "benfica",          label: "Intro — s domingos benfica (imóvel de Rúben)" },
  { consultants: ["evandro"],         bookingConsultant: "Rúben", location: "ramada",           label: "Intro — t3 ramada (imóvel de Rúben)" },
  { consultants: ["gabriel"],         bookingConsultant: "Rúben", location: "ramada",           label: "Intro — t3 ramada (imóvel de Rúben)" },
  { consultants: ["filipe silva"],    bookingConsultant: "Rúben", location: "ramada",           label: "Intro — t3 ramada (imóvel de Rúben)" },
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
    // Resolver todos os consultores da linha (1 = individual, 2+ = partilhada)
    const users: { id: string; name: string | null }[] = []
    for (const consultantName of row.consultants) {
      const user = await findUser(consultantName)
      if (!user) {
        notFound.push(consultantName)
        results.push({ consultant: consultantName, charged: false, deliverable: false, error: "Consultor não encontrado" })
        continue
      }
      users.push(user)
    }
    if (users.length === 0) continue

    const booking = await findBooking(row.location, row.bookingConsultant)

    // Uma cópia do deliverable por consultor: cada um paga 25€ ÷ nº de consultores
    // no SEU mês (junho, ou julho se o junho dele já está pago). Os outros
    // consultores da partilha vão nos slots seguintes para o cálculo do ÷N.
    for (const user of users) {
      const june = await prisma.monthlyInvoice.findFirst({ where: { consultantId: user.id, month: TARGET_MONTH } })
      const chargeMonth = june?.status === "PAID" ? JULY_MONTH : TARGET_MONTH

      const others = users.filter((u) => u.id !== user.id)

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
            secondConsultantId: others[0]?.id ?? null,
            thirdConsultantId: others[1]?.id ?? null,
            fourthConsultantId: others[2]?.id ?? null,
            // fee do videógrafo dividido pelas cópias para somar 10€ por vídeo
            videographerFee: Math.round((10 / users.length) * 100) / 100,
          },
        })
        deliverablesCreated++
      }

      names.set(user.id, user.name ?? row.consultants[0])
      const months = monthsToRecompute.get(user.id) ?? new Set<string>()
      months.add(chargeMonth)
      monthsToRecompute.set(user.id, months)
      results.push({ consultant: user.name ?? row.consultants[0], charged: !!anchorBooking, deliverable: !!anchorBooking })
    }
  }

  const skippedPaid: string[] = []
  for (const [userId, months] of monthsToRecompute) {
    for (const month of months) {
      const outcome = await recomputeMonthlyInvoice(userId, month)
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
    for (const consultantName of row.consultants) {
      const user = await findUser(consultantName)
      if (!user) continue
      const result = await prisma.deliverable.updateMany({
        where: {
          fileUrl: `${BACKFILL_PREFIX}${row.location}:${user.id}`,
        },
        data: { description: row.label },
      })
      updated += result.count
    }
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

  for (const consultantName of INTROS.flatMap((row) => row.consultants)) {
    const user = await findUser(consultantName)
    if (!user) { skipped.push(consultantName); continue }
    if (processed.has(user.id)) continue
    processed.add(user.id)

    const june = await prisma.monthlyInvoice.findFirst({ where: { consultantId: user.id, month: TARGET_MONTH } })
    if (!june || june.status !== "PAID") {
      skipped.push(user.name ?? consultantName)
      continue
    }

    // Re-marcar os deliverables deste consultor como cobrados em julho e recalcular
    await prisma.deliverable.updateMany({
      where: { fileUrl: { startsWith: BACKFILL_PREFIX }, targetConsultantId: user.id },
      data: { mimeType: `backfill-charged:${JULY_MONTH}` },
    })
    await recomputeMonthlyInvoice(user.id, JULY_MONTH)

    moved.push(user.name ?? consultantName)
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
