import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ONE-TIME setup route — delete after running once
export async function POST() {
  const session = await auth()
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: Record<string, unknown> = {}

  // 1. Add tpalmeida2004@gmail.com as VIDEOGRAPHER
  const videographer = await prisma.user.upsert({
    where: { email: "tpalmeida2004@gmail.com" },
    create: { email: "tpalmeida2004@gmail.com", role: "VIDEOGRAPHER", active: true },
    update: { role: "VIDEOGRAPHER", active: true },
    select: { id: true, email: true, role: true },
  })
  results.videographerAdded = videographer

  // 2. Delete techlib.instagram@gmail.com
  const deleted = await prisma.user.deleteMany({
    where: { email: "techlib.instagram@gmail.com" },
  })
  results.techlib_deleted = deleted.count

  // 3. Set ejustino.design@gmail.com to ADMIN
  const adminUpdate = await prisma.user.updateMany({
    where: { email: "ejustino.design@gmail.com" },
    data: { role: "ADMIN" },
  })
  results.ejustino_admin = adminUpdate.count

  return NextResponse.json({ ok: true, results })
}
