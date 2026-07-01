import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const invoice = await prisma.monthlyInvoice.update({
    where: { id: params.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
    },
  })

  return NextResponse.json(invoice)
}
