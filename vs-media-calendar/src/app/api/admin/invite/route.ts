import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendInviteEmail } from "@/lib/email"
import { NextResponse } from "next/server"
import type { Role } from "@prisma/client"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { email, role } = await req.json()

  if (!email || !role) {
    return NextResponse.json({ error: "Email e role são obrigatórios" }, { status: 400 })
  }

  const validRoles: Role[] = ["CONSULTANT", "VIDEOGRAPHER", "ADMIN"]
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Role inválido" }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Este email já está registado" }, { status: 409 })
  }

  await prisma.user.create({
    data: {
      email,
      role: role as Role,
      teamType: "INTERNAL",
      active: true,
      onboardingCompleted: false,
    },
  })

  // Send invite email (non-blocking — don't fail if email fails)
  try {
    await sendInviteEmail({ email, role })
  } catch (err) {
    console.error("Invite email error:", err)
  }

  return NextResponse.json({ ok: true })
}
