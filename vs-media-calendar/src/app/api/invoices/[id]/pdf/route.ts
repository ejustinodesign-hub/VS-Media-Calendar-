import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getMoloniToken, MOLONI_API } from "@/lib/moloni"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const invoice = await prisma.monthlyInvoice.findUnique({
    where: { id },
    select: { consultantId: true, moloniDocumentId: true, month: true },
  })

  if (!invoice) {
    return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 })
  }

  // Consultants can only download their own invoices; admins can download any
  const userRole = (session.user as any)?.role
  if (userRole !== "ADMIN" && invoice.consultantId !== session.user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  if (!invoice.moloniDocumentId) {
    return NextResponse.json({ error: "Fatura ainda não emitida no Moloni" }, { status: 404 })
  }

  const companyId = parseInt(process.env.MOLONI_COMPANY_ID!)

  try {
    const token = await getMoloniToken()

    // Moloni returns a URL string for the PDF
    const res = await fetch(
      `${MOLONI_API}/invoices/getPDFLink/?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `company_id=${companyId}&document_id=${invoice.moloniDocumentId}`,
      }
    )
    const data = await res.json()

    // Moloni returns the URL as a plain string in the response
    const pdfUrl = typeof data === "string" ? data : data?.url ?? data?.pdf_url ?? null

    if (!pdfUrl) {
      return NextResponse.json({ error: "Moloni não devolveu URL do PDF", raw: data }, { status: 502 })
    }

    // Proxy the PDF so the user doesn't need a Moloni session
    const pdfRes = await fetch(pdfUrl)
    if (!pdfRes.ok) {
      // If proxy fails, redirect to the URL directly
      return NextResponse.redirect(pdfUrl)
    }

    const pdfBuffer = await pdfRes.arrayBuffer()
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="fatura-${invoice.month}.pdf"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
