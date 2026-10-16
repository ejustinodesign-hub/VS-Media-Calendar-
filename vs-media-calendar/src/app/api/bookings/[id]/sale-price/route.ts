import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { IVA_RATE } from "@/lib/pricing"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userRole = (session?.user as any)?.role
  if (!session?.user || userRole !== "CONSULTANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { salePrice } = body

  if (!salePrice || typeof salePrice !== "number" || salePrice <= 0) {
    return NextResponse.json({ error: "Invalid sale price" }, { status: 400 })
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id,
      consultantId: session.user.id!,
      paymentType: "COMMISSION",
      salePrice: null,
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  const commissionAmount = salePrice * (booking.commissionRate ?? 0.0015)
  const commissionWithIva = Math.round(commissionAmount * (1 + IVA_RATE) * 100) / 100

  await prisma.booking.update({
    where: { id },
    data: { salePrice, commissionAmount },
  })

  // Comissão passa a ser uma cobrança própria, como qualquer vídeo
  await prisma.charge.create({
    data: {
      consultantId: session.user.id!,
      kind: "BOOKING",
      bookingId: id,
      description: `Comissão ${((booking.commissionRate ?? 0.0015) * 100).toFixed(2)}% — ${booking.propertyAddress}`,
      netAmount: Math.round(commissionAmount * 100) / 100,
      totalAmount: commissionWithIva,
    },
  })

  return NextResponse.json({ success: true, commissionAmount, commissionWithIva })
}
