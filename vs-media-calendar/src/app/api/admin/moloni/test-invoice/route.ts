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

async function findOrCreateServiceProduct(
  token: string,
  companyId: number,
  taxId: number,
): Promise<{ productId: number; diag: unknown }> {
  const diag: Record<string, unknown> = {}

  // Search for existing generic service product
  const searchRes = await moloniFetch("products/getBySearch", token, {
    company_id: String(companyId), search: "VSMEDIA_SVC",
  })
  const found = await searchRes.json()
  diag.productSearch = found
  if (Array.isArray(found) && found.length > 0) {
    const pid = found[0].product_id ?? found[0].id
    diag.productFound = pid
    return { productId: pid as number, diag }
  }

  // Get first measurement unit (required for product creation)
  const unitsRes = await moloniFetch("measurementUnits/getAll", token, { company_id: String(companyId) })
  const units = await unitsRes.json()
  diag.measurementUnits = Array.isArray(units) ? units.map((u: any) => ({ id: u.unit_id ?? u.id, name: u.name })) : units
  if (!Array.isArray(units) || units.length === 0) {
    throw new Error(`measurementUnits/getAll failed: ${JSON.stringify(units)}`)
  }
  const unitId = units[0].unit_id ?? units[0].id

  // Get first product category (category_id:0 is invalid)
  const catsRes = await moloniFetch("productCategories/getAll", token, { company_id: String(companyId) })
  const cats = await catsRes.json()
  diag.productCategories = Array.isArray(cats) ? cats.map((c: any) => ({ id: c.category_id ?? c.id, name: c.name })) : cats
  if (!Array.isArray(cats) || cats.length === 0) {
    throw new Error(`productCategories/getAll failed: ${JSON.stringify(cats)}`)
  }
  const categoryId = cats[0].category_id ?? cats[0].id

  // Create a generic service product (product_id=0 is rejected by Moloni on invoice lines)
  const createRes = await moloniFetch("products/insert", token, {
    company_id: String(companyId),
    category_id: String(categoryId),
    type: "2",              // 2 = service
    reference: "VSMEDIA_SVC",
    name: "Servico VS Media",
    unit_id: String(unitId),
    price: "0",
    has_stock: "0",
    [`taxes[0][tax_id]`]: String(taxId),
    [`taxes[0][value]`]: "23",
    [`taxes[0][order]`]: "0",
    [`taxes[0][cumulative]`]: "0",
  })
  const created = await createRes.json()
  diag.productCreate = created
  if (!created.valid) throw new Error(`products/insert failed: ${JSON.stringify(created)}`)
  return { productId: created.product_id as number, diag }
}

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

  // Find or create the generic service product in Moloni catalog
  let productId: number
  let productDiag: unknown
  try {
    const result = await findOrCreateServiceProduct(token, companyId, taxId)
    productId = result.productId
    productDiag = result.diag
  } catch (e) {
    return NextResponse.json({ ok: false, invoiceId: invoice.id, step: "product", error: String(e) })
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

  // Products in URL query string with real product_id
  const productParts: string[] = []
  TEST_LINES.forEach((line, i) => {
    const add = (k: string, v: string | number) =>
      productParts.push(`products%5B${i}%5D%5B${k}%5D=${encodeURIComponent(String(v))}`)
    add("product_id", productId)
    add("name", line.description)
    add("summary", "")
    add("qty", line.qty)
    add("price", line.unitPrice)
    add("discount", 0)
    add("order", i)
    add("exemption_reason", "")
    add("warehouse_id", 0)
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
      return NextResponse.json({ ok: true, invoiceId: invoice.id, total, productId, moloniDocumentId: docId })
    }

    return NextResponse.json({ ok: false, invoiceId: invoice.id, total, productId, productDiag, moloniResponse: data })
  } catch (e) {
    return NextResponse.json({ ok: false, invoiceId: invoice.id, error: String(e) })
  }
}
