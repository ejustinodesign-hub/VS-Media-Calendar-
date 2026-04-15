import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { sendStatusUpdateEmail } from "@/lib/email"
import { SERVICE_LABELS } from "@/lib/pricing"

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
            status: { in: ["ACCEPTED", "IN_PROGRESS"] },
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
          tokenPayload: clientPayload || "",
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const { bookingId, description, originalFileName } = JSON.parse(tokenPayload || "{}")

        const booking = await prisma.booking.findFirst({
          where: { id: bookingId },
          include: {
            consultant: { select: { name: true, email: true } },
            videographer: { select: { name: true, email: true } },
            services: true,
          },
        })
        if (!booking) return

        await prisma.deliverable.create({
          data: {
            bookingId,
            fileName: originalFileName || blob.pathname.split("/").pop() || "ficheiro",
            fileUrl: blob.url,
            mimeType: blob.contentType || null,
            uploadedBy: booking.videographerId,
            description: description || null,
          },
        })

        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: "FILE_DELIVERED" },
        })

        await prisma.notification.create({
          data: {
            userId: booking.consultantId,
            bookingId: booking.id,
            type: "FILE_UPLOADED",
            title: "Conteúdo final entregue",
            message: `O conteúdo final do serviço de ${new Date(booking.scheduledAt).toLocaleDateString("pt-PT")} está disponível.`,
          },
        })

        try {
          const emailData = {
            bookingId: booking.id,
            consultantName: booking.consultant.name || "",
            consultantEmail: booking.consultant.email || "",
            videographerName: booking.videographer.name || "",
            videographerEmail: booking.videographer.email || "",
            propertyAddress: booking.propertyAddress,
            scheduledAt: new Date(booking.scheduledAt),
            services: booking.services.map(
              (s) => SERVICE_LABELS[s.serviceType as keyof typeof SERVICE_LABELS]
            ),
            status: "FILE_DELIVERED" as const,
          }
          await sendStatusUpdateEmail(
            emailData,
            "consultant",
            "O conteúdo final foi entregue e está disponível para download na plataforma."
          )
        } catch (e) {
          console.error("Email error:", e)
        }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Erro no upload" },
      { status: 400 }
    )
  }
}
