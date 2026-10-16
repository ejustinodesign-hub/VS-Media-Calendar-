import { prisma } from "@/lib/prisma"
import { INTRO_CONSULTANT_FIELDS } from "@/lib/intros"

export type AccessRole = "ADMIN" | "VIDEOGRAPHER" | "CONSULTANT"

export interface DeliverableAccess {
  /** Pode ver a pré-visualização (streaming no browser). */
  canView: boolean
  /** Pode descarregar o ficheiro final. */
  canDownload: boolean
  /** Mês da fatura que cobre este ficheiro (YYYY-MM), quando aplicável. */
  month: string | null
  /** Porque é que o download está bloqueado, para mostrar ao consultor. */
  reason: "ok" | "not-linked" | "unpaid" | "not-found"
  fileUrl: string | null
  fileName: string | null
  mimeType: string | null
}

const DENIED: DeliverableAccess = {
  canView: false, canDownload: false, month: null,
  reason: "not-found", fileUrl: null, fileName: null, mimeType: null,
}

function monthOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Decide o que um utilizador pode fazer com um ficheiro entregue.
 *
 * Regra de negócio: o consultor só descarrega o ficheiro final depois de
 * pagar a fatura que o inclui. A pré-visualização continua disponível para
 * ele poder ver o que está a pagar.
 *
 * - ADMIN e o videógrafo da marcação: acesso total.
 * - Marcações em comissão: não há fatura mensal, download livre (o consultor
 *   paga uma percentagem na venda).
 * - Intro de outro consultor: conta o mês em que a intro foi cobrada.
 */
export async function getDeliverableAccess(
  deliverableId: string,
  user: { id: string; role: AccessRole }
): Promise<DeliverableAccess> {
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: {
      id: true, fileUrl: true, fileName: true, mimeType: true, createdAt: true,
      ...Object.fromEntries(INTRO_CONSULTANT_FIELDS.map((f) => [f, true])),
      booking: {
        select: { id: true, consultantId: true, videographerId: true, scheduledAt: true, paymentType: true },
      },
    },
  })

  if (!deliverable) return DENIED

  const base = {
    fileUrl: deliverable.fileUrl,
    fileName: deliverable.fileName,
    mimeType: deliverable.mimeType,
  }

  // Admin e o videógrafo que filmou veem e descarregam sempre
  if (user.role === "ADMIN") {
    return { ...base, canView: true, canDownload: true, month: null, reason: "ok" }
  }
  if (user.role === "VIDEOGRAPHER") {
    const owns = deliverable.booking?.videographerId === user.id
    return owns
      ? { ...base, canView: true, canDownload: true, month: null, reason: "ok" }
      : DENIED
  }

  // Consultor: tem de estar ligado ao ficheiro
  const introConsultantIds = INTRO_CONSULTANT_FIELDS
    .map((f) => (deliverable as Record<string, unknown>)[f] as string | null)
    .filter(Boolean) as string[]
  const isIntroTarget = introConsultantIds.includes(user.id)
  const isBookingConsultant = deliverable.booking?.consultantId === user.id

  if (!isIntroTarget && !isBookingConsultant) return DENIED

  // Comissão: não é cobrada na fatura mensal, logo não há nada a pagar aqui
  if (!isIntroTarget && deliverable.booking?.paymentType === "COMMISSION") {
    return { ...base, canView: true, canDownload: true, month: null, reason: "ok" }
  }

  // Mês que cobre este ficheiro: a intro é cobrada no mês em que foi criada;
  // o vídeo da marcação, no mês em que o serviço aconteceu
  const month = isIntroTarget
    ? monthOf(new Date(deliverable.createdAt))
    : monthOf(new Date(deliverable.booking!.scheduledAt))

  const invoice = await prisma.monthlyInvoice.findFirst({
    where: { consultantId: user.id, month },
    select: { status: true },
  })

  // Sem fatura ainda emitida significa que o valor continua por pagar
  const paid = invoice?.status === "PAID"

  return {
    ...base,
    canView: true,
    canDownload: paid,
    month,
    reason: paid ? "ok" : "unpaid",
  }
}
