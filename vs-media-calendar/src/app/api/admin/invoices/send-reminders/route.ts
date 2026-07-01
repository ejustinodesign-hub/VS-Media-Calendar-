import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPaymentReminderEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { month, preview } = await req.json()
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 })

  const unpaid = await prisma.monthlyInvoice.findMany({
    where: { month, status: { in: ["PENDING", "OVERDUE"] } },
    include: { consultant: { select: { name: true, email: true } } },
  })

  if (unpaid.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 })
  }

  if (preview) {
    // Send one sample email to admin email only
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
    if (!adminEmail) return NextResponse.json({ error: "ADMIN_NOTIFICATION_EMAIL not set" }, { status: 500 })

    const sample = unpaid[0]
    await sendPaymentReminderEmail({
      consultantName: sample.consultant.name || sample.consultant.email || "Consultor",
      consultantEmail: adminEmail,
      month: sample.month,
      total: sample.total,
      dueDate: sample.dueDate,
      invoiceId: sample.id,
    })
    return NextResponse.json({ preview: true, sentTo: adminEmail, sample: sample.consultant.name })
  }

  // Send to all unpaid consultants
  let sent = 0
  let skipped = 0
  for (const invoice of unpaid) {
    const email = invoice.consultant.email
    if (!email) { skipped++; continue }
    try {
      await sendPaymentReminderEmail({
        consultantName: invoice.consultant.name || email,
        consultantEmail: email,
        month: invoice.month,
        total: invoice.total,
        dueDate: invoice.dueDate,
        invoiceId: invoice.id,
      })
      sent++
    } catch (e) {
      console.error(`[reminders] failed for ${email}:`, e)
      skipped++
    }
  }

  return NextResponse.json({ sent, skipped })
}
