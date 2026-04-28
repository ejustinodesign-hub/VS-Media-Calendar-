import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (!session?.user || (role !== "VIDEOGRAPHER" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const consultants = await prisma.user.findMany({
    where: { role: "CONSULTANT", active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(consultants)
}
