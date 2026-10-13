import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendOutstandingBalanceEmail } from "@/lib/email"
import { markOverdueInvoices } from "@/lib/invoices"

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// POST: lembrete de dívida acumulada — um email por consultor com TODAS as
// faturas por pagar (de todos os meses) e o total. `preview: true` envia
// apenas um exemplo para o email do admin.
export async function POST(req: NextRequest) {
  const session = await auth()
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { preview } = await req.json().catch(() => ({ preview: false }))

  // Garantir que o estado em atraso está atualizado antes de contar
  await markOverdueInvoices()

  const unpaid = await prisma.monthlyInvoice.findMany({
    where: { status: { in: ["PENDING", "OVERDUE"] }, total: { gt: 0 } },
    include: { consultant: { select: { id: true, name: true, email: true } } },
    orderBy: { month: "asc" },
  })

  // Agrupar por consultor
  const byConsultant = new Map<string, {
    name: string
    email: string | null
    invoices: { id: string; month: string; total: number; dueDate: Date; overdue: boolean }[]
    total: number
  }>()

  for (const inv of unpaid) {
    const entry = byConsultant.get(inv.consultantId) ?? {
      name: inv.consultant.name || inv.consultant.email || "Consultor",
      email: inv.consultant.email,
      invoices: [],
      total: 0,
    }
    entry.invoices.push({
      id: inv.id,
      month: inv.month,
      total: inv.total,
      dueDate: inv.dueDate,
      overdue: inv.status === "OVERDUE",
    })
    entry.total = round2(entry.total + inv.total)
    byConsultant.set(inv.consultantId, entry)
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
    await sendOutstandingBalanceEmail({
      consultantName: sample.name,
      consultantEmail: adminEmail,
      invoices: sample.invoices,
      total: sample.total,
    })
    return NextResponse.json({
      preview: true,
      sentTo: adminEmail,
      sample: sample.name,
      consultants: debtors.length,
    })
  }

  let sent = 0
  let skipped = 0
  const noEmail: string[] = []

  for (const d of debtors) {
    if (!d.email) { skipped++; noEmail.push(d.name); continue }
    try {
      await sendOutstandingBalanceEmail({
        consultantName: d.name,
        consultantEmail: d.email,
        invoices: d.invoices,
        total: d.total,
      })
      sent++
    } catch (e) {
      console.error(`[outstanding-reminders] falhou para ${d.email}:`, e)
      skipped++
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    noEmail,
    consultants: debtors.length,
    totalDebt: round2(debtors.reduce((s, d) => s + d.total, 0)),
  })
}
