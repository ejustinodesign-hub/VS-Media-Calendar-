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

    const res = await fetch(
      `${MOLONI_API}/invoiceReceipts/getPDFLink/?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `company_id=${companyId}&document_id=${invoice.moloniDocumentId}`,
      }
    )

    // getPDFLink may return a JSON string, a JSON object, or raw text
    const raw = await res.text()
    let pdfUrl: string | null = null
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed === "string") pdfUrl = parsed
      else pdfUrl = parsed?.url ?? parsed?.pdf_url ?? parsed?.link ?? null
    } catch {
      // Raw text might already be the URL
      if (raw.startsWith("http")) pdfUrl = raw.trim()
    }

    if (!pdfUrl) {
      return NextResponse.json({ error: "Moloni não devolveu URL do PDF", raw }, { status: 502 })
    }

    // Fetch the PDF — include access token in case the URL requires it
    const urlWithToken = pdfUrl.includes("access_token") ? pdfUrl : `${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}access_token=${token}`
    const pdfRes = await fetch(urlWithToken)
    const contentType = pdfRes.headers.get("content-type") ?? ""

    if (pdfRes.ok && contentType.includes("pdf")) {
      const pdfBuffer = await pdfRes.arrayBuffer()
      return new Response(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="fatura-${invoice.month}.pdf"`,
        },
      })
    }

    // PDF URL not directly fetchable — redirect so browser follows it
    return NextResponse.redirect(pdfUrl)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
