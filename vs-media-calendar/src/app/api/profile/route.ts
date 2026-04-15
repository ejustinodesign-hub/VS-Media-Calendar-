import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const { phone, billingName, billingNif, billingAddress, billingCompany } = await req.json()

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      phone: phone || null,
      billingName: billingName || null,
      billingNif: billingNif || null,
      billingAddress: billingAddress || null,
      billingCompany: billingCompany || null,
    },
  })

  return NextResponse.json({ ok: true })
}
