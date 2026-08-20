import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { recomputeMonthlyInvoice } from "@/lib/invoices"

// Backfill dos vídeos de julho 2026 faturados à mão:
//   4 vídeos standard (100€ s/IVA cada) + 4 intros na casa da Maiara (25€ s/IVA cada)
const MONTH = "2026-07"
const NOTES_MARKER = "backfill:videos-julho-2026"
const INTRO_PREFIX = "backfill:intro-julho-2026:"
const DONE_MARKER = "backfill:videos-julho-2026:DONE"
const VIDEO_PRICE = 100
const INTRO_LABEL = "Intro — Rua Professor Dias Valente 320, Estoril (imóvel de Maiara)"

// hints: variantes do nome a tentar por ordem (ex. Maiara/Mayara)
const VIDEOS = [
  { hints: ["isabel salgado"],    day: 8,  address: "Rua Br. de Moçamedes 110, Carcavelos" },
  { hints: ["carolina gomes"],    day: 10, address: "La Serena Brunch and Coffee — Estrada de Sassoeiros 4, 2775-530 Carcavelos" },
  { hints: ["pedro bengui"],      day: 30, address: "Rua do Casal 29, 2735-521 Agualva-Cacém" },
  { hints: ["mayara", "maiara"],  day: 30, address: "Rua Professor Dias Valente 320, Estoril" },
]

// Intros no vídeo da Maiara (dia 30) — cobradas a quem aparece, 25€ cada
const INTROS = [["isabel salgado"], ["pedro bengui"], ["gabriel"], ["ana paula"]]

async function findUser(nameHint: string) {
  const name = nameHint.trim()
  const baseWhere = { role: { in: ["CONSULTANT", "ADMIN"] as ("CONSULTANT" | "ADMIN")[] }, active: true }

  // 1) Nome completo
  let user = await prisma.user.findFirst({
    where: { ...baseWhere, name: { contains: name, mode: "insensitive" } },
    select: { id: true, name: true },
  })
  if (user || !name.includes(" ")) return user

  const words = name.split(/\s+/)

  // 2) Apelido (mais distintivo que o primeiro nome)
  user = await prisma.user.findFirst({
    where: { ...baseWhere, name: { contains: words[words.length - 1], mode: "insensitive" } },
    select: { id: true, name: true },
  })
  if (user) return user

  // 3) Início do apelido (tolera variações de grafia, ex. "Bengi"/"Bengui") —
  //    só se corresponder a exatamente UM utilizador
  const lastWord = words[words.length - 1]
  if (lastWord.length >= 5) {
    const byPrefix = await prisma.user.findMany({
      where: { ...baseWhere, name: { contains: lastWord.slice(0, 4), mode: "insensitive" } },
      select: { id: true, name: true },
      take: 2,
    })
    if (byPrefix.length === 1) return byPrefix[0]
  }

  // 4) Primeiro nome — só se corresponder a exatamente UM utilizador
  //    (evita apanhar o homónimo errado)
  const byFirst = await prisma.user.findMany({
    where: { ...baseWhere, name: { contains: words[0], mode: "insensitive" } },
    select: { id: true, name: true },
    take: 2,
  })
  return byFirst.length === 1 ? byFirst[0] : null
}

async function findUserAny(hints: string[]) {
  for (const hint of hints) {
    const user = await findUser(hint)
    if (user) return user
  }
  return null
}

async function rebuild() {
  // Estes vídeos foram todos filmados pelo Pavão
  const videographer =
    (await prisma.user.findFirst({
      where: { role: "VIDEOGRAPHER", active: true, name: { contains: "pavão", mode: "insensitive" } },
      select: { id: true },
    }))
    ?? (await prisma.user.findFirst({
      where: { role: "VIDEOGRAPHER", active: true, name: { contains: "pavao", mode: "insensitive" } },
      select: { id: true },
    }))
    ?? (await prisma.user.findFirst({
      where: { role: "VIDEOGRAPHER", active: true },
      select: { id: true },
    }))
  if (!videographer) {
    return { error: "Nenhum videógrafo ativo encontrado para associar às marcações." }
  }

  const notFound: string[] = []
  const errors: string[] = []
  const affected = new Map<string, string>()
  let bookingsCreated = 0
  let introsCreated = 0
  let maiaraBookingId: string | null = null

  for (const v of VIDEOS) {
    const user = await findUserAny(v.hints)
    if (!user) {
      notFound.push(v.hints[0])
      continue
    }
    try {
      const booking = await prisma.booking.create({
        data: {
          consultantId: user.id,
          videographerId: videographer.id,
          status: "FILE_DELIVERED",
          scheduledAt: new Date(Date.UTC(2026, 6, v.day, 10, 0, 0)),
          propertyAddress: v.address,
          paymentType: "FLAT_FEE",
          notes: NOTES_MARKER,
          services: { create: [{ serviceType: "VIDEO_STANDARD", price: VIDEO_PRICE }] },
        },
      })
      bookingsCreated++
      if (v.hints.includes("maiara") || v.hints.includes("mayara")) maiaraBookingId = booking.id
      affected.set(user.id, user.name ?? v.hints[0])
    } catch (e: any) {
      errors.push(`vídeo ${v.hints[0]}: ${e?.message ?? String(e)}`)
    }
  }

  // Intros ancoradas ao vídeo da Maiara. createdAt em julho para contarem
  // como intros regulares do mês no recálculo e nas páginas de fatura.
  const anchorBookingId =
    maiaraBookingId
    ?? (await prisma.booking.findFirst({ where: { notes: NOTES_MARKER }, select: { id: true } }))?.id
    ?? null

  if (!anchorBookingId) {
    errors.push("intros: sem marcação âncora — nenhum vídeo foi criado")
  } else {
    for (const hints of INTROS) {
      const user = await findUserAny(hints)
      if (!user) {
        notFound.push(hints[0])
        continue
      }
      try {
        await prisma.deliverable.create({
          data: {
            bookingId: anchorBookingId,
            fileName: `intro-jul26-${(user.name ?? "consultor").replace(/\s+/g, "-").toLowerCase()}.mp4`,
            fileUrl: `${INTRO_PREFIX}estoril:${user.id}`,
            uploadedBy: videographer.id,
            description: INTRO_LABEL,
            targetConsultantId: user.id,
            videographerFee: 10,
            createdAt: new Date(Date.UTC(2026, 6, 30, 12, 0, 0)),
          },
        })
        introsCreated++
        affected.set(user.id, user.name ?? hints[0])
      } catch (e: any) {
        errors.push(`intro ${hints[0]}: ${e?.message ?? String(e)}`)
      }
    }
  }

  const skippedPaid: string[] = []
  for (const [userId, name] of affected) {
    const outcome = await recomputeMonthlyInvoice(userId, MONTH)
    if (outcome === "skipped-paid") skippedPaid.push(name)
  }

  // Marcador de idempotência (videographerId não tem FK — seguro como sentinela)
  await prisma.availabilityBlock.create({
    data: {
      videographerId: "system:backfill-julho-2026",
      startAt: new Date(2026, 6, 1),
      endAt: new Date(2026, 6, 31),
      reason: DONE_MARKER,
    },
  })

  return {
    bookings: bookingsCreated,
    intros: introsCreated,
    consultants: [...affected.values()],
    notFound,
    errors,
    skippedPaid,
  }
}

// POST: primeira execução — cria as marcações + intros e recalcula julho
export async function POST() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const marker = await prisma.availabilityBlock.findFirst({ where: { reason: DONE_MARKER } })
  const existingBooking = await prisma.booking.findFirst({ where: { notes: NOTES_MARKER } })
  if (marker || existingBooking) {
    return NextResponse.json({ error: "Os vídeos de julho já foram adicionados. Use «Repor vídeos de julho» para repor tudo de novo." }, { status: 409 })
  }

  const result = await rebuild()
  if ("error" in result) return NextResponse.json(result, { status: 422 })
  return NextResponse.json({ ok: true, ...result })
}

// DELETE: repor — apaga tudo o que este backfill criou e reconstrói do zero
export async function DELETE() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Consultores afetados pela versão anterior (podem já não estar na lista —
  // ex.: consultor errado apanhado por engano) — recalcular também no fim
  const prevBookings = await prisma.booking.findMany({
    where: { notes: NOTES_MARKER },
    select: { consultantId: true },
  })
  const prevIntros = await prisma.deliverable.findMany({
    where: { fileUrl: { startsWith: INTRO_PREFIX } },
    select: { targetConsultantId: true },
  })
  const prevConsultants = new Set<string>([
    ...prevBookings.map((b) => b.consultantId),
    ...prevIntros.map((d) => d.targetConsultantId).filter(Boolean) as string[],
  ])

  // Apagar marcações (cascade remove serviços e deliverables ancorados)
  await prisma.deliverable.deleteMany({ where: { fileUrl: { startsWith: INTRO_PREFIX } } })
  await prisma.booking.deleteMany({ where: { notes: NOTES_MARKER } })
  await prisma.availabilityBlock.deleteMany({ where: { reason: DONE_MARKER } })

  const result = await rebuild()
  if ("error" in result) return NextResponse.json(result, { status: 422 })

  // Limpar faturas de quem estava afetado antes (fica a 0€ → é apagada)
  for (const consultantId of prevConsultants) {
    await recomputeMonthlyInvoice(consultantId, MONTH)
  }

  return NextResponse.json({ ok: true, ...result })
}
