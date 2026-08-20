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

const VIDEOS = [
  { consultant: "isabel salgado", day: 8,  address: "Rua Br. de Moçamedes 110, Carcavelos" },
  { consultant: "carolina gomes", day: 10, address: "La Serena Brunch and Coffee — Estrada de Sassoeiros 4, 2775-530 Carcavelos" },
  { consultant: "pedro bengui",   day: 30, address: "Rua do Casal 29, 2735-521 Agualva-Cacém" },
  { consultant: "maiara",         day: 30, address: "Rua Professor Dias Valente 320, Estoril" },
]

// Intros no vídeo da Maiara (dia 30) — cobradas a quem aparece, 25€ cada
const INTROS = ["isabel salgado", "pedro bengui", "gabriel", "ana paula"]

async function findUser(nameHint: string) {
  const name = nameHint.trim()
  let user = await prisma.user.findFirst({
    where: { role: { in: ["CONSULTANT", "ADMIN"] }, active: true, name: { contains: name, mode: "insensitive" } },
    select: { id: true, name: true },
  })
  if (!user && name.includes(" ")) {
    // Fallback pelo apelido (mais distintivo que o primeiro nome —
    // "carolina" apanharia a Carolina errada)
    const words = name.split(" ")
    user = await prisma.user.findFirst({
      where: { role: { in: ["CONSULTANT", "ADMIN"] }, active: true, name: { contains: words[words.length - 1], mode: "insensitive" } },
      select: { id: true, name: true },
    })
  }
  return user
}

async function rebuild() {
  const videographer = await prisma.user.findFirst({
    where: { role: "VIDEOGRAPHER", active: true },
    select: { id: true },
  })
  if (!videographer) {
    return { error: "Nenhum videógrafo ativo encontrado para associar às marcações." }
  }

  const notFound: string[] = []
  const affected = new Map<string, string>()
  let bookingsCreated = 0
  let introsCreated = 0
  let maiaraBookingId: string | null = null

  for (const v of VIDEOS) {
    const user = await findUser(v.consultant)
    if (!user) {
      notFound.push(v.consultant)
      continue
    }
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
    if (v.consultant === "maiara") maiaraBookingId = booking.id
    affected.set(user.id, user.name ?? v.consultant)
  }

  // Intros ancoradas ao vídeo da Maiara. createdAt em julho para contarem
  // como intros regulares do mês no recálculo e nas páginas de fatura.
  const anchorBookingId =
    maiaraBookingId
    ?? (await prisma.booking.findFirst({ where: { notes: NOTES_MARKER }, select: { id: true } }))?.id
    ?? null

  if (anchorBookingId) {
    for (const name of INTROS) {
      const user = await findUser(name)
      if (!user) {
        notFound.push(name)
        continue
      }
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
      affected.set(user.id, user.name ?? name)
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
