import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import type { Role } from "@prisma/client"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await auth()
  if (!session?.user || (session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { role, active, name } = body

  const updateData: Partial<{ role: Role; active: boolean; name: string }> = {}
  if (role) updateData.role = role as Role
  if (typeof active === "boolean") updateData.active = active
  if (typeof name === "string" && name.trim()) updateData.name = name.trim()

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json({ success: true, user })
}
