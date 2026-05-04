import { NextResponse } from "next/server"
import { auth } from "@/auth"

const MOLONI_API = "https://api.moloni.pt/v1"

export async function GET() {
  const session = await auth()
  const userRole = (session?.user as any)?.role
  if (!session?.user || userRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: Record<string, unknown> = {}

  // 1. Check env vars
  const requiredVars = [
    "MOLONI_CLIENT_ID",
    "MOLONI_CLIENT_SECRET",
    "MOLONI_USERNAME",
    "MOLONI_PASSWORD",
    "MOLONI_COMPANY_ID",
    "MOLONI_DOCUMENT_SET_ID",
    "MOLONI_TAX_ID",
  ]
  const missingVars = requiredVars.filter((v) => !process.env[v])
  results.envVars = missingVars.length === 0
    ? "OK — todas as variáveis configuradas"
    : `FALTAM: ${missingVars.join(", ")}`

  if (missingVars.length > 0) {
    return NextResponse.json({ ok: false, results })
  }

  // 2. Auth — get token
  let token: string
  try {
    const body = new FormData()
    body.append("grant_type", "password")
    body.append("client_id", process.env.MOLONI_CLIENT_ID!)
    body.append("client_secret", process.env.MOLONI_CLIENT_SECRET!)
    body.append("username", process.env.MOLONI_USERNAME!)
    body.append("password", process.env.MOLONI_PASSWORD!)
    const res = await fetch(`${MOLONI_API}/grant/`, {
      method: "POST",
      body,
    })
    const data = await res.json()
    if (!data.access_token) throw new Error(JSON.stringify(data))
    token = data.access_token
    results.auth = "OK — token obtido com sucesso"
  } catch (e) {
    results.auth = `ERRO: ${e instanceof Error ? e.message : String(e)}`
    return NextResponse.json({ ok: false, results })
  }

  // 3. Fetch companies to validate company ID
  try {
    const res = await fetch(
      `${MOLONI_API}/companies/getAll/?access_token=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
    )
    const companies = await res.json()
    const companyId = parseInt(process.env.MOLONI_COMPANY_ID!)
    if (Array.isArray(companies)) {
      const match = companies.find((c: any) => c.company_id === companyId)
      results.company = match
        ? `OK — "${match.name}" (ID ${companyId})`
        : `AVISO — ID ${companyId} não encontrado. Empresas disponíveis: ${companies.map((c: any) => `${c.name} (${c.company_id})`).join(", ")}`
    } else {
      results.company = `Resposta inesperada: ${JSON.stringify(companies)}`
    }
  } catch (e) {
    results.company = `ERRO: ${e instanceof Error ? e.message : String(e)}`
  }

  // 4. Fetch document sets to validate document set ID
  try {
    const companyId = parseInt(process.env.MOLONI_COMPANY_ID!)
    const res = await fetch(
      `${MOLONI_API}/documentSets/getAll/?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId }),
      }
    )
    const sets = await res.json()
    const documentSetId = parseInt(process.env.MOLONI_DOCUMENT_SET_ID!)
    if (Array.isArray(sets)) {
      const match = sets.find((s: any) => s.document_set_id === documentSetId)
      results.documentSet = match
        ? `OK — "${match.name}" (ID ${documentSetId})`
        : `AVISO — ID ${documentSetId} não encontrado. Séries disponíveis: ${sets.map((s: any) => `${s.name} (${s.document_set_id})`).join(", ")}`
    } else {
      results.documentSet = `Resposta inesperada: ${JSON.stringify(sets)}`
    }
  } catch (e) {
    results.documentSet = `ERRO: ${e instanceof Error ? e.message : String(e)}`
  }

  // 5. Fetch taxes to validate tax ID
  try {
    const companyId = parseInt(process.env.MOLONI_COMPANY_ID!)
    const res = await fetch(
      `${MOLONI_API}/taxes/getAll/?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId }),
      }
    )
    const taxes = await res.json()
    const taxId = parseInt(process.env.MOLONI_TAX_ID!)
    if (Array.isArray(taxes)) {
      const match = taxes.find((t: any) => t.tax_id === taxId)
      results.tax = match
        ? `OK — "${match.name}" ${match.value}% (ID ${taxId})`
        : `AVISO — ID ${taxId} não encontrado. Impostos disponíveis: ${taxes.map((t: any) => `${t.name} ${t.value}% (${t.tax_id})`).join(", ")}`
    } else {
      results.tax = `Resposta inesperada: ${JSON.stringify(taxes)}`
    }
  } catch (e) {
    results.tax = `ERRO: ${e instanceof Error ? e.message : String(e)}`
  }

  const ok = Object.values(results).every((v) => String(v).startsWith("OK"))
  return NextResponse.json({ ok, results })
}
