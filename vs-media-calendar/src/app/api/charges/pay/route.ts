import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-03-25.dahlia" })
}

// POST /api/charges/pay  { chargeIds: string[] }
//
// Paga uma ou várias cobranças de uma só vez. Cada cobrança vai como linha
// própria no checkout, para o consultor ver exactamente o que está a pagar.
export async function POST(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (!session?.user || (role !== "CONSULTANT" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { chargeIds } = await req.json() as { chargeIds: string[] }
  if (!Array.isArray(chargeIds) || chargeIds.length === 0) {
    return NextResponse.json({ error: "Nenhuma cobrança indicada." }, { status: 400 })
  }

  const charges = await prisma.charge.findMany({
    where: {
      id: { in: chargeIds },
      status: "PENDING",
      ...(role === "ADMIN" ? {} : { consultantId: session.user.id! }),
    },
  })

  if (charges.length === 0) {
    return NextResponse.json({ error: "Cobranças não encontradas ou já pagas." }, { status: 404 })
  }
  // Todas têm de ser do mesmo consultor — o pagamento é dele
  const consultantId = charges[0].consultantId
  if (charges.some((c) => c.consultantId !== consultantId)) {
    return NextResponse.json({ error: "Cobranças de consultores diferentes." }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  try {
    const checkoutSession = await getStripe().checkout.sessions.create({
      payment_method_types: ["card", "mb_way"],
      mode: "payment",
      line_items: charges.map((c) => ({
        price_data: {
          currency: "eur",
          product_data: { name: c.description.slice(0, 250) },
          unit_amount: Math.round(c.totalAmount * 100),
        },
        quantity: 1,
      })),
      success_url: `${appUrl}/consultant/payments?payment=success`,
      cancel_url: `${appUrl}/consultant/payments`,
      metadata: { chargeIds: charges.map((c) => c.id).join(",") },
      locale: "pt",
    })

    await prisma.charge.updateMany({
      where: { id: { in: charges.map((c) => c.id) } },
      data: { stripeSessionId: checkoutSession.id },
    })

    return NextResponse.json({ checkoutUrl: checkoutSession.url })
  } catch (err: any) {
    console.error("[charges/pay] Stripe error:", err)
    return NextResponse.json(
      { error: err?.message || "Erro ao criar sessão de pagamento." },
      { status: 500 }
    )
  }
}
