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
  const dueDate = new Date()

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
  const dateStr = new Date(y, m, 0).toISOString().split("T")[0]
  const dueDateStr = new Date(y, m + 1, 0).toISOString().split("T")[0]

  // Base invoice params in POST body
  const bodyParams: Record<string, string> = {
    company_id: String(companyId),
    document_set_id: String(documentSetId),
    document_set_wsat_id: "0",
    customer_id: String(customerId),
    date: dateStr,
    expiration_date: dueDateStr,
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

  // Products in URL query string with %5B%5D-encoded brackets (PHP parses as array).
  // Fields confirmed from official Moloni WooCommerce/PrestaShop integrations:
  //   product_id, name, summary, qty, price, discount, order (0-based),
  //   exemption_reason (empty string when tax is present), warehouse_id,
  //   taxes[n][tax_id], taxes[n][value], taxes[n][order] (0-based), taxes[n][cumulative]
  // unit_id is NOT a valid invoice line field (only used in product catalog creation)
  const productParts: string[] = []
  TEST_LINES.forEach((line, i) => {
    const add = (k: string, v: string | number) =>
      productParts.push(`products%5B${i}%5D%5B${k}%5D=${encodeURIComponent(String(v))}`)
    add("product_id", 0)
    add("name", line.description)
    add("summary", "")
    add("qty", line.qty)
    add("price", line.unitPrice)
    add("discount", 0)
    add("order", i)               // 0-based
    add("exemption_reason", "")   // required (empty string when tax applies)
    add("warehouse_id", 0)
    // taxes — order is also 0-based
    productParts.push(`products%5B${i}%5D%5Btaxes%5D%5B0%5D%5Btax_id%5D=${taxId}`)
    productParts.push(`products%5B${i}%5D%5Btaxes%5D%5B0%5D%5Bvalue%5D=23`)
    productParts.push(`products%5B${i}%5D%5Btaxes%5D%5B0%5D%5Border%5D=0`)
    productParts.push(`products%5B${i}%5D%5Btaxes%5D%5B0%5D%5Bcumulative%5D=0`)
  })
  const productQs = productParts.join("&")

  try {
    const res = await fetch(
      `${MOLONI_API}/invoices/insert/?access_token=${token}&${productQs}`,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: formBody }
    )
    const text = await res.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = text.slice(0, 500) }

    if ((data as any)?.valid) {
      const docId = (data as any).document_id
      await prisma.monthlyInvoice.update({ where: { id: invoice.id }, data: { moloniDocumentId: docId } })
      return NextResponse.json({ ok: true, invoiceId: invoice.id, total, moloniDocumentId: docId })
    }

    return NextResponse.json({ ok: false, invoiceId: invoice.id, total, moloniResponse: data })
  } catch (e) {
    return NextResponse.json({ ok: false, invoiceId: invoice.id, error: String(e) })
  }
}
