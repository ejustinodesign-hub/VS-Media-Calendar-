import { NextRequest } from "next/server"
import { buildDiplomaHtml, DiplomaType } from "@/lib/diploma-html"

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = (searchParams.get("type") ?? "video") as DiplomaType
  const month = searchParams.get("month") ?? ""
  const names = searchParams.getAll("name")
  const images = searchParams.getAll("image")
  const metric = Number(searchParams.get("metric") ?? "0")
  const metricLabel = searchParams.get("metricLabel") ?? ""

  const winners = names.map((n, i) => ({ name: n || "—", image: images[i] || "" }))
  const html = buildDiplomaHtml({ type, month, winners, metric, metricLabel })

  // Use globally installed Playwright — eval() prevents webpack from trying
  // to bundle the absolute path at build time; resolved by Node at runtime.
  // eslint-disable-next-line no-eval
  const { chromium } = eval("require")("/opt/node22/lib/node_modules/playwright")

  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  try {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 660, height: 900 })
    await page.setContent(html, { waitUntil: "networkidle" })

    // Screenshot just the diploma card element
    const diploma = await page.$(".diploma")
    if (!diploma) throw new Error("Diploma element not found")

    const png = await diploma.screenshot({ type: "png" })

    const fileName = `diploma-${type}-${month.replace(/\s/g, "-")}.png`
    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } finally {
    await browser.close()
  }
}
