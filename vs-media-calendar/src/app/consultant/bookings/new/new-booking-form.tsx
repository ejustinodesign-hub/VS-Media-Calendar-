"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  SERVICE_LABELS,
  VIDEO_SERVICES,
  PHOTO_SERVICES,
  ADDITIONAL_INTRO_PRICE,
  TRAVEL_FEE_AMOUNT,
  calculateTotal,
  formatPrice,
} from "@/lib/pricing"
import type { ServiceType, TeamType } from "@prisma/client"
import {
  Video,
  Camera,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  User,
  Calendar,
  Info,
  Plus,
  Minus,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Videographer {
  id: string
  name: string | null
  image: string | null
  videographerProfile: {
    displayName: string
    bio: string | null
    weeklyCapacity: number
    acceptingWork: boolean
  } | null
}

interface TimeSlot {
  time: string
  available: boolean
  datetime: string
}

interface Props {
  videographers: Videographer[]
  consultantId: string
  consultantTeamType: TeamType
}

const STEPS = [
  { id: 1, label: "Videógrafo" },
  { id: 2, label: "Serviços" },
  { id: 3, label: "Data & Hora" },
  { id: 4, label: "Imóvel" },
  { id: 5, label: "Resumo" },
]

export function NewBookingForm({ videographers, consultantId, consultantTeamType }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)

  // Form state
  const [selectedVideographerId, setSelectedVideographerId] = useState("")
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>([])
  const [additionalIntros, setAdditionalIntros] = useState(0)
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [propertyAddress, setPropertyAddress] = useState("")
  const [propertyType, setPropertyType] = useState("")
  const [notes, setNotes] = useState("")

  // Travel / pricing state
  const [travelEstimate, setTravelEstimate] = useState<{
    durationText: string
    hasTravelFee: boolean
  } | null>(null)
  const [travelLoading, setTravelLoading] = useState(false)

  // Time slots
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const selectedVideographer = videographers.find((v) => v.id === selectedVideographerId)

  // Fetch time slots when date or videographer changes
  useEffect(() => {
    if (!selectedDate || !selectedVideographerId) return
    setSlotsLoading(true)
    setSelectedSlot(null)
    fetch(
      `/api/availability?videographerId=${selectedVideographerId}&date=${selectedDate}`
    )
      .then((r) => r.json())
      .then((data) => setTimeSlots(data.slots || []))
      .catch(() => setTimeSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [selectedDate, selectedVideographerId])

  // Fetch travel estimate when address changes
  useEffect(() => {
    if (!propertyAddress || propertyAddress.length < 5) return
    const timer = setTimeout(() => {
      setTravelLoading(true)
      fetch(`/api/travel?address=${encodeURIComponent(propertyAddress)}`)
        .then((r) => r.json())
        .then((data) => setTravelEstimate(data))
        .catch(() => setTravelEstimate(null))
        .finally(() => setTravelLoading(false))
    }, 800)
    return () => clearTimeout(timer)
  }, [propertyAddress])

  const toggleService = (service: ServiceType) => {
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    )
  }

  const pricing =
    selectedServices.length > 0
      ? calculateTotal(
          selectedServices,
          additionalIntros,
          travelEstimate?.hasTravelFee || false,
          consultantTeamType
        )
      : null

  const hasVideoService = selectedServices.some((s) => VIDEO_SERVICES.includes(s))

  const canProceed = () => {
    if (step === 1) return !!selectedVideographerId
    if (step === 2) return selectedServices.length > 0
    if (step === 3) return !!selectedDate && !!selectedSlot
    if (step === 4) return propertyAddress.length >= 5 && (!hasVideoService || !!propertyType)
    return true
  }

  const handleSubmit = async () => {
    if (!selectedSlot || !pricing) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videographerId: selectedVideographerId,
          scheduledAt: selectedSlot.datetime,
          services: selectedServices,
          additionalIntros,
          propertyAddress,
          hasTravelFee: travelEstimate?.hasTravelFee || false,
          travelFeeAmount: travelEstimate?.hasTravelFee ? TRAVEL_FEE_AMOUNT : 0,
          propertyType: propertyType || undefined,
          notes,
          totalAmount: pricing.total,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao criar marcação")

      // Redirect to Stripe checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        router.push(`/consultant/bookings/${data.bookingId}`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
      setSubmitting(false)
    }
  }

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split("T")[0]

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 transition-all",
                step === s.id
                  ? "border-[#0f3460] bg-[#0f3460] text-white"
                  : step > s.id
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-200 bg-white text-slate-400"
              )}
            >
              {step > s.id ? <CheckCircle2 className="w-4 h-4" /> : s.id}
            </div>
            <span
              className={cn(
                "ml-2 text-sm font-medium hidden sm:block",
                step === s.id ? "text-[#0f3460]" : step > s.id ? "text-emerald-600" : "text-slate-400"
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn("flex-1 h-0.5 mx-3", step > s.id ? "bg-emerald-200" : "bg-slate-100")} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Choose Videographer */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Escolher Videógrafo</CardTitle>
            <CardDescription>Selecione o videógrafo para este serviço</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {videographers.map((v) => {
                const profile = v.videographerProfile
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVideographerId(v.id)}
                    disabled={profile?.acceptingWork === false}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                      selectedVideographerId === v.id
                        ? "border-[#0f3460] bg-[#0f3460]/5"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                      profile?.acceptingWork === false && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex-shrink-0">
                      {v.image ? (
                        <img
                          src={v.image}
                          alt={v.name || ""}
                          className="w-14 h-14 rounded-full border-2 border-white shadow"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-[#0f3460] flex items-center justify-center text-white text-xl font-bold">
                          {v.name?.[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">
                        {profile?.displayName || v.name}
                      </p>
                      {profile?.bio && (
                        <p className="text-sm text-slate-500 mt-0.5">{profile.bio}</p>
                      )}
                      {profile?.acceptingWork === false && (
                        <span className="inline-flex items-center gap-1 mt-1 text-xs text-amber-600 font-medium">
                          <AlertCircle className="w-3 h-3" />
                          Não disponível
                        </span>
                      )}
                    </div>
                    {selectedVideographerId === v.id && (
                      <CheckCircle2 className="w-5 h-5 text-[#0f3460] flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Services */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-[#e94560]" />
                Serviços de Vídeo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {VIDEO_SERVICES.map((service) => (
                  <ServiceOption
                    key={service}
                    service={service}
                    selected={selectedServices.includes(service)}
                    onToggle={toggleService}
                    price={service === "VIDEO_STANDARD" ? 50 : 60}
                  />
                ))}
              </div>

              {/* Additional intros */}
              {selectedServices.some((s) => VIDEO_SERVICES.includes(s)) && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Introduções Adicionais</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Outros consultores no mesmo vídeo (+{ADDITIONAL_INTRO_PRICE}€ cada)
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setAdditionalIntros(Math.max(0, additionalIntros - 1))}
                        disabled={additionalIntros === 0}
                        className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-bold text-slate-900">
                        {additionalIntros}
                      </span>
                      <button
                        onClick={() => setAdditionalIntros(additionalIntros + 1)}
                        className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#0f3460]" />
                Serviços de Fotografia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {PHOTO_SERVICES.map((service) => {
                  const prices: Record<string, number> = {
                    PHOTO_DRONE: 35,
                    PHOTO_T1_T2: 25,
                    PHOTO_T3_T4: 35,
                    PHOTO_T5_PLUS: 45,
                  }
                  return (
                    <ServiceOption
                      key={service}
                      service={service}
                      selected={selectedServices.includes(service)}
                      onToggle={toggleService}
                      price={prices[service]}
                    />
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Price preview */}
          {pricing && (
            <div className="bg-[#0f3460] text-white rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Total estimado</p>
                <p className="text-2xl font-bold">{formatPrice(pricing.total)}</p>
              </div>
              <div className="text-right text-sm text-slate-300">
                {pricing.services.map((s) => (
                  <div key={s.type}>{s.label}: {formatPrice(s.price)}</div>
                ))}
                {pricing.additionalIntros > 0 && (
                  <div>Introduções ({pricing.additionalIntros}×): {formatPrice(pricing.additionalIntrosTotal)}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Date & Time */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Escolher Data e Hora</CardTitle>
            <CardDescription>
              Serviços disponíveis das 08:00 às 17:00 · Duração: 1h30
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Input
              type="date"
              label="Data"
              min={minDateStr}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />

            {selectedDate && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-3">
                  Horários Disponíveis
                </p>
                {slotsLoading ? (
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    A verificar disponibilidade...
                  </div>
                ) : timeSlots.length === 0 ? (
                  <p className="text-slate-400 text-sm">Sem horários disponíveis nesta data.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          "px-3 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all",
                          !slot.available
                            ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                            : selectedSlot?.time === slot.time
                            ? "border-[#0f3460] bg-[#0f3460] text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-[#0f3460] hover:text-[#0f3460]"
                        )}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedSlot && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-semibold">
                    Horário selecionado: {selectedSlot.time} —{" "}
                    {selectedDate &&
                      new Date(selectedDate).toLocaleDateString("pt-PT", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Property */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Imóvel</CardTitle>
            <CardDescription>
              Introduza a morada e tipologia do imóvel a fotografar/filmar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Property type — required for video services */}
            {hasVideoService && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Tipologia do Imóvel
                  <span className="text-red-500 ml-1">*</span>
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { id: "T0", label: "T0", sub: "Studio" },
                    { id: "T1", label: "T1", sub: "1 quarto" },
                    { id: "T2", label: "T2", sub: "2 quartos" },
                    { id: "T3", label: "T3", sub: "3 quartos" },
                    { id: "T4", label: "T4", sub: "4 quartos" },
                    { id: "T5_PLUS", label: "T5+", sub: "5+ quartos" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPropertyType(t.id)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all",
                        propertyType === t.id
                          ? "border-[#0f3460] bg-[#0f3460]/5"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <span className={cn("text-base font-bold", propertyType === t.id ? "text-[#0f3460]" : "text-slate-800")}>
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

            <Input
              label="Morada completa"
              placeholder="Ex: Rua da Liberdade 123, 1250-140 Lisboa"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              hint="Inclua cidade e código postal para cálculo de deslocação"
            />

            {/* Travel estimate */}
            {travelLoading && (
              <div className="flex items-center gap-2 text-slate-500 text-sm p-3 bg-slate-50 rounded-lg">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                A calcular tempo de deslocação...
              </div>
            )}

            {travelEstimate && !travelLoading && (
              <div
                className={cn(
                  "p-4 rounded-xl border",
                  travelEstimate.hasTravelFee
                    ? "bg-amber-50 border-amber-200"
                    : "bg-emerald-50 border-emerald-200"
                )}
              >
                <div className="flex items-start gap-3">
                  <MapPin
                    className={cn(
                      "w-5 h-5 mt-0.5 flex-shrink-0",
                      travelEstimate.hasTravelFee ? "text-amber-600" : "text-emerald-600"
                    )}
                  />
                  <div>
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        travelEstimate.hasTravelFee ? "text-amber-800" : "text-emerald-800"
                      )}
                    >
                      Tempo de deslocação estimado: {travelEstimate.durationText}
                    </p>
                    {travelEstimate.hasTravelFee ? (
                      <p className="text-xs text-amber-700 mt-1">
                        Deslocação superior a 1 hora — taxa de deslocação de 50€ aplicada
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-700 mt-1">
                        Deslocação incluída (menos de 1 hora)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Input
              label="Notas adicionais (opcional)"
              placeholder="Informação adicional para o videógrafo..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 5: Summary & Checkout */}
      {step === 5 && pricing && selectedVideographer && selectedSlot && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo e Pagamento</CardTitle>
            <CardDescription>Reveja os detalhes antes de confirmar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Booking details */}
            <div className="space-y-3">
              <SummaryRow
                icon={<User className="w-4 h-4" />}
                label="Videógrafo"
                value={
                  selectedVideographer.videographerProfile?.displayName ||
                  selectedVideographer.name ||
                  ""
                }
              />
              <SummaryRow
                icon={<Calendar className="w-4 h-4" />}
                label="Data e Hora"
                value={`${selectedSlot.time} — ${new Date(selectedDate).toLocaleDateString("pt-PT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`}
              />
              <SummaryRow
                icon={<Clock className="w-4 h-4" />}
                label="Duração"
                value="1 hora e 30 minutos"
              />
              <SummaryRow
                icon={<MapPin className="w-4 h-4" />}
                label="Imóvel"
                value={propertyAddress}
              />
              {propertyType && (
                <SummaryRow
                  icon={<Info className="w-4 h-4" />}
                  label="Tipologia"
                  value={propertyType === "T5_PLUS" ? "T5+" : propertyType}
                />
              )}
            </div>

            <hr className="border-slate-100" />

            {/* Pricing breakdown */}
            <div className="space-y-2">
              {pricing.services.map((s) => (
                <div key={s.type} className="flex justify-between text-sm">
                  <span className="text-slate-600">{s.label}</span>
                  <span className="font-medium text-slate-900">{formatPrice(s.price)}</span>
                </div>
              ))}
              {pricing.additionalIntros > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">
                    Introduções adicionais ({pricing.additionalIntros}×)
                  </span>
                  <span className="font-medium text-slate-900">
                    {formatPrice(pricing.additionalIntrosTotal)}
                  </span>
                </div>
              )}
              {pricing.hasTravelFee && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600">Taxa de deslocação</span>
                  <span className="font-medium text-amber-700">
                    {formatPrice(pricing.travelFeeAmount)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center py-3 px-4 bg-[#0f3460] rounded-xl">
              <span className="text-white font-semibold">Total a pagar</span>
              <span className="text-white text-2xl font-bold">{formatPrice(pricing.total)}</span>
            </div>

            {/* Payment notice */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                O pagamento é processado de forma segura via Stripe. A marcação só fica confirmada após pagamento bem-sucedido.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              size="lg"
              className="w-full"
              loading={submitting}
              onClick={handleSubmit}
            >
              Pagar {formatPrice(pricing.total)} e Confirmar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="ghost"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </Button>

        {step < 5 && (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="flex items-center gap-2"
          >
            Continuar
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

function ServiceOption({
  service,
  selected,
  onToggle,
  price,
}: {
  service: ServiceType
  selected: boolean
  onToggle: (s: ServiceType) => void
  price: number
}) {
  return (
    <button
      onClick={() => onToggle(service)}
      className={cn(
        "flex items-center justify-between p-3.5 rounded-lg border-2 text-left transition-all",
        selected
          ? "border-[#0f3460] bg-[#0f3460]/5"
          : "border-slate-200 bg-white hover:border-slate-300"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-5 h-5 rounded flex items-center justify-center border-2 transition-all",
            selected
              ? "border-[#0f3460] bg-[#0f3460]"
              : "border-slate-300"
          )}
        >
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className={cn("text-sm font-medium", selected ? "text-[#0f3460]" : "text-slate-700")}>
          {SERVICE_LABELS[service]}
        </span>
      </div>
      <span className={cn("text-sm font-bold", selected ? "text-[#0f3460]" : "text-slate-600")}>
        {formatPrice(price)}
      </span>
    </button>
  )
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-sm text-slate-900 font-semibold mt-0.5">{value}</p>
      </div>
    </div>
  )
}
