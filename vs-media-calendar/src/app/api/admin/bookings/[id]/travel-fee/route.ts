import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const TRAVEL_FEE_AMOUNT = 50

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { add } = await req.json() as { add: boolean }

  const booking = await prisma.booking.findUnique({ where: { id }, select: { id: true } })
  if (!booking) return NextResponse.json({ error: "Marcação não encontrada" }, { status: 404 })

  await prisma.booking.update({
    where: { id },
    data: {
      hasTravelFee: add,
      travelFeeAmount: add ? TRAVEL_FEE_AMOUNT : 0,
    },
  })

  return NextResponse.json({ success: true })
}
