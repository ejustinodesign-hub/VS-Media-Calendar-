export const MOLONI_API = "https://api.moloni.pt/v1"

export async function getMoloniToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "password",
    client_id: process.env.MOLONI_CLIENT_ID!,
    client_secret: process.env.MOLONI_CLIENT_SECRET!,
    username: process.env.MOLONI_USERNAME!,
    password: process.env.MOLONI_PASSWORD!,
  })

  const res = await fetch(`${MOLONI_API}/grant/?${params.toString()}`, {
    method: "POST",
  })

  if (!res.ok) throw new Error(`Moloni auth HTTP ${res.status}`)
  const data = await res.json()
  if (!data.access_token) throw new Error("Moloni: no access_token returned")
  return data.access_token as string
}

// Moloni pattern: access_token in query string, everything else as form-urlencoded body.
// Build body manually to preserve PHP bracket notation (products[0][name])
// — URLSearchParams would percent-encode brackets which PHP can't parse as arrays.
export function moloniFetch(endpoint: string, token: string, params: Record<string, string>) {
  const body = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&")
  return fetch(`${MOLONI_API}/${endpoint}/?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
}

async function findOrCreateCustomer(
  token: string,
  companyId: number,
  consultant: {
    name: string | null
    email: string | null
    billingNif: string | null
    billingName: string | null
    billingAddress: string | null
  }
): Promise<number> {
  const vat = consultant.billingNif || "999999990"
  const name = consultant.billingName || consultant.name || "Consultor VS Media"

  const searchRes = await moloniFetch("customers/getBySearch", token, {
    company_id: String(companyId),
    search: vat,
  })
  const results = await searchRes.json()
  if (Array.isArray(results) && results.length > 0) {
    // Moloni returns customer_id (not id) in search results
    return (results[0].customer_id ?? results[0].id) as number
  }

  const createRes = await moloniFetch("customers/insert", token, {
    company_id: String(companyId),
    number: "0",
    vat,
    name,
    email: consultant.email || "",
    address: consultant.billingAddress || "",
    zip_code: "",
    city: "",
    country_id: "1",
    language_id: "1",
    payment_method_id: "0",
    payment_day: "0",
    maturity_date_id: "0",
    delivery_method_id: "0",
    salesman_id: "0",
    discount: "0",
    credit_limit: "0",
  })
  const created = await createRes.json()
  if (!created.valid) {
    throw new Error(`Moloni customer insert failed: ${JSON.stringify(created)}`)
  }
  return created.customer_id as number
}

export interface MoloniInvoiceLine {
  description: string
  qty: number
  unitPrice: number
}

export interface MoloniInvoiceParams {
  consultant: {
    name: string | null
    email: string | null
    billingNif: string | null
    billingName: string | null
    billingAddress: string | null
  }
  month: string
  dueDate: Date
  lines: MoloniInvoiceLine[]
}

export async function createMoloniInvoice(params: MoloniInvoiceParams): Promise<number> {
  const companyId = parseInt(process.env.MOLONI_COMPANY_ID!)
  const documentSetId = parseInt(process.env.MOLONI_DOCUMENT_SET_ID!)
  const taxId = parseInt(process.env.MOLONI_TAX_ID!)

  if (!companyId || !documentSetId || !taxId) {
    throw new Error("Moloni env vars (MOLONI_COMPANY_ID, MOLONI_DOCUMENT_SET_ID, MOLONI_TAX_ID) not set")
  }

  const token = await getMoloniToken()
  const customerId = await findOrCreateCustomer(token, companyId, params.consultant)

  const [year, month] = params.month.split("-").map(Number)
  const lastDayOfMonth = new Date(year, month, 0)
  const dateStr = lastDayOfMonth.toISOString().split("T")[0]
  const dueDateStr = params.dueDate.toISOString().split("T")[0]

  const invoiceParams: Record<string, string> = {
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

  // Products go in the URL query string with %5B%5D-encoded brackets.
  // Fields confirmed from official Moloni WooCommerce/PrestaShop integrations.
  // unit_id is NOT valid for invoice lines (only for product catalog creation).
  // order and taxes[n][order] are 0-based.
  const productParts: string[] = []
  params.lines.forEach((line, i) => {
    const add = (k: string, v: string | number) =>
      productParts.push(`products%5B${i}%5D%5B${k}%5D=${encodeURIComponent(String(v))}`)
    add("product_id", 0)
    add("name", line.description)
    add("summary", "")
    add("qty", line.qty)
    add("price", Math.round(line.unitPrice * 100) / 100)
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

  const bodyStr = Object.entries(invoiceParams)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")

  const res = await fetch(
    `${MOLONI_API}/invoices/insert/?access_token=${token}&${productQs}`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: bodyStr }
  )
  const data = await res.json()
  if (!data.valid) {
    throw new Error(`Moloni invoice insert failed: ${JSON.stringify(data)}`)
  }
  return data.document_id as number
}
