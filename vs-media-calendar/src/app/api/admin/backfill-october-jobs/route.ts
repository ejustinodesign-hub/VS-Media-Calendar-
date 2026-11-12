import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { runOctoberBackfill } from "@/lib/october-backfill"

// POST: adiciona os trabalhos de outubro feitos fora da plataforma e cria as
// respetivas cobranças. Seguro correr mais de uma vez.
export async function POST() {
  const session = await auth()
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json(await runOctoberBackfill())
}
