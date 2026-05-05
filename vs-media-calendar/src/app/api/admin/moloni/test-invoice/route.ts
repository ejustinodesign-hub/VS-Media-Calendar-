import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { createMoloniInvoice } from "@/lib/moloni"
import { IVA_RATE } from "@/lib/pricing"

const TEST_LINES = [
  { description: "Vídeo Standard — Rua Teste 123, Lisboa (FATURA TESTE)", qty: 1, unitPrice: 150 },
  { description: "Fotografia T2 — Rua Teste 123, Lisboa (FATURA TESTE)", qty: 1, unitPrice: 25 },
]
const TEST_MONTH = "2025-04"

export async function POST() {
  const session = await auth()
  const userRole = (session?.user as any)?.role
  if (!session?.user || userRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const consultant = await prisma.user.findFirst({
    where: { email: "vsbrothers.pt@gmail.com" },
    select: { id: true, name: true, email: true, billingNif: true, billingName: true, billingAddress: true },
  })
  if (!consultant) {
    return NextResponse.json({ ok: false, error: "Utilizador vsbrothers.pt@gmail.com não encontrado" }, { status: 404 })
  }

  // Remove existing test invoice for idempotency
  await prisma.monthlyInvoice.deleteMany({
    where: { consultantId: consultant.id, month: TEST_MONTH },
  })

  const subtotal = TEST_LINES.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)
  const total = Math.round(subtotal * (1 + IVA_RATE) * 100) / 100
  const dueDate = new Date(2025, 4, 31, 23, 59, 59)

  const invoice = await prisma.monthlyInvoice.create({
    data: {
      consultantId: consultant.id,
      month: TEST_MONTH,
      subtotal,
      total,
      dueDate,
      status: "PENDING",
    },
  })

  let moloniDocumentId: number | null = null
  let moloniError: string | null = null

  try {
    moloniDocumentId = await createMoloniInvoice({
      consultant,
      month: TEST_MONTH,
      dueDate,
      lines: TEST_LINES,
    })
    await prisma.monthlyInvoice.update({
      where: { id: invoice.id },
      data: { moloniDocumentId },
    })
  } catch (e) {
    moloniError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({
    ok: true,
    invoiceId: invoice.id,
    total,
    moloniDocumentId,
    moloniError,
  })
}
