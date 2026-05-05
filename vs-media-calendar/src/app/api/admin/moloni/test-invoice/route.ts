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

function buildProductQs(
  products: Array<{ name: string; qty: number; price: number }>,
  opts: { unitId?: number; taxId?: number; withTaxValue?: boolean },
) {
  const parts: string[] = []
  products.forEach((p, i) => {
    const add = (k: string, v: string | number) =>
      parts.push(`products%5B${i}%5D%5B${k}%5D=${encodeURIComponent(String(v))}`)
    add("name", p.name)
    add("qty", p.qty)
    add("price", p.price)
    add("order", i + 1)
    add("discount", 0)
    if (opts.unitId != null) add("unit_id", opts.unitId)
    if (opts.taxId != null) {
      parts.push(`products%5B${i}%5D%5Btaxes%5D%5B0%5D%5Btax_id%5D=${opts.taxId}`)
      if (opts.withTaxValue !== false) {
        parts.push(`products%5B${i}%5D%5Btaxes%5D%5B0%5D%5Bvalue%5D=23`)
        parts.push(`products%5B${i}%5D%5Btaxes%5D%5B0%5D%5Border%5D=1`)
        parts.push(`products%5B${i}%5D%5Btaxes%5D%5B0%5D%5Bcumulative%5D=0`)
      }
    }
  })
  return parts.join("&")
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

  // Probe several possible unit class names
  const unitDiag: Record<string, unknown> = {}
  let unitId: number | null = null
  for (const cls of ["units", "measurementUnits", "unitMeasures", "measures"]) {
    try {
      const r = await moloniFetch(`${cls}/getAll`, token, { company_id: String(companyId) })
      const d = await r.json()
      unitDiag[cls] = d
      if (Array.isArray(d) && d.length > 0 && unitId == null) {
        unitId = (d[0].unit_id ?? d[0].id) as number
      }
    } catch (e) {
      unitDiag[cls] = String(e)
    }
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

  const products = TEST_LINES.map((line) => ({
    name: line.description,
    qty: line.qty,
    price: line.unitPrice,
  }))

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

  // Variants to isolate: (a) no tax, (b) tax_id only, (c) tax with value — each with/without unitId
  const variants: Array<{ label: string; opts: Parameters<typeof buildProductQs>[1] }> = [
    { label: "noTax_noUnit",    opts: {} },
    { label: "noTax_unit1",     opts: { unitId: 1 } },
    { label: "taxIdOnly_unit1", opts: { taxId, unitId: 1, withTaxValue: false } },
    { label: "fullTax_unit1",   opts: { taxId, unitId: 1 } },
    ...(unitId != null ? [
      { label: `noTax_unit${unitId}`,     opts: { unitId } as Parameters<typeof buildProductQs>[1] },
      { label: `fullTax_unit${unitId}`,   opts: { taxId, unitId } as Parameters<typeof buildProductQs>[1] },
    ] : []),
  ]

  const attemptResults: Record<string, unknown> = {}

  for (const { label, opts } of variants) {
    const productQs = buildProductQs(products, opts)
    try {
      const res = await fetch(
        `${MOLONI_API}/invoices/insert/?access_token=${token}&${productQs}`,
        { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: formBody }
      )
      const text = await res.text()
      let data: unknown
      try { data = JSON.parse(text) } catch { data = text.slice(0, 200) }
      attemptResults[label] = data
      if ((data as any)?.valid) {
        const docId = (data as any).document_id
        await prisma.monthlyInvoice.update({ where: { id: invoice.id }, data: { moloniDocumentId: docId } })
        return NextResponse.json({ ok: true, invoiceId: invoice.id, total, label, moloniDocumentId: docId })
      }
    } catch (e) {
      attemptResults[label] = String(e)
    }
  }

  return NextResponse.json({ ok: false, invoiceId: invoice.id, total, unitId, unitDiag, attemptResults })
}
