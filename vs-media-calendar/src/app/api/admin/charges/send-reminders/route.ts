import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPendingChargesEmail } from "@/lib/email"
import { CHARGE_OVERDUE_DAYS } from "@/lib/charges"

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// POST: lembrete das cobranças por pagar (vídeo a vídeo) — um email por
// consultor com todos os vídeos/intros em falta e o total.
// `preview: true` envia só um exemplo para o email do admin.
export async function POST(req: NextRequest) {
  const session = await auth()
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { preview } = await req.json().catch(() => ({ preview: false }))

  const pending = await prisma.charge.findMany({
    where: { status: "PENDING" },
    include: { consultant: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - CHARGE_OVERDUE_DAYS)

  const byConsultant = new Map<string, {
    name: string
    email: string | null
    charges: { description: string; totalAmount: number; createdAt: Date; overdue: boolean }[]
    total: number
  }>()
  for (const c of pending) {
    const entry = byConsultant.get(c.consultantId) ?? {
      name: c.consultant.name || c.consultant.email || "Consultor",
      email: c.consultant.email,
      charges: [],
      total: 0,
    }
    entry.charges.push({
      description: c.description,
      totalAmount: c.totalAmount,
      createdAt: c.createdAt,
      overdue: c.createdAt < cutoff,
    })
    entry.total = round2(entry.total + c.totalAmount)
    byConsultant.set(c.consultantId, entry)
  }

  const debtors = [...byConsultant.values()].sort((a, b) => b.total - a.total)
  if (debtors.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, consultants: 0 })
  }

  if (preview) {
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
    if (!adminEmail) {
      return NextResponse.json({ error: "ADMIN_NOTIFICATION_EMAIL não está configurado." }, { status: 500 })
    }
    const sample = debtors[0]
    const result = await sendPendingChargesEmail({
      consultantName: sample.name,
      consultantEmail: adminEmail,
      charges: sample.charges,
      total: sample.total,
      overdueDays: CHARGE_OVERDUE_DAYS,
    })
    if (result?.error) {
      return NextResponse.json({ error: result.error.message }, { status: 502 })
    }
    return NextResponse.json({ preview: true, sentTo: adminEmail, sample: sample.name, consultants: debtors.length })
  }

  let sent = 0
  let skipped = 0
  const noEmail: string[] = []
  const failed: string[] = []

  for (const d of debtors) {
    if (!d.email) { skipped++; noEmail.push(d.name); continue }
    try {
      // O Resend aceita no máximo 10 pedidos por segundo — espaçar os envios
      await new Promise((r) => setTimeout(r, 250))
      const result = await sendPendingChargesEmail({
        consultantName: d.name,
        consultantEmail: d.email,
        charges: d.charges,
        total: d.total,
        overdueDays: CHARGE_OVERDUE_DAYS,
      })
      if (result?.error) {
        console.error(`[charge-reminders] falhou para ${d.email}:`, result.error)
        skipped++
        failed.push(d.name)
        continue
      }
      sent++
    } catch (e) {
      console.error(`[charge-reminders] falhou para ${d.email}:`, e)
      skipped++
      failed.push(d.name)
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    noEmail,
    failed,
    consultants: debtors.length,
    totalDebt: round2(debtors.reduce((s, d) => s + d.total, 0)),
  })
}
