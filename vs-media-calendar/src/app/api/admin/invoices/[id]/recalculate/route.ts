import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { recomputeMonthlyInvoice } from "@/lib/invoices"

// POST: recalcula só esta fatura a partir dos dados atuais
// (marcações entregues + intros, sem o que já foi cobrado vídeo a vídeo).
// Faturas pagas nunca são alteradas.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const invoice = await prisma.monthlyInvoice.findUnique({
    where: { id },
    select: { consultantId: true, month: true, status: true, total: true },
  })
  if (!invoice) {
    return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 })
  }
  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "Fatura já paga — não é recalculada." }, { status: 409 })
  }

  const outcome = await recomputeMonthlyInvoice(invoice.consultantId, invoice.month)
  const after = await prisma.monthlyInvoice.findUnique({ where: { id }, select: { total: true } })

  return NextResponse.json({
    outcome,
    before: invoice.total,
    after: after?.total ?? 0,
    deleted: !after,
  })
}
