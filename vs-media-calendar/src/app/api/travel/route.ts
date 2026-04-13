import { NextRequest, NextResponse } from "next/server"
import { estimateTravelTime } from "@/lib/travel"

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 })
  }

  const estimate = await estimateTravelTime(address)
  if (!estimate) {
    // If we can't calculate, default to no fee (graceful degradation)
    return NextResponse.json({
      durationText: "Desconhecido",
      hasTravelFee: false,
      error: "Não foi possível calcular o tempo de deslocação",
    })
  }

  return NextResponse.json({
    durationSeconds: estimate.durationSeconds,
    durationText: estimate.durationText,
    distanceText: estimate.distanceText,
    hasTravelFee: estimate.hasTravelFee,
  })
}
