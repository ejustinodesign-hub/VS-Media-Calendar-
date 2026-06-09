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

  await prisma.videographerProfile.update({
    where: { userId: id },
    data: { baseSalary },
  })

  return NextResponse.json({ success: true })
}
