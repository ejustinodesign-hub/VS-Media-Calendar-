import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { AdminBookingForm } from "@/app/admin/bookings/new/admin-booking-form"
import { markOverdueInvoices } from "@/lib/invoices"
import { CHARGE_OVERDUE_DAYS } from "@/lib/charges"

// O videógrafo cria uma marcação para um consultor, atribuída a si próprio.
// Os videógrafos não veem preços: o formulário não os recebe nem os mostra.
export default async function VideographerNewBookingPage() {
  const session = await auth()
  // O admin tem o seu próprio formulário, onde escolhe o videógrafo
  if ((session?.user as { role?: string } | undefined)?.role === "ADMIN") redirect("/admin/bookings/new")

  await markOverdueInvoices()
  const chargeCutoff = new Date()
  chargeCutoff.setDate(chargeCutoff.getDate() - CHARGE_OVERDUE_DAYS)

  const [consultants, overdueInvoices, overdueCharges] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CONSULTANT", active: true, name: { not: null } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.monthlyInvoice.findMany({
      where: { status: "OVERDUE" },
      select: { consultantId: true },
      distinct: ["consultantId"],
    }),
    prisma.charge.findMany({
      where: { status: "PENDING", createdAt: { lt: chargeCutoff } },
      select: { consultantId: true },
      distinct: ["consultantId"],
    }),
  ])

  const overdueConsultantIds = [
    ...new Set([...overdueInvoices, ...overdueCharges].map((r) => r.consultantId)),
  ]

  return (
    <>
      <Header title="Nova Marcação" subtitle="Cria uma marcação para um consultor — fica atribuída a ti e já aceite" />
      <div className="flex-1 p-6">
        <AdminBookingForm
          consultants={consultants}
          allowCommission={false}
          endpoint="/api/videographer/bookings"
          redirectBase="/videographer/bookings"
          overdueConsultantIds={overdueConsultantIds}
          dateHint="Podes escolher uma data passada para registar um trabalho que já fizeste."
        />
      </div>
    </>
  )
}
