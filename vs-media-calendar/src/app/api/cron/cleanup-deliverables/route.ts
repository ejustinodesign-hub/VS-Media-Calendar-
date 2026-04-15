import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { del } from "@vercel/blob"

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron (or allow in development)
  const authHeader = req.headers.get("authorization")
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  // Find all expired deliverables
  const expired = await prisma.deliverable.findMany({
    where: {
      expiresAt: { lte: now },
    },
  })

  if (expired.length === 0) {
    return NextResponse.json({ deleted: 0 })
  }

  // Delete blobs from Vercel Blob storage
  const urls = expired.map((d) => d.fileUrl)
  try {
    await del(urls)
  } catch (e) {
    console.error("Blob deletion error:", e)
    // Continue to remove DB records even if blob deletion partially fails
  }

  // Remove DB records
  await prisma.deliverable.deleteMany({
    where: {
      expiresAt: { lte: now },
    },
  })

  console.log(`Cleanup: deleted ${expired.length} expired deliverables`)
  return NextResponse.json({ deleted: expired.length })
}
