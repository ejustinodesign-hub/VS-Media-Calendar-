import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { del } from "@vercel/blob"

const EXPIRY_DAYS = 30

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
    where: {
      createdAt: { lte: cutoff },
      // Nunca apagar um ficheiro que ainda não foi pago: o consultor tem
      // direito a descarregá-lo assim que liquidar a cobrança
      charges: { none: { status: "PENDING" } },
      booking: { is: { charges: { none: { status: "PENDING" } } } },
    },
    select: { id: true, fileUrl: true },
  })

  if (expired.length === 0) {
    return NextResponse.json({ deleted: 0 })
  }

  // Apagar só os ficheiros reais — registos de backfill não têm blob
  const blobUrls = expired.map((d) => d.fileUrl).filter((u) => u.startsWith("http"))
  if (blobUrls.length > 0) {
    try {
      await del(blobUrls)
    } catch (e) {
      console.error("Blob deletion error:", e)
    }
  }

  await prisma.deliverable.deleteMany({
    where: { id: { in: expired.map((d) => d.id) } },
  })

  console.log(`Cleanup: deleted ${expired.length} expired deliverables`)
  return NextResponse.json({ deleted: expired.length })
}
