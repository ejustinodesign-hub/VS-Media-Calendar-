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
    // Ensure column exists before writing (safe if already exists)
    await prisma.$executeRaw`
      ALTER TABLE "VideographerProfile"
      ADD COLUMN IF NOT EXISTS "baseSalary" INTEGER NOT NULL DEFAULT 1200
    `
    await prisma.$executeRaw`
      UPDATE "VideographerProfile" SET "baseSalary" = ${baseSalary} WHERE "userId" = ${id}
    `
  } catch (err) {
    console.error("Salary update error:", err)
    return NextResponse.json({ error: "Erro ao atualizar salário" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
