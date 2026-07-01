import { NextRequest } from "next/server"
import { buildDiplomaHtml, DiplomaType } from "@/lib/diploma-html"

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

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
