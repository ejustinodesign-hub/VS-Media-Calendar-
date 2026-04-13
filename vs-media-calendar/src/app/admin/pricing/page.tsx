import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PricingEditor } from "./pricing-editor"
import { SERVICE_LABELS, DEFAULT_PRICES, ADDITIONAL_INTRO_PRICE, TRAVEL_FEE_AMOUNT } from "@/lib/pricing"
import { formatPrice } from "@/lib/pricing"
import { Info } from "lucide-react"
import type { ServiceType } from "@prisma/client"

export default async function AdminPricingPage() {
  const pricingRules = await prisma.pricingRule.findMany({
    where: { active: true },
    include: { team: { select: { id: true, name: true, type: true } } },
  })

  const travelRule = await prisma.travelFeeRule.findFirst({ where: { active: true } })

  return (
    <>
      <Header title="Gestão de Preços" subtitle="Configuração das tabelas de preços por perfil" />
      <div className="flex-1 p-6 space-y-6 max-w-4xl">
        {/* Default pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Tabela de Preços — Equipa Interna</CardTitle>
            <CardDescription>Preços aplicados a consultores da equipa interna VS.Media</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-6">
              {(Object.entries(SERVICE_LABELS) as [ServiceType, string][]).map(([type, label]) => (
                <div key={type} className="flex items-center justify-between py-2.5 px-4 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">{formatPrice(DEFAULT_PRICES[type])}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between py-2.5 px-4 bg-slate-50 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Introdução Adicional</span>
                <span className="text-sm font-bold text-slate-900">{formatPrice(ADDITIONAL_INTRO_PRICE)}</span>
              </div>
            </div>

            <PricingEditor
              defaultPrices={DEFAULT_PRICES}
              additionalIntroPrice={ADDITIONAL_INTRO_PRICE}
            />
          </CardContent>
        </Card>

        {/* Travel Fee */}
        <Card>
          <CardHeader>
            <CardTitle>Taxa de Deslocação</CardTitle>
            <CardDescription>
              Regra para aplicação da taxa de deslocação além de {travelRule?.thresholdHours || 1}h de viagem
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Configuração Atual</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Origem: <strong>{travelRule?.originAddress || "Metropolitan Business Center, Odivelas"}</strong>
                  </p>
                  <p className="text-sm text-amber-700">
                    Limiar: <strong>{travelRule?.thresholdHours || 1} hora(s)</strong> de deslocação
                  </p>
                  <p className="text-sm text-amber-700">
                    Taxa adicional: <strong>{formatPrice(travelRule?.feeAmount || TRAVEL_FEE_AMOUNT)}</strong>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Future external teams */}
        <Card>
          <CardHeader>
            <CardTitle>Equipas Externas</CardTitle>
            <CardDescription>
              Configuração de preços diferenciados para equipas externas (em desenvolvimento)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-400">
              <p className="text-sm">
                Funcionalidade preparada para escalar. Configure equipas externas e tabelas de preços personalizadas quando necessário.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
