import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { IVA_RATE, SERVICE_LABELS, ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"
import { createMoloniInvoice } from "@/lib/moloni"
import type { ServiceType } from "@prisma/client"

export async function POST(req: Request) {
  const session = await auth()
  const userRole = (session?.user as any)?.role
  if (!session?.user || userRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  // Allow overriding the target month, default to previous month
  const targetMonth: string | undefined = body.month

  const now = new Date()
  let month: string
  let monthStart: Date
  let monthEnd: Date

  if (targetMonth && /^\d{4}-\d{2}$/.test(targetMonth)) {
    const [y, m] = targetMonth.split("-").map(Number)
    month = targetMonth
    monthStart = new Date(y, m - 1, 1)
    monthEnd = new Date(y, m, 0, 23, 59, 59)
  } else {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`
    monthStart = new Date(prev.getFullYear(), prev.getMonth(), 1)
    monthEnd = new Date(prev.getFullYear(), prev.getMonth() + 1, 0, 23, 59, 59)
  }

  const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const bookings = await prisma.booking.findMany({
    where: {
      paymentType: "FLAT_FEE",
      status: { in: ["ACCEPTED", "IN_PROGRESS", "FILE_DELIVERED", "COMPLETED"] },
      scheduledAt: { gte: monthStart, lte: monthEnd },
      invoiceId: null,
    },
    include: { services: true },
  })

  const byConsultant = new Map<string, typeof bookings>()
  for (const booking of bookings) {
    const existing = byConsultant.get(booking.consultantId) ?? []
    existing.push(booking)
    byConsultant.set(booking.consultantId, existing)
  }

  const results: Array<{
    consultantId: string
    consultantName: string | null
    invoiceId: string
    total: number
    moloniDocumentId: number | null
    moloniError: string | null
  }> = []

  for (const [consultantId, consultantBookings] of byConsultant) {
    const existing = await prisma.monthlyInvoice.findFirst({
      where: { consultantId, month },
    })
    if (existing) {
      results.push({
        consultantId,
        consultantName: null,
        invoiceId: existing.id,
        total: existing.total,
        moloniDocumentId: existing.moloniDocumentId ?? null,
        moloniError: "Fatura já existia para este mês",
      })
      continue
    }

    const consultant = await prisma.user.findUnique({
      where: { id: consultantId },
      select: { name: true, email: true, billingNif: true, billingName: true, billingAddress: true },
    })

    const subtotal = consultantBookings.reduce((sum, b) => {
      const servicesTotal = b.services.reduce((s, svc) => s + svc.price, 0)
      const introsTotal = b.additionalIntros * ADDITIONAL_INTRO_PRICE
      const travelTotal = b.hasTravelFee ? b.travelFeeAmount : 0
      return sum + servicesTotal + introsTotal + travelTotal
    }, 0)

    const total = Math.round(subtotal * (1 + IVA_RATE) * 100) / 100

    const invoice = await prisma.monthlyInvoice.create({
      data: { consultantId, month, subtotal, total, dueDate, status: "PENDING" },
    })

    await prisma.booking.updateMany({
      where: { id: { in: consultantBookings.map((b) => b.id) } },
      data: { invoiceId: invoice.id },
    })

    let moloniDocumentId: number | null = null
    let moloniError: string | null = null

    if (process.env.MOLONI_CLIENT_ID && consultant) {
      try {
        const lines = consultantBookings.flatMap((b) => {
          const items = b.services.map((svc) => ({
            description: `${SERVICE_LABELS[svc.serviceType as ServiceType]} — ${b.propertyAddress}`,
            qty: 1,
            unitPrice: svc.price,
          }))
          if (b.additionalIntros > 0) {
            items.push({
              description: `Introduções adicionais (${b.additionalIntros}×) — ${b.propertyAddress}`,
              qty: b.additionalIntros,
              unitPrice: ADDITIONAL_INTRO_PRICE,
            })
          }
          if (b.hasTravelFee && b.travelFeeAmount > 0) {
            items.push({
              description: `Taxa de deslocação — ${b.propertyAddress}`,
              qty: 1,
              unitPrice: b.travelFeeAmount,
            })
          }
          return items
        })

        moloniDocumentId = await createMoloniInvoice({ consultant, month, dueDate, lines })
        await prisma.monthlyInvoice.update({
          where: { id: invoice.id },
          data: { moloniDocumentId },
        })
      } catch (e) {
        moloniError = e instanceof Error ? e.message : String(e)
        console.error(`[Moloni] Failed for ${consultantId}:`, moloniError)
      }
    }

    results.push({
      consultantId,
      consultantName: consultant?.name ?? null,
      invoiceId: invoice.id,
      total,
      moloniDocumentId,
      moloniError,
    })
  }

  return NextResponse.json({
    month,
    processedConsultants: results.length,
    results,
  })
}
