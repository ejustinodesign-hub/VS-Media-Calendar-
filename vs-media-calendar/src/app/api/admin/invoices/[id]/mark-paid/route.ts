import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const invoice = await prisma.monthlyInvoice.update({
    where: { id },
    data: {
      status: "PAID",
      paidAt: new Date(),
    },
  })

  return NextResponse.json(invoice)
}
