import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { NewBookingForm } from "./new-booking-form"
import { DEFAULT_PRICES } from "@/lib/pricing"
import { AlertCircle, Percent, CreditCard } from "lucide-react"
import Link from "next/link"
import type { ServiceType } from "@prisma/client"

interface Props {
  searchParams: Promise<{ mode?: string }>
}

export default async function NewBookingPage({ searchParams }: Props) {
  const { mode } = await searchParams
  const forceCommission = mode === "commission"

  const session = await auth()
  const user = session?.user as any
  const consultantId = user?.id

  const unpaidInvoice = consultantId
    ? await prisma.monthlyInvoice.findFirst({
        where: { consultantId, status: { in: ["PENDING", "OVERDUE"] } },
        select: { id: true },
      })
    : null

  // Block if unpaid invoice AND not opting into commission mode
  if (unpaidInvoice && !forceCommission) {
    return (
      <>
        <Header title="Nova Marcação" subtitle="Agende um novo serviço de vídeo ou fotografia" />
        <div className="flex-1 p-6 flex items-start justify-center">
          <div className="max-w-md w-full space-y-3 mt-8">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Tem faturas por pagar</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Para criar novas marcações em taxa fixa, regularize primeiro os pagamentos pendentes.
                </p>
              </div>
              <Link
                href="/consultant/payments"
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#0f3460] text-white text-sm font-semibold rounded-xl hover:bg-[#1a4a7a] transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Regularizar pagamento
              </Link>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto">
                <Percent className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Alternativa: Modo Comissão</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Continue a marcar vídeos sem pagamento imediato. Paga apenas 0,15% do valor de venda do imóvel, quando vender.
                </p>
              </div>
              <Link
                href="/consultant/bookings/new?mode=commission"
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
              >
                <Percent className="w-4 h-4" />
                Criar marcação em modo comissão
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  const [videographers, dbRules] = await Promise.all([
    prisma.user.findMany({
      where: { role: "VIDEOGRAPHER", active: true },
      select: {
        id: true,
        name: true,
        image: true,
        videographerProfile: {
          select: { displayName: true, bio: true, weeklyCapacity: true, acceptingWork: true },
        },
      },
    }),
    prisma.pricingRule.findMany({
      where: { active: true, teamId: null },
      select: { serviceType: true, basePrice: true },
    }),
  ])

  // DB prices override DEFAULT_PRICES — admin can change via back office
  const activePrices = { ...DEFAULT_PRICES } as Record<ServiceType, number>
  for (const rule of dbRules) {
    activePrices[rule.serviceType as ServiceType] = rule.basePrice
  }

  return (
    <>
      <Header title="Nova Marcação" subtitle="Agende um novo serviço de vídeo ou fotografia" />
      <div className="flex-1 p-6">
        {forceCommission && unpaidInvoice && (
          <div className="max-w-3xl mb-4 flex items-start gap-3 p-3 bg-violet-50 border border-violet-200 rounded-xl">
            <Percent className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-violet-800">
              <span className="font-semibold">Modo comissão activo.</span> Esta marcação não será incluída na fatura mensal — paga apenas 0,15% do valor de venda quando o imóvel for vendido.
            </p>
          </div>
        )}
        <NewBookingForm
          videographers={videographers}
          consultantId={user?.id || ""}
          consultantTeamType={user?.teamType || "INTERNAL"}
          activePrices={activePrices}
          forceCommission={forceCommission}
        />
      </div>
    </>
  )
}
