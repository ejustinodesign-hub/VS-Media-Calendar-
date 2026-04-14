"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DEMO_PRICING } from "@/lib/demo-data"
import { DollarSign, Save, CheckCircle2 } from "lucide-react"

export default function DemoAdminPricingPage() {
  const [prices, setPrices] = useState(DEMO_PRICING.map((p) => ({ ...p })))
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Gestão de Preços</h2>
          <p className="text-sm text-slate-500">Tabela de preços da equipa interna VS.Media</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-[#0f3460] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a4a7a] transition-colors"
        >
          {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Guardado!" : "Guardar Alterações"}
        </button>
      </header>

      <div className="flex-1 p-6 space-y-5 max-w-2xl">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            Os preços aqui definidos são usados no cálculo automático ao criar marcações.
            Alterações afetam apenas marcações futuras.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Tabela de Preços — Equipa Interna
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {prices.map((item, index) => (
              <div key={item.service} className="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm">{item.service}</p>
                  <p className="text-xs text-slate-500">{item.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      value={item.price}
                      min={0}
                      max={999}
                      onChange={(e) => {
                        const updated = [...prices]
                        updated[index] = { ...item, price: Number(e.target.value) }
                        setPrices(updated)
                        setSaved(false)
                      }}
                      className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f3460]/30"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">€</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-slate-50">
          <CardContent className="py-4">
            <p className="text-xs text-slate-500 font-medium mb-2">Regras da plataforma</p>
            <ul className="space-y-1 text-xs text-slate-500">
              <li>• Duração padrão por marcação: <strong className="text-slate-700">1h30</strong></li>
              <li>• Horário disponível: <strong className="text-slate-700">08:00 – 17:00</strong></li>
              <li>• Slots de 30 minutos</li>
              <li>• Taxa de deslocação automática se distância &gt;1h de Odivelas</li>
              <li>• Pagamento obrigatório via Stripe antes de confirmar</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
