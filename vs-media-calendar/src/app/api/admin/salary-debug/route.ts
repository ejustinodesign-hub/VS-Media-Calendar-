import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: Record<string, any> = {}

  // 1. Check if column exists
  try {
    const col = await prisma.$queryRawUnsafe<any[]>(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'VideographerProfile' AND column_name = 'baseSalary'
    `)
    results.columnExists = col.length > 0
    results.columnInfo = col[0] ?? null
  } catch (e: any) {
    results.columnCheckError = e.message
  }

  // 2. Read all profiles
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "userId", "baseSalary" FROM "VideographerProfile"`
    )
    results.profiles = rows.map((r) => ({ userId: r.userId, baseSalary: String(r.baseSalary) }))
  } catch (e: any) {
    results.readError = e.message
  }

  return NextResponse.json(results)
}
