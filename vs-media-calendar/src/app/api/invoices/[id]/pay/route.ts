import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-03-25.dahlia" })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userRole = (session?.user as any)?.role
  if (!session?.user || (userRole !== "CONSULTANT" && userRole !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const isAdmin = userRole === "ADMIN"
  const invoice = await prisma.monthlyInvoice.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : { consultantId: session.user.id! }),
      status: { in: ["PENDING", "OVERDUE"] },
    },
  })

  if (!invoice) {
    return NextResponse.json({ error: "Fatura não encontrada ou já paga." }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  try {
    const checkoutSession = await getStripe().checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: `Fatura VS.Media - ${invoice.month}` },
            unit_amount: Math.round(invoice.total * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/consultant/payments?payment=success`,
      cancel_url: `${appUrl}/consultant/payments`,
      metadata: { invoiceId: invoice.id },
      locale: "pt",
    })

    await prisma.monthlyInvoice.update({
      where: { id: invoice.id },
      data: { stripeSessionId: checkoutSession.id },
    })

    return NextResponse.json({ checkoutUrl: checkoutSession.url })
  } catch (err: any) {
    console.error("[pay] Stripe error:", err)
    return NextResponse.json(
      { error: err?.message || "Erro ao criar sessão de pagamento Stripe." },
      { status: 500 }
    )
  }
}
