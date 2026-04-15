import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { del } from "@vercel/blob"

const EXPIRY_DAYS = 15

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - EXPIRY_DAYS)

  const expired = await prisma.deliverable.findMany({
    where: { createdAt: { lte: cutoff } },
  })

  if (expired.length === 0) {
    return NextResponse.json({ deleted: 0 })
  }

  try {
    await del(expired.map((d) => d.fileUrl))
  } catch (e) {
    console.error("Blob deletion error:", e)
  }

  await prisma.deliverable.deleteMany({
    where: { createdAt: { lte: cutoff } },
  })

  console.log(`Cleanup: deleted ${expired.length} expired deliverables`)
  return NextResponse.json({ deleted: expired.length })
}
