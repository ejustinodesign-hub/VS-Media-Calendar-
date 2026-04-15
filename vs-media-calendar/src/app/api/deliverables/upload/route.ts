import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "VIDEOGRAPHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { bookingId } = JSON.parse(clientPayload || "{}")
        if (!bookingId) throw new Error("bookingId em falta")

        const booking = await prisma.booking.findFirst({
          where: {
            id: bookingId,
            videographerId: session.user.id,
            status: { in: ["ACCEPTED", "IN_PROGRESS", "FILE_DELIVERED"] },
          },
        })
        if (!booking) throw new Error("Marcação não encontrada ou em estado inválido")

        return {
          allowedContentTypes: [
            "video/mp4", "video/quicktime", "video/x-msvideo",
            "video/x-matroska", "video/webm", "video/avi",
            "image/jpeg", "image/png", "image/webp",
            "application/pdf", "application/zip",
          ],
        }
      },
      // DB work is handled explicitly by /api/deliverables/complete
      onUploadCompleted: async () => {},
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("Upload token error:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Erro no upload" },
      { status: 400 }
    )
  }
}
