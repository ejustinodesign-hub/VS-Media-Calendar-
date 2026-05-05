import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getMoloniToken, moloniFetch, MOLONI_API } from "@/lib/moloni"
import { IVA_RATE } from "@/lib/pricing"

const TEST_LINES = [
  { description: "Vídeo Standard — Rua Teste 123, Lisboa (FATURA TESTE)", qty: 1, unitPrice: 150 },
  { description: "Fotografia T2 — Rua Teste 123, Lisboa (FATURA TESTE)", qty: 1, unitPrice: 25 },
]

function getPrevMonth() {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`
}
const TEST_MONTH = getPrevMonth()

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

  await prisma.monthlyInvoice.deleteMany({ where: { consultantId: consultant.id, month: TEST_MONTH } })

  const subtotal = TEST_LINES.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)
  const total = Math.round(subtotal * (1 + IVA_RATE) * 100) / 100
  const dueDate = new Date(2025, 4, 31, 23, 59, 59)

  const invoice = await prisma.monthlyInvoice.create({
    data: { consultantId: consultant.id, month: TEST_MONTH, subtotal, total, dueDate, status: "PENDING" },
  })

  const companyId = parseInt(process.env.MOLONI_COMPANY_ID!)
  const documentSetId = parseInt(process.env.MOLONI_DOCUMENT_SET_ID!)
  const taxId = parseInt(process.env.MOLONI_TAX_ID!)

  let token: string
  try {
    token = await getMoloniToken()
  } catch (e) {
    return NextResponse.json({ ok: false, invoiceId: invoice.id, error: String(e) })
  }

  // List valid document sets for invoices (diagnostic)
  let validDocumentSets: unknown = null
  try {
    const dsRes = await moloniFetch("invoices/getDocumentSets", token, { company_id: String(companyId) })
    validDocumentSets = await dsRes.json()
  } catch (e) {
    validDocumentSets = String(e)
  }

  // Find or create customer
  let customerId: number
  try {
    const searchRes = await moloniFetch("customers/getBySearch", token, {
      company_id: String(companyId), search: "999999990",
    })
    const found = await searchRes.json()
    if (Array.isArray(found) && found.length > 0) {
      customerId = (found[0].customer_id ?? found[0].id) as number
    } else {
      const createRes = await moloniFetch("customers/insert", token, {
        company_id: String(companyId), number: "0", vat: "999999990",
        name: consultant.name || "VS Brothers", email: consultant.email || "",
        address: "", zip_code: "", city: "", country_id: "1", language_id: "1",
        payment_method_id: "0", payment_day: "0", maturity_date_id: "0",
        delivery_method_id: "0", salesman_id: "0", discount: "0", credit_limit: "0",
      })
      const created = await createRes.json()
      if (!created.valid) throw new Error(`Customer: ${JSON.stringify(created)}`)
      customerId = created.customer_id
    }
  } catch (e) {
    return NextResponse.json({ ok: false, invoiceId: invoice.id, step: "customer", error: String(e) })
  }

  const [y, m] = TEST_MONTH.split("-").map(Number)
  const dateStr = new Date(y, m, 0).toISOString().split("T")[0]         // last day of TEST_MONTH
  const dueDateStr = new Date(y, m + 1, 0).toISOString().split("T")[0]  // last day of next month

  // JSON body — more reliable than form-urlencoded for nested products array
  const jsonBody = {
    company_id: companyId,
    document_set_id: documentSetId,
    document_set_wsat_id: 0,
    customer_id: customerId,
    date: dateStr,
    expiration_date: dueDateStr,
    financial_discount: 0,
    special_discount: 0,
    salesman_commission: 0,
    our_reference: "",
    your_reference: "",
    notes: "",
    status: 1,
    products: TEST_LINES.map((line, i) => ({
      product_id: 0,
      name: line.description,
      qty: line.qty,
      price: line.unitPrice,
      order: i + 1,
      discount: 0,
      exemption_reason: "",
      taxes: [{ tax_id: taxId, value: 23, order: 1, cumulative: 0 }],
    })),
  }

  // Base params in body (confirmed working)
  const bodyParams: Record<string, string> = {
    company_id: String(jsonBody.company_id),
    document_set_id: String(jsonBody.document_set_id),
    document_set_wsat_id: "0",
    customer_id: String(jsonBody.customer_id),
    date: jsonBody.date,
    expiration_date: jsonBody.expiration_date,
    financial_discount: "0",
    special_discount: "0",
    salesman_commission: "0",
    our_reference: "",
    your_reference: "",
    notes: "",
    status: "1",
  }
  const formBody = Object.entries(bodyParams)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")

  // Products in query string (brackets encoded — PHP decodes %5B%5D as [] for array parsing)
  const productParts: string[] = []
  jsonBody.products.forEach((p, i) => {
    const add = (k: string, v: string | number) =>
      productParts.push(`products%5B${i}%5D%5B${k}%5D=${encodeURIComponent(String(v))}`)
    add("product_id", 0)
    add("name", p.name)
    add("qty", p.qty)
    add("price", p.price)
    add("order", p.order)
    add("discount", 0)
    add("unit_id", 0)
    productParts.push(`products%5B${i}%5D%5Btaxes%5D%5B0%5D%5Btax_id%5D=${taxId}`)
    productParts.push(`products%5B${i}%5D%5Btaxes%5D%5B0%5D%5Bvalue%5D=23`)
    productParts.push(`products%5B${i}%5D%5Btaxes%5D%5B0%5D%5Border%5D=1`)
    productParts.push(`products%5B${i}%5D%5Btaxes%5D%5B0%5D%5Bcumulative%5D=0`)
  })
  const productQs = productParts.join("&")

  const endpoints = ["invoices", "simplifiedInvoices", "invoiceReceipts", "proFormaInvoices"]
  const attemptResults: Record<string, unknown> = {}

  for (const ep of endpoints) {
    try {
      const res = await fetch(
        `${MOLONI_API}/${ep}/insert/?access_token=${token}&${productQs}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formBody,
        }
      )
      const data = await res.json()
      attemptResults[ep] = data
      if (data.valid) {
        await prisma.monthlyInvoice.update({ where: { id: invoice.id }, data: { moloniDocumentId: data.document_id } })
        return NextResponse.json({ ok: true, invoiceId: invoice.id, total, endpoint: ep, moloniDocumentId: data.document_id })
      }
    } catch (e) {
      attemptResults[ep] = String(e)
    }
  }

  return NextResponse.json({ ok: false, invoiceId: invoice.id, total, validDocumentSets, attemptResults })
}
