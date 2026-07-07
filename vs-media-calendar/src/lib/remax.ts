// Detects whether a Remax.pt property listing has been sold.
// Uses multiple heuristics since the HTML structure may vary.
export async function checkRemaxSold(url: string): Promise<boolean> {
  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-PT,pt;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    })

    // 404 / 410 usually means the listing was removed (often post-sale)
    if (res.status === 404 || res.status === 410) return true

    // Non-success, non-redirect — inconclusive, don't flag as sold
    if (!res.ok) return false

    html = await res.text()
  } catch {
    return false
  }

  const lower = html.toLowerCase()

  // Primary signal: "vendido" text anywhere on the page
  if (lower.includes("vendido")) return true

  // JSON-LD availability sold signals
  if (
    lower.includes('"soldout"') ||
    lower.includes('"discontinued"') ||
    lower.includes("schema.org/soldout") ||
    lower.includes("schema.org/discontinued") ||
    lower.includes("schema.org/outofstock")
  ) return true

  // "não disponível" / "não está disponível" — listing removed notice
  if (
    lower.includes("não está disponível") ||
    lower.includes("imóvel não disponível") ||
    lower.includes("anúncio não disponível")
  ) return true

  return false
}
