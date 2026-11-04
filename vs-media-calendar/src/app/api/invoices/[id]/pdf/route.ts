import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { moloniPdfResponse, syncMoloniDraft } from "@/lib/moloni"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const invoice = await prisma.monthlyInvoice.findUnique({
    where: { id },
    select: { id: true, consultantId: true, moloniDocumentId: true, moloniDraft: true, month: true },
  })

  if (!invoice) {
    return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 })
  }

  const userRole = (session.user as any)?.role
  if (userRole !== "ADMIN" && invoice.consultantId !== session.user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  if (!invoice.moloniDocumentId) {
    return NextResponse.json({ error: "Fatura ainda não emitida no Moloni" }, { status: 404 })
  }

  // Rascunho: só há PDF depois de emitido no Moloni
  if (invoice.moloniDraft) {
    const state = await syncMoloniDraft(invoice).catch(() => "draft" as const)
    if (state !== "issued") {
      return NextResponse.json({ error: "Fatura ainda não emitida no Moloni" }, { status: 404 })
    }
  }

  try {
    return await moloniPdfResponse(invoice.moloniDocumentId, `fatura-${invoice.month}.pdf`)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
