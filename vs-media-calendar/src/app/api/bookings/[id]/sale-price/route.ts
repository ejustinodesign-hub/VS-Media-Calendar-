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

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const existingInvoice = await prisma.monthlyInvoice.findFirst({
    where: { consultantId: session.user.id!, month },
  })

  if (existingInvoice) {
    await prisma.monthlyInvoice.update({
      where: { id: existingInvoice.id },
      data: {
        subtotal: existingInvoice.subtotal + commissionAmount,
        total: existingInvoice.total + commissionWithIva,
      },
    })
    await prisma.booking.update({
      where: { id },
      data: { invoiceId: existingInvoice.id },
    })
  } else {
    const newInvoice = await prisma.monthlyInvoice.create({
      data: {
        consultantId: session.user.id!,
        month,
        subtotal: commissionAmount,
        total: commissionWithIva,
        dueDate: lastDay,
        status: "PENDING",
      },
    })
    await prisma.booking.update({
      where: { id },
      data: { invoiceId: newInvoice.id },
    })
  }

  return NextResponse.json({ success: true, commissionAmount, commissionWithIva })
}
