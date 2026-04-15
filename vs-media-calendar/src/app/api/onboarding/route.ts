import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const userId = session.user.id
  const role = (session.user as any).role as string
  const body = await req.json()

  try {
    if (role === "VIDEOGRAPHER") {
      const { phone, nif, iban } = body

      if (!phone || !nif || !iban) {
        return NextResponse.json({ error: "Todos os campos obrigatórios são necessários" }, { status: 400 })
      }

      await prisma.user.update({
        where: { id: userId },
        data: { phone, nif, iban, onboardingCompleted: true },
      })
    } else {
      const { phone, billingName, billingNif, billingAddress, billingCompany } = body

      if (!phone || !billingName || !billingNif || !billingAddress) {
        return NextResponse.json({ error: "Todos os campos obrigatórios são necessários" }, { status: 400 })
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          phone,
          billingName,
          billingNif,
          billingCompany: billingCompany || null,
          billingAddress,
          onboardingCompleted: true,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Onboarding error:", err)
    return NextResponse.json({ error: "Erro ao guardar dados" }, { status: 500 })
  }
}
