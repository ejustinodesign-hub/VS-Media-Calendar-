"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import {
  ArrowLeft, ArrowRight, CheckCircle2, User, Calendar,
  MapPin, FileVideo, CreditCard, Check, AlertCircle,
} from "lucide-react"

const PROPERTY_TYPES = [
  { id: "T0", label: "T0", sub: "Studio" },
  { id: "T1", label: "T1", sub: "1 quarto" },
  { id: "T2", label: "T2", sub: "2 quartos" },
  { id: "T3", label: "T3", sub: "3 quartos" },
  { id: "T4", label: "T4", sub: "4 quartos" },
  { id: "T5_PLUS", label: "T5+", sub: "5+ quartos" },
]

const VIDEO_SERVICE_IDS = ["VIDEO_STANDARD", "VIDEO_DRONE"]

const VIDEOGRAPHERS = [
  { id: "v1", name: "Eduardo Justino", upcoming: 2, rating: "5.0" },
  { id: "v2", name: "Tomás Almeida", upcoming: 3, rating: "4.9" },
  { id: "v3", name: "Bernardo Pavão", upcoming: 1, rating: "4.8" },
]

const SERVICES = [
  { id: "VIDEO_STANDARD", label: "Vídeo Standard", price: 50, description: "Vídeo profissional interior, até 3 min" },
  { id: "VIDEO_DRONE", label: "Vídeo Standard + Drone", price: 60, description: "Vídeo com cobertura aérea exterior" },
  { id: "PHOTO_T1_T2", label: "Fotografia T1/T2", price: 25, description: "Pack fotográfico tipologia pequena" },
  { id: "PHOTO_T3_T4", label: "Fotografia T3/T4", price: 35, description: "Pack fotográfico tipologia média" },
  { id: "PHOTO_T5_PLUS", label: "Fotografia T5+", price: 45, description: "Pack fotográfico tipologia grande" },
  { id: "PHOTO_DRONE", label: "Fotografia Drone", price: 35, description: "Fotografia aérea exterior" },
]

const TIME_SLOTS = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30"]

const BOOKED_SLOTS = ["09:00", "12:30"]

const STEPS = [
  { label: "Videógrafo", icon: User },
  { label: "Serviços", icon: FileVideo },
  { label: "Data & Hora", icon: Calendar },
  { label: "Propriedade", icon: MapPin },
  { label: "Pagamento", icon: CreditCard },
]

export default function DemoNewBookingPage() {
  const [step, setStep] = useState(0)
  const [selectedVideographer, setSelectedVideographer] = useState("")
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedTime, setSelectedTime] = useState("")
  const [address, setAddress] = useState("")
  const [propertyType, setPropertyType] = useState("")
  const [notes, setNotes] = useState("")
  const [done, setDone] = useState(false)

  const hasVideoService = selectedServices.some((id) => VIDEO_SERVICE_IDS.includes(id))

  const total = selectedServices.reduce((sum, id) => {
    const s = SERVICES.find((s) => s.id === id)
    return sum + (s?.price || 0)
  }, 0)

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  if (done) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Marcação Submetida!</h2>
          <p className="text-slate-500 mb-2">
            Em produção, seria redirecionado para o Stripe para pagamento seguro.
          </p>
          <p className="text-sm text-slate-400 bg-slate-100 rounded-lg p-3 mb-6">
            Fluxo real: Stripe Checkout → Webhook confirma pagamento → Videógrafo recebe notificação → Aceita/Recusa
          </p>
          <Link
            href="/demo/consultant/bookings"
            className="inline-flex items-center gap-2 bg-[#0f3460] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1a4a7a] transition-colors"
          >
            Ver Marcações
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center gap-4 px-6 flex-shrink-0">
        <Link href="/demo/consultant/bookings" className="text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Nova Marcação</h2>
          <p className="text-sm text-slate-500">Passo {step + 1} de {STEPS.length}</p>
        </div>
      </header>

      <div className="flex-1 p-6 max-w-2xl">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isActive = i === step
            const isDone = i < step
            return (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isDone ? "bg-emerald-100 text-emerald-700" :
                  isActive ? "bg-[#0f3460] text-white" : "bg-slate-100 text-slate-400"
                }`}>
                  {isDone ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="w-4 h-px bg-slate-200" />}
              </div>
            )
          })}
        </div>

        {/* Step 0: Videographer */}
        {step === 0 && (
          <Card>
            <CardHeader><CardTitle>Escolher Videógrafo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {VIDEOGRAPHERS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVideographer(v.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    selectedVideographer === v.id
                      ? "border-[#0f3460] bg-[#0f3460]/5"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-lg flex-shrink-0">
                    {v.name[0]}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-slate-900">{v.name}</p>
                    <p className="text-xs text-slate-500">{v.upcoming} marcações esta semana · ⭐ {v.rating}</p>
                  </div>
                  {selectedVideographer === v.id && (
                    <CheckCircle2 className="w-5 h-5 text-[#0f3460]" />
                  )}
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 1: Services */}
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Selecionar Serviços</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {SERVICES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleService(s.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    selectedServices.includes(s.id)
                      ? "border-[#0f3460] bg-[#0f3460]/5"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-slate-900">{s.label}</p>
                    <p className="text-xs text-slate-500">{s.description}</p>
                  </div>
                  <span className="font-bold text-slate-900">{s.price} €</span>
                  {selectedServices.includes(s.id) && (
                    <CheckCircle2 className="w-5 h-5 text-[#0f3460]" />
                  )}
                </button>
              ))}
              {selectedServices.length > 0 && (
                <div className="flex justify-between pt-3 border-t border-slate-200">
                  <span className="font-bold text-slate-900">Total</span>
                  <span className="font-bold text-lg text-slate-900">{total} €</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Data e Hora</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Data</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3460]/30"
                />
              </div>
              {selectedDate && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Horário disponível</label>
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_SLOTS.map((t) => {
                      const isBooked = BOOKED_SLOTS.includes(t)
                      return (
                        <button
                          key={t}
                          disabled={isBooked}
                          onClick={() => setSelectedTime(t)}
                          className={`py-2 rounded-lg text-sm font-medium transition-all ${
                            isBooked ? "bg-slate-100 text-slate-300 cursor-not-allowed" :
                            selectedTime === t ? "bg-[#0f3460] text-white" :
                            "bg-slate-50 border border-slate-200 text-slate-700 hover:border-[#0f3460]"
                          }`}
                        >
                          {t}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Cinzento = ocupado</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Property */}
        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Imóvel</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {/* Property type — required for video */}
              {hasVideoService && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    Tipologia do Imóvel
                    <span className="text-red-500 ml-1">*</span>
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {PROPERTY_TYPES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPropertyType(t.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                          propertyType === t.id
                            ? "border-[#0f3460] bg-[#0f3460]/5"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className={`text-base font-bold ${propertyType === t.id ? "text-[#0f3460]" : "text-slate-800"}`}>
                          {t.label}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">{t.sub}</span>
                      </button>
                    ))}
                  </div>
                  {!propertyType && (
                    <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Obrigatório para serviços de vídeo
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Morada completa</label>
                <input
                  type="text"
                  placeholder="Rua, número, andar, código-postal, cidade"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3460]/30"
                />
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  Em produção, calculamos automaticamente se há taxa de deslocação (+50 €)
                  com base na distância do centro de Odivelas via Google Maps.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Notas (opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Instruções de acesso, porteiro, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3460]/30 resize-none"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Summary & Payment */}
        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>Resumo e Pagamento</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Videógrafo</span>
                  <span className="font-medium text-slate-900">
                    {VIDEOGRAPHERS.find((v) => v.id === selectedVideographer)?.name || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Data</span>
                  <span className="font-medium text-slate-900">
                    {selectedDate ? new Date(selectedDate).toLocaleDateString("pt-PT") : "—"} às {selectedTime || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Propriedade</span>
                  <span className="font-medium text-slate-900 text-right max-w-xs truncate">{address || "—"}</span>
                </div>
                {propertyType && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tipologia</span>
                    <span className="font-medium text-slate-900">{propertyType === "T5_PLUS" ? "T5+" : propertyType}</span>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-2 mt-2">
                  {selectedServices.map((id) => {
                    const s = SERVICES.find((s) => s.id === id)!
                    return (
                      <div key={id} className="flex justify-between py-1">
                        <span className="text-slate-600">{s.label}</span>
                        <span className="text-slate-900">{s.price} €</span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-base">
                  <span>Total</span>
                  <span>{total} €</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700 font-medium">
                  Em produção: ao clicar em "Pagar", seria redirecionado para o Stripe Checkout
                  para pagamento seguro por cartão.
                </p>
              </div>

              <button
                onClick={() => setDone(true)}
                className="w-full bg-[#e94560] text-white py-3 rounded-lg font-bold text-sm hover:bg-[#d63050] transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Simular Pagamento (Demo)
              </button>
            </CardContent>
          </Card>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors ${step === 0 ? "invisible" : ""}`}
          >
            <ArrowLeft className="w-4 h-4" />
            Anterior
          </button>
          {step < 4 && (
            <button
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              disabled={
                (step === 0 && !selectedVideographer) ||
                (step === 1 && selectedServices.length === 0) ||
                (step === 2 && (!selectedDate || !selectedTime)) ||
                (step === 3 && (!address || (hasVideoService && !propertyType)))
              }
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0f3460] text-white text-sm font-semibold hover:bg-[#1a4a7a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Próximo
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </>
  )
}
