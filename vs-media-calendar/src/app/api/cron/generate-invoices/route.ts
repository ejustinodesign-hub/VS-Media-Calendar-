import { NextRequest, NextResponse } from "next/server"

/**
 * Geração mensal de faturas — desactivada.
 *
 * A cobrança passou a ser vídeo a vídeo: cada entrega cria a sua própria
 * cobrança em `lib/charges.ts`, paga individualmente pelo consultor. As
 * MonthlyInvoice de junho a setembro de 2026 ficam congeladas como histórico
 * e continuam a ser pagas pelo fluxo antigo, mas não se criam faturas novas.
 *
 * A entrada no vercel.json foi removida; esta rota fica como registo e para
 * responder sem erro caso ainda seja chamada.
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json({
    disabled: true,
    reason: "Faturação mensal substituída por cobrança vídeo a vídeo.",
  })
}
