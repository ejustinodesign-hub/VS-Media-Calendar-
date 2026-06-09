import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { baseSalary } = await req.json()

  if (typeof baseSalary !== "number" || baseSalary < 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
  }

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VideographerProfile" ("id", "userId", "displayName", "baseSalary", "acceptingWork", "weeklyCapacity", "createdAt", "updatedAt")
       SELECT md5(random()::text), $1, COALESCE(u.name, u.email, 'Videógrafo'), $2, true, 5, NOW(), NOW()
       FROM "User" u WHERE u.id = $1
       ON CONFLICT ("userId") DO UPDATE SET "baseSalary" = $2, "updatedAt" = NOW()`,
      id,
      baseSalary
    )
  } catch (err) {
    console.error("Salary update error:", err)
    return NextResponse.json({ error: "Erro ao atualizar salário" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
