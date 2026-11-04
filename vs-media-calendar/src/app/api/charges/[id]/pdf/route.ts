import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { moloniPdfResponse } from "@/lib/moloni"

// GET: PDF da fatura Moloni de uma cobrança paga (vídeo a vídeo).
// O consultor só vê as suas; o admin vê todas.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const charge = await prisma.charge.findUnique({
    where: { id },
    select: { consultantId: true, moloniDocumentId: true, paidAt: true },
  })
  if (!charge) {
    return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 })
  }

  const role = (session.user as { role?: string }).role
  if (role !== "ADMIN" && charge.consultantId !== session.user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  if (!charge.moloniDocumentId) {
    return NextResponse.json({ error: "Fatura ainda não emitida no Moloni" }, { status: 404 })
  }

  const date = (charge.paidAt ?? new Date()).toISOString().slice(0, 10)
  try {
    return await moloniPdfResponse(charge.moloniDocumentId, `fatura-${date}.pdf`)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
