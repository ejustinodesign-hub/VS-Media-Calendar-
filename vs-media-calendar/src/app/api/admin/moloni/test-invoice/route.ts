import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { createMoloniInvoice } from "@/lib/moloni"

export async function POST() {
  const session = await auth()
  const userRole = (session?.user as any)?.role
  if (!session?.user || userRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const dueDate = new Date()
    dueDate.setMonth(dueDate.getMonth() + 1)

    const moloniDocumentId = await createMoloniInvoice({
      consultant: {
        name: "VS Brothers",
        email: "vsbrothers.pt@gmail.com",
        billingNif: null,
        billingName: null,
        billingAddress: null,
      },
      month: "2025-04",
      dueDate,
      lines: [
        { description: "Vídeo Standard — Rua Teste 123, Lisboa (FATURA TESTE)", qty: 1, unitPrice: 150 },
        { description: "Fotografia T2 — Rua Teste 123, Lisboa (FATURA TESTE)", qty: 1, unitPrice: 25 },
      ],
    })

    return NextResponse.json({ ok: true, moloniDocumentId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
