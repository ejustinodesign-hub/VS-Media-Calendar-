"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { formatPrice, IVA_RATE, COMMISSION_RATE } from "@/lib/pricing"
import { Calculator, FileText, PenLine, Printer, X, RotateCcw, CheckCircle2 } from "lucide-react"

interface Props {
  propertyAddress?: string
  consultantName?: string
}

export function CommissionSimulator({ propertyAddress, consultantName }: Props) {
  const [rawValue, setRawValue] = useState("")
  const [showProposal, setShowProposal] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [signedAt, setSignedAt] = useState<Date | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  const numericValue = parseFloat(rawValue.replace(/\s/g, "").replace(",", "."))
  const isValid = !isNaN(numericValue) && numericValue > 0
  const commissionNet = isValid ? Math.round(numericValue * COMMISSION_RATE * 100) / 100 : null
  const ivaAmount = commissionNet !== null ? Math.round(commissionNet * IVA_RATE * 100) / 100 : null
  const commissionTotal = commissionNet !== null ? Math.round(commissionNet * (1 + IVA_RATE) * 100) / 100 : null

  const getXY = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    drawing.current = true
    const canvas = canvasRef.current
    if (!canvas) return
    lastPos.current = getXY(e, canvas)
  }, [])

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const pos = getXY(e, canvas)
    if (lastPos.current) {
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.strokeStyle = "#0f172a"
      ctx.lineWidth = 2.5
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.stroke()
      setHasSignature(true)
    }
    lastPos.current = pos
  }, [])

  const stopDraw = useCallback(() => {
    drawing.current = false
    lastPos.current = null
    if (hasSignature) setSignedAt(new Date())
  }, [hasSignature])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !showProposal) return
    canvas.addEventListener("mousedown", startDraw)
    canvas.addEventListener("mousemove", draw)
    canvas.addEventListener("mouseup", stopDraw)
    canvas.addEventListener("mouseleave", stopDraw)
    canvas.addEventListener("touchstart", startDraw, { passive: false })
    canvas.addEventListener("touchmove", draw, { passive: false })
    canvas.addEventListener("touchend", stopDraw)
    return () => {
      canvas.removeEventListener("mousedown", startDraw)
      canvas.removeEventListener("mousemove", draw)
      canvas.removeEventListener("mouseup", stopDraw)
      canvas.removeEventListener("mouseleave", stopDraw)
      canvas.removeEventListener("touchstart", startDraw)
      canvas.removeEventListener("touchmove", draw)
      canvas.removeEventListener("touchend", stopDraw)
    }
  }, [showProposal, startDraw, draw, stopDraw])

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    setSignedAt(null)
  }

  const handlePrint = () => window.print()

  const today = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" })

  return (
    <>
      {/* Simulator card */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[#e94560]" />
          <p className="text-sm font-semibold text-slate-800">Simulador de Comissão</p>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Valor estimado do imóvel (€)</label>
          <input
            type="text"
            inputMode="numeric"
            value={rawValue}
            onChange={(e) => setRawValue(e.target.value)}
            placeholder="Ex: 250000"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560]"
          />
        </div>
        {isValid && commissionNet !== null && ivaAmount !== null && commissionTotal !== null && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Comissão 0,15% s/ IVA</span>
              <span className="font-medium text-slate-700">{formatPrice(commissionNet)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>IVA 23%</span>
              <span className="font-medium text-slate-700">{formatPrice(ivaAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
              <span>Total comissão</span>
              <span className="text-[#e94560]">{formatPrice(commissionTotal)}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowProposal(true)}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-[#0f3460] text-white text-sm font-semibold rounded-lg hover:bg-[#1a4a7a] transition-colors"
            >
              <FileText className="w-4 h-4" />
              Gerar Proposta & Assinar
            </button>
          </div>
        )}
      </div>

      {/* Proposal modal */}
      {showProposal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 print:hidden">
              <h2 className="text-base font-bold text-slate-900">Proposta de Serviço — Comissão</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir / PDF
                </button>
                <button type="button" onClick={() => setShowProposal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Proposal document */}
            <div className="px-8 py-6 space-y-6 text-sm text-slate-800" id="proposal-document">
              {/* Header */}
              <div className="text-center space-y-1 pb-4 border-b border-slate-200">
                <p className="text-xs text-slate-400 uppercase tracking-widest">VS.Brothers</p>
                <h1 className="text-xl font-bold text-[#0f3460]">Proposta de Prestação de Serviços</h1>
                <p className="text-xs text-slate-500">Produção de Conteúdo Audiovisual Imobiliário — Regime de Comissão</p>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-400 mb-0.5">Data</p>
                  <p className="font-semibold">{today}</p>
                </div>
                {consultantName && (
                  <div>
                    <p className="text-slate-400 mb-0.5">Consultor</p>
                    <p className="font-semibold">{consultantName}</p>
                  </div>
                )}
                {propertyAddress && (
                  <div className="col-span-2">
                    <p className="text-slate-400 mb-0.5">Imóvel</p>
                    <p className="font-semibold">{propertyAddress}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-400 mb-0.5">Valor estimado do imóvel</p>
                  <p className="font-semibold">{formatPrice(numericValue)}</p>
                </div>
              </div>

              {/* Commission table */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Cálculo de Comissão</p>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-slate-600">Descrição</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="px-4 py-2">Valor de venda do imóvel</td>
                        <td className="px-4 py-2 text-right">{formatPrice(numericValue)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Taxa de comissão</td>
                        <td className="px-4 py-2 text-right">0,15%</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Comissão (s/ IVA)</td>
                        <td className="px-4 py-2 text-right">{commissionNet !== null ? formatPrice(commissionNet) : "—"}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">IVA (23%)</td>
                        <td className="px-4 py-2 text-right">{ivaAmount !== null ? formatPrice(ivaAmount) : "—"}</td>
                      </tr>
                      <tr className="bg-[#0f3460]/5 font-bold">
                        <td className="px-4 py-2 text-[#0f3460]">Total comissão (c/ IVA)</td>
                        <td className="px-4 py-2 text-right text-[#0f3460]">{commissionTotal !== null ? formatPrice(commissionTotal) : "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Terms */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Condições</p>
                <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <p>1. A VS.Brothers compromete-se a realizar a produção de conteúdo audiovisual (fotografia e/ou vídeo) do imóvel referenciado, sem custo inicial para o consultor.</p>
                  <p>2. A comissão de <strong>0,15%</strong> sobre o valor final de venda do imóvel, acrescida de IVA à taxa legal em vigor (23%), será devida e exigível <strong>apenas aquando da concretização efectiva da transação</strong> de compra e venda.</p>
                  <p>3. Caso o imóvel não seja vendido, <strong>nenhuma comissão é devida</strong>. A VS.Brothers assume o risco da prestação do serviço sem garantia de remuneração.</p>
                  <p>4. O valor final de venda deverá ser comunicado pelo consultor à VS.Brothers no prazo de 30 dias após a escritura de compra e venda, através da plataforma VS.Media Calendar.</p>
                  <p>5. Os conteúdos produzidos são propriedade do consultor e podem ser utilizados para fins de comercialização do imóvel. A VS.Brothers reserva o direito de utilizar os conteúdos no seu portfólio.</p>
                </div>
              </div>

              {/* Signature area */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <PenLine className="w-4 h-4 text-[#0f3460]" />
                  <p className="text-xs font-semibold text-slate-700">Assinatura Digital do Consultor</p>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 print:hidden"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Limpar
                  </button>
                </div>
                <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden" style={{ height: 120 }}>
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={120}
                    className="w-full h-full cursor-crosshair touch-none"
                  />
                  {!hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-xs text-slate-400">Assine aqui com o rato ou dedo</p>
                    </div>
                  )}
                </div>
                {signedAt && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Assinado digitalmente em {signedAt.toLocaleString("pt-PT")}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-2">
                  Ao assinar esta proposta, o consultor declara ter lido e aceite as condições acima descritas.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
