const MOLONI_API = "https://api.moloni.pt/v1"

async function getMoloniToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: process.env.MOLONI_CLIENT_ID!,
    client_secret: process.env.MOLONI_CLIENT_SECRET!,
    username: process.env.MOLONI_USERNAME!,
    password: process.env.MOLONI_PASSWORD!,
  })

  const res = await fetch(`${MOLONI_API}/grant/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  if (!res.ok) throw new Error(`Moloni auth HTTP ${res.status}`)
  const data = await res.json()
  if (!data.access_token) throw new Error("Moloni: no access_token returned")
  return data.access_token as string
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

  const searchRes = await fetch(
    `${MOLONI_API}/customers/getBySearch/?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: companyId, search: vat }),
    }
  )
  const results = await searchRes.json()
  if (Array.isArray(results) && results.length > 0) {
    return results[0].id as number
  }

  const createRes = await fetch(
    `${MOLONI_API}/customers/insert/?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: companyId,
        vat,
        name,
        email: consultant.email || "",
        address: consultant.billingAddress || "",
        zip_code: "",
        city: "",
        country_id: 1,
        language_id: 1,
        payment_method_id: 0,
        payment_day: 0,
        maturity_date_id: 0,
        salesman_id: 0,
      }),
    }
  )
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

export async function createMoloniInvoice(
  params: MoloniInvoiceParams
): Promise<number> {
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

  const products = params.lines.map((line, i) => ({
    product_id: 0,
    name: line.description,
    qty: line.qty,
    price: Math.round(line.unitPrice * 100) / 100,
    order: i + 1,
    discount: 0,
    exemption_reason: "",
    taxes: [{ tax_id: taxId, value: 23, order: 1, cumulative: 0 }],
  }))

  const res = await fetch(
    `${MOLONI_API}/invoices/insert/?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: companyId,
        document_set_id: documentSetId,
        customer_id: customerId,
        date: dateStr,
        expiration_date: dueDateStr,
        financial_discount: 0,
        special_discount: 0,
        salesman_commission: 0,
        products,
        status: 1,
      }),
    }
  )

  const data = await res.json()
  if (!data.valid) {
    throw new Error(`Moloni invoice insert failed: ${JSON.stringify(data)}`)
  }
  return data.document_id as number
}
