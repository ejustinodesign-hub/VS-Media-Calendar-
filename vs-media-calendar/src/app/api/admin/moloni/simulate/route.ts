import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { IVA_RATE, SERVICE_LABELS, ADDITIONAL_INTRO_PRICE } from "@/lib/pricing"
import { createMoloniInvoice } from "@/lib/moloni"
import type { ServiceType } from "@prisma/client"

// Simulated bookings for vsbrothers.pt@gmail.com
const FAKE_BOOKINGS = [
  {
    address: "Rua Augusta 45, Lisboa",
    services: [{ type: "VIDEO_STANDARD" as ServiceType, price: 150 }],
    additionalIntros: 2,
    hasTravelFee: false,
  },
  {
    address: "Av. da Liberdade 200, Lisboa",
    services: [
      { type: "VIDEO_DRONE" as ServiceType, price: 200 },
      { type: "PHOTO_T3_T4" as ServiceType, price: 75 },
    ],
    additionalIntros: 0,
    hasTravelFee: true,
    travelFeeAmount: 50,
  },
  {
    address: "Rua do Carmo 12, Sintra",
    services: [{ type: "PHOTO_T1_T2" as ServiceType, price: 50 }],
    additionalIntros: 1,
    hasTravelFee: true,
    travelFeeAmount: 50,
  },
]

function getPrevMonth() {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`
}

export async function POST(req: Request) {
  const session = await auth()
  const userRole = (session?.user as any)?.role
  if (!session?.user || userRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const cleanup = body.cleanup === true   // pass { cleanup: true } to delete test data
  const month = getPrevMonth()

  const consultant = await prisma.user.findFirst({
    where: { email: "vsbrothers.pt@gmail.com" },
    select: { id: true, name: true, email: true, billingNif: true, billingName: true, billingAddress: true },
  })
  if (!consultant) {
    return NextResponse.json({ ok: false, error: "Utilizador vsbrothers.pt@gmail.com não encontrado" }, { status: 404 })
  }

  // Need any other user to fill videographerId (required FK)
  const videographer = await prisma.user.findFirst({
    where: { id: { not: consultant.id } },
    select: { id: true },
  })
  if (!videographer) {
    return NextResponse.json({ ok: false, error: "Nenhum outro utilizador encontrado para videographerId" }, { status: 404 })
  }

  if (cleanup) {
    // Delete test bookings and invoice for this month
    const existing = await prisma.monthlyInvoice.findFirst({
      where: { consultantId: consultant.id, month },
    })
    if (existing) {
      await prisma.booking.updateMany({
        where: { invoiceId: existing.id },
        data: { invoiceId: null },
      })
      await prisma.monthlyInvoice.delete({ where: { id: existing.id } })
    }
    await prisma.booking.deleteMany({
      where: {
        consultantId: consultant.id,
        notes: "SIMULATE_TEST",
        paymentType: "FLAT_FEE",
      },
    })
    return NextResponse.json({ ok: true, action: "cleanup", month })
  }

  // Delete any existing invoice for this month (idempotent)
  const existingInvoice = await prisma.monthlyInvoice.findFirst({
    where: { consultantId: consultant.id, month },
  })
  if (existingInvoice) {
    await prisma.booking.updateMany({ where: { invoiceId: existingInvoice.id }, data: { invoiceId: null } })
    await prisma.monthlyInvoice.delete({ where: { id: existingInvoice.id } })
  }
  // Delete any leftover test bookings
  await prisma.booking.deleteMany({
    where: { consultantId: consultant.id, notes: "SIMULATE_TEST", paymentType: "FLAT_FEE" },
  })

  // Create fake bookings in the previous month
  const [y, m] = month.split("-").map(Number)
  const createdBookings = []
  for (let i = 0; i < FAKE_BOOKINGS.length; i++) {
    const fb = FAKE_BOOKINGS[i]
    const scheduledAt = new Date(y, m - 1, 5 + i * 7) // 5th, 12th, 19th of prev month
    const booking = await prisma.booking.create({
      data: {
        consultantId: consultant.id,
        videographerId: videographer.id,
        status: "COMPLETED",
        paymentType: "FLAT_FEE",
        scheduledAt,
        propertyAddress: fb.address,
        additionalIntros: fb.additionalIntros,
        hasTravelFee: fb.hasTravelFee ?? false,
        travelFeeAmount: fb.travelFeeAmount ?? 0,
        notes: "SIMULATE_TEST",
        services: {
          create: fb.services.map((s) => ({ serviceType: s.type, price: s.price })),
        },
      },
      include: { services: true },
    })
    createdBookings.push(booking)
  }

  // Calculate totals (same logic as run-invoices)
  const subtotal = createdBookings.reduce((sum, b) => {
    const servicesTotal = b.services.reduce((s, svc) => s + svc.price, 0)
    const introsTotal = b.additionalIntros * ADDITIONAL_INTRO_PRICE
    const travelTotal = b.hasTravelFee ? b.travelFeeAmount : 0
    return sum + servicesTotal + introsTotal + travelTotal
  }, 0)
  const total = Math.round(subtotal * (1 + IVA_RATE) * 100) / 100
  const dueDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59)

  const invoice = await prisma.monthlyInvoice.create({
    data: { consultantId: consultant.id, month, subtotal, total, dueDate, status: "PENDING" },
  })
  await prisma.booking.updateMany({
    where: { id: { in: createdBookings.map((b) => b.id) } },
    data: { invoiceId: invoice.id },
  })

  // Build invoice lines
  const lines = createdBookings.flatMap((b) => {
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

  // Emit Moloni invoice
  let moloniDocumentId: number | null = null
  let moloniError: string | null = null
  try {
    moloniDocumentId = await createMoloniInvoice({ consultant, month, dueDate, lines })
    await prisma.monthlyInvoice.update({
      where: { id: invoice.id },
      data: { moloniDocumentId },
    })
  } catch (e) {
    moloniError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({
    ok: moloniError === null,
    month,
    consultant: consultant.name,
    nif: consultant.billingNif || "999999990 (sem NIF configurado)",
    invoiceId: invoice.id,
    subtotal,
    total,
    lines,
    moloniDocumentId,
    moloniError,
    bookingsCreated: createdBookings.length,
    note: "Para limpar os dados de teste: POST { cleanup: true }",
  })
}
