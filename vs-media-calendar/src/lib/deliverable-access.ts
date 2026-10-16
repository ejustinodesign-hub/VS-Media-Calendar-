import { prisma } from "@/lib/prisma"
import { INTRO_CONSULTANT_FIELDS } from "@/lib/intros"

export type AccessRole = "ADMIN" | "VIDEOGRAPHER" | "CONSULTANT"

export interface DeliverableAccess {
  /** Pode ver a pré-visualização (streaming no browser). */
  canView: boolean
  /** Pode descarregar o ficheiro final. */
  canDownload: boolean
  /** Cobrança que desbloqueia este ficheiro, quando há uma por pagar. */
  chargeId: string | null
  reason: "ok" | "unpaid" | "not-found"
  fileUrl: string | null
  fileName: string | null
  mimeType: string | null
}

const DENIED: DeliverableAccess = {
  canView: false, canDownload: false, chargeId: null,
  reason: "not-found", fileUrl: null, fileName: null, mimeType: null,
}

function monthOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** Faturas mensais congeladas: antes da passagem à cobrança vídeo a vídeo. */
const LEGACY_MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09"]

/**
 * Decide o que um utilizador pode fazer com um ficheiro entregue.
 *
 * O consultor só descarrega o ficheiro final depois de pagar a cobrança
 * desse vídeo (ou dessa intro). A pré-visualização fica sempre disponível
 * para ele ver o que está a pagar.
 *
 * - ADMIN e o videógrafo da marcação: acesso total.
 * - Marcações em comissão: não há cobrança, download livre.
 * - Ficheiros dos meses congelados (jun–set/2026): vale a fatura mensal
 *   antiga, que continua a ser paga pelo fluxo anterior.
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
  const allow = (chargeId: string | null = null): DeliverableAccess => ({
    ...base, canView: true, canDownload: true, chargeId, reason: "ok",
  })

  if (user.role === "ADMIN") return allow()
  if (user.role === "VIDEOGRAPHER") {
    return deliverable.booking?.videographerId === user.id ? allow() : DENIED
  }

  // Consultor: tem de estar ligado ao ficheiro
  const introConsultantIds = INTRO_CONSULTANT_FIELDS
    .map((f) => (deliverable as Record<string, unknown>)[f] as string | null)
    .filter(Boolean) as string[]
  const isIntroTarget = introConsultantIds.includes(user.id)
  const isBookingConsultant = deliverable.booking?.consultantId === user.id

  if (!isIntroTarget && !isBookingConsultant) return DENIED

  // Comissão: paga-se na venda, não há cobrança a desbloquear
  if (!isIntroTarget && deliverable.booking?.paymentType === "COMMISSION") return allow()

  // Cobrança deste ficheiro: a intro tem cobrança própria; o vídeo da
  // marcação é cobrado através da marcação
  const charge = isIntroTarget
    ? await prisma.charge.findFirst({
        where: { deliverableId: deliverable.id, consultantId: user.id },
        select: { id: true, status: true },
      })
    : await prisma.charge.findFirst({
        where: { bookingId: deliverable.booking!.id, consultantId: user.id, kind: "BOOKING" },
        select: { id: true, status: true },
      })

  if (charge) {
    return charge.status === "PAID"
      ? allow(charge.id)
      : { ...base, canView: true, canDownload: false, chargeId: charge.id, reason: "unpaid" }
  }

  // Sem cobrança: ficheiro dos meses congelados → vale a fatura mensal antiga
  const month = isIntroTarget
    ? monthOf(new Date(deliverable.createdAt))
    : monthOf(new Date(deliverable.booking!.scheduledAt))

  if (LEGACY_MONTHS.includes(month)) {
    const invoice = await prisma.monthlyInvoice.findFirst({
      where: { consultantId: user.id, month },
      select: { status: true },
    })
    return invoice?.status === "PAID"
      ? allow()
      : { ...base, canView: true, canDownload: false, chargeId: null, reason: "unpaid" }
  }

  // Fora dos meses congelados e sem cobrança emitida: nada a pagar ainda,
  // mas também nada que autorize o download
  return { ...base, canView: true, canDownload: false, chargeId: null, reason: "unpaid" }
}
