import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "VIDEOGRAPHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const videographerId = session.user.id!

  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month") // "YYYY-MM"

  let where: any = { videographerId }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number)
    where.startAt = { lte: new Date(y, m, 0, 23, 59, 59) }   // lte last day of month
    where.endAt   = { gte: new Date(y, m - 1, 1, 0, 0, 0) }  // gte first day of month
  }

  const blocks = await prisma.availabilityBlock.findMany({
    where,
    orderBy: { startAt: "asc" },
  })

  return NextResponse.json(blocks.map((b) => ({
    id: b.id,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    reason: b.reason,
  })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "VIDEOGRAPHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const videographerId = session.user.id!

  const { date, reason } = await req.json() // date = "YYYY-MM-DD"
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date inválido (YYYY-MM-DD)" }, { status: 400 })
  }

  // Full-day block in UTC (Vercel runs UTC; matches availability API behaviour)
  const startAt = new Date(`${date}T00:00:00.000Z`)
  const endAt   = new Date(`${date}T23:59:59.999Z`)

  // Avoid duplicates: check if a block already covers this day
  const existing = await prisma.availabilityBlock.findFirst({
    where: {
      videographerId,
      startAt: { lte: endAt },
      endAt:   { gte: startAt },
    },
  })
  if (existing) {
    return NextResponse.json({ error: "Dia já bloqueado" }, { status: 409 })
  }

  const block = await prisma.availabilityBlock.create({
    data: { videographerId, startAt, endAt, reason: reason || null },
  })

  return NextResponse.json({ id: block.id, startAt: block.startAt.toISOString(), endAt: block.endAt.toISOString() })
}
