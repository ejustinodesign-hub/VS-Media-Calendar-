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

// access_token goes in the query string; all other params as form-urlencoded body.
// Keys with bracket notation (products[0][name]) are passed literally — PHP parses them as arrays.
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
  const vat = (consultant.billingNif || "999999990").replace(/\s/g, "")
  const name = consultant.billingName || consultant.name || "Consultor VS Media"

  const searchRes = await moloniFetch("customers/getBySearch", token, {
    company_id: String(companyId),
    search: vat,
  })
  const results = await searchRes.json()
  if (Array.isArray(results) && results.length > 0) {
    return (results[0].customer_id ?? results[0].id) as number
  }

  // Fallback: use a pre-existing generic customer configured via env var.
  // Useful when the Moloni plan doesn't allow customers/insert via API.
  const defaultCustomerId = process.env.MOLONI_DEFAULT_CUSTOMER_ID
  if (defaultCustomerId) {
    return parseInt(defaultCustomerId)
  }

  // Ask Moloni for the next available customer number
  const nextNumRes = await moloniFetch("customers/getNextNumber", token, {
    company_id: String(companyId),
  })
  const nextNumData = await nextNumRes.json()
  const nextNumber = String(nextNumData?.number ?? nextNumData ?? "1")

  const createRes = await moloniFetch("customers/insert", token, {
    company_id: String(companyId),
    number: nextNumber,
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

// Moloni requires a real product_id on invoice lines (product_id:0 is rejected).
// We use a single generic service product (ref: VSMEDIA_SVC) for all lines,
// overriding name and price per line. Created automatically on first use.
async function findOrCreateServiceProduct(
  token: string,
  companyId: number,
  taxId: number,
): Promise<number> {
  // Always fetch units so we can ensure the product uses "Unidade"
  const unitsRes = await moloniFetch("measurementUnits/getAll", token, { company_id: String(companyId) })
  const units = await unitsRes.json()
  if (!Array.isArray(units) || units.length === 0) {
    throw new Error(`measurementUnits/getAll failed: ${JSON.stringify(units)}`)
  }
  const unidade = units.find((u: any) => u.name === "Unidade") ?? units[0]
  const unitId = (unidade.unit_id ?? unidade.id) as number

  const searchRes = await moloniFetch("products/getBySearch", token, {
    company_id: String(companyId),
    search: "VSMEDIA_SVC",
  })
  const found = await searchRes.json()
  if (Array.isArray(found) && found.length > 0) {
    const productId = (found[0].product_id ?? found[0].id) as number
    // Best-effort unit update — don't let it block invoice creation
    if ((found[0].unit_id ?? found[0].unit?.unit_id) !== unitId) {
      try {
        await moloniFetch("products/update", token, {
          company_id: String(companyId),
          product_id: String(productId),
          unit_id: String(unitId),
        })
      } catch { /* non-critical */ }
    }
    return productId
  }

  // Get or create a product category (required by Moloni)
  let categoryId: number
  const catsRes = await moloniFetch("productCategories/getAll", token, { company_id: String(companyId) })
  const cats = await catsRes.json()
  if (Array.isArray(cats) && cats.length > 0) {
    categoryId = (cats[0].category_id ?? cats[0].id) as number
  } else {
    const catRes = await moloniFetch("productCategories/insert", token, {
      company_id: String(companyId),
      parent_id: "0",
      name: "Servicos",
    })
    const cat = await catRes.json()
    if (!cat.valid) throw new Error(`productCategories/insert failed: ${JSON.stringify(cat)}`)
    categoryId = cat.category_id as number
  }

  const createRes = await moloniFetch("products/insert", token, {
    company_id: String(companyId),
    category_id: String(categoryId),
    type: "2",
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
  if (!created.valid) {
    throw new Error(`Moloni product insert failed: ${JSON.stringify(created)}`)
  }
  return created.product_id as number
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
  const productId = await findOrCreateServiceProduct(token, companyId, taxId)

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

  // Products in body with literal bracket keys — same pattern that works for products/insert.
  // unit_id is NOT valid for invoice lines. order and taxes[n][order] are 0-based.
  params.lines.forEach((line, i) => {
    invoiceParams[`products[${i}][product_id]`]          = String(productId)
    invoiceParams[`products[${i}][name]`]                = line.description
    invoiceParams[`products[${i}][summary]`]             = ""
    invoiceParams[`products[${i}][qty]`]                 = String(line.qty)
    invoiceParams[`products[${i}][price]`]               = String(Math.round(line.unitPrice * 100) / 100)
    invoiceParams[`products[${i}][discount]`]            = "0"
    invoiceParams[`products[${i}][order]`]               = String(i)
    invoiceParams[`products[${i}][exemption_reason]`]    = ""
    invoiceParams[`products[${i}][warehouse_id]`]        = "0"
    invoiceParams[`products[${i}][taxes][0][tax_id]`]    = String(taxId)
    invoiceParams[`products[${i}][taxes][0][value]`]     = "23"
    invoiceParams[`products[${i}][taxes][0][order]`]     = "0"
    invoiceParams[`products[${i}][taxes][0][cumulative]`]= "0"
  })

  const res = await moloniFetch("invoiceReceipts/insert", token, invoiceParams)
  const data = await res.json()
  if (!data.valid) {
    throw new Error(`Moloni invoice insert failed: ${JSON.stringify(data)}`)
  }
  return data.document_id as number
}
