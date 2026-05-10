import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const CONSULTANTS = [
  "adruzilo.matos00@gmail.com",
  "monicamonteiro.marsil@gmail.com",
  "consultor.tiagoribeiro@gmail.com",
  "pedrongenzi@gmail.com",
  "joaoreissmendes.4@gmail.com",
  "almeidaevandro220@gmail.com",
  "sofiamandrade@gmail.com",
  "diogoantunescasca@gmail.com",
  "guilhermepoejo@gmail.com",
  "a.noogueiraa@gmail.com",
  "isabelsalgadoprivate@gmail.com",
  "shila2346@gmail.com",
  "anapaulavsbrothers@gmail.com",
  "miteshsantilal@gmail.com",
  "inessampaio005@gmail.com",
  "ruben.valente.silvaa@gmail.com",
  "diogo6499@gmail.com",
  "abovelisbonhomes@gmail.com",
  "joaovs.consultor@gmail.com",
]

// ONE-TIME route — delete after running once
export async function POST() {
  const session = await auth()
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results = await Promise.all(
    CONSULTANTS.map((email) =>
      prisma.user.upsert({
        where: { email },
        create: { email, role: "CONSULTANT", active: true },
        update: { role: "CONSULTANT", active: true },
        select: { id: true, email: true, role: true },
      })
    )
  )

  return NextResponse.json({ ok: true, count: results.length, consultants: results })
}
