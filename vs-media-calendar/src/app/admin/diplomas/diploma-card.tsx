"use client"

import { formatPrice } from "@/lib/pricing"
import { Trophy, Video, Sparkles, Download } from "lucide-react"

type DiplomaType = "video" | "intros" | "spender"

const CONFIG: Record<DiplomaType, {
  title: string
  subtitle: string
  icon: typeof Trophy
  gradient: string
  accent: string
  accentText: string
  badgeBg: string
}> = {
  video: {
    title: "Campeão dos Vídeos",
    subtitle: "Pelo desempenho excecional na realização de vídeos imobiliários",
    icon: Video,
    gradient: "from-[#0f172a] via-[#1e3a5f] to-[#0f3460]",
    accent: "#60a5fa",
    accentText: "text-blue-300",
    badgeBg: "bg-blue-500/20 border-blue-400/30",
  },
  intros: {
    title: "Campeão das Intros",
    subtitle: "Pelo contributo excecional na criação de intros partilhadas",
    icon: Sparkles,
    gradient: "from-[#1a0533] via-[#3b0764] to-[#4c1d95]",
    accent: "#c084fc",
    accentText: "text-purple-300",
    badgeBg: "bg-purple-500/20 border-purple-400/30",
  },
  spender: {
    title: "Big Spender",
    subtitle: "Pelo maior investimento em marketing imobiliário de qualidade",
    icon: Trophy,
    gradient: "from-[#1c1003] via-[#78350f] to-[#92400e]",
    accent: "#fbbf24",
    accentText: "text-amber-300",
    badgeBg: "bg-amber-500/20 border-amber-400/30",
  },
}

interface Props {
  type: DiplomaType
  month: string
  name: string
  image: string | null
  metric: number
  metricLabel: string
}

export function DiplomaCard({ type, month, name, image, metric, metricLabel }: Props) {
  const cfg = CONFIG[type]
  const Icon = cfg.icon

  const metricDisplay = type === "spender" ? null : `${metric}`

  const params = new URLSearchParams({ type, month, name, metric: String(metric), metricLabel })
  if (image) params.set("image", image)
  const printUrl = `/api/diploma-print?${params}`

  return (
    <div className="space-y-3">
      {/* Diploma */}
      <div className={`relative bg-gradient-to-br ${cfg.gradient} rounded-3xl overflow-hidden shadow-2xl`}>

        {/* Decorative rings */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full border opacity-10"
            style={{ borderColor: cfg.accent }} />
          <div className="absolute -bottom-24 -left-16 w-80 h-80 rounded-full border opacity-10"
            style={{ borderColor: cfg.accent }} />
        </div>

        {/* Top stripe */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${cfg.accent}, transparent)` }} />

        <div className="px-10 py-8">
          {/* VS Media branding */}
          <div className="flex items-center justify-between mb-8">
            <img src="/logo.svg" alt="VS Media" className="h-4 w-auto opacity-50" />
            <p className="text-white/40 text-xs capitalize">{month}</p>
          </div>

          {/* Icon + title */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl border ${cfg.badgeBg} mb-4`}>
              <Icon className={`w-8 h-8 ${cfg.accentText}`} />
            </div>
            <h2 className="text-white text-2xl font-bold tracking-tight">{cfg.title}</h2>
            <p className={`text-sm mt-1 ${cfg.accentText} opacity-80`}>{cfg.subtitle}</p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex-1 h-px opacity-20" style={{ background: cfg.accent }} />
            <div className="w-1.5 h-1.5 rounded-full opacity-40" style={{ background: cfg.accent }} />
            <div className="flex-1 h-px opacity-20" style={{ background: cfg.accent }} />
          </div>

          {/* Winner */}
          <div className="text-center mb-8">
            <p className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-4">Atribuído a</p>
            <div className="flex flex-col items-center gap-3">
              {image ? (
                <img src={image} alt={name} className="w-20 h-20 rounded-full border-4 shadow-xl"
                  style={{ borderColor: cfg.accent + "60" }} />
              ) : (
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold border-4 shadow-xl"
                  style={{ background: cfg.accent + "20", borderColor: cfg.accent + "60", color: cfg.accent }}>
                  {name[0] || "?"}
                </div>
              )}
              <p className="text-white text-3xl font-bold">{name}</p>
            </div>
          </div>

          {/* Metric */}
          {metricDisplay !== null && (
            <div className={`text-center rounded-2xl border py-4 ${cfg.badgeBg}`}>
              <p className="text-4xl font-black" style={{ color: cfg.accent }}>{metricDisplay}</p>
              <p className="text-white/60 text-sm mt-1 capitalize">{metricLabel}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
            <p className="text-white/30 text-xs">vs.media</p>
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-1 h-1 rounded-full" style={{ background: cfg.accent, opacity: 0.4 + i * 0.15 }} />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom stripe */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${cfg.accent}, transparent)` }} />
      </div>

      {/* Download button */}
      <a
        href={printUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:border-[#0f3460] hover:text-[#0f3460] transition-colors bg-white"
      >
        <Download className="w-4 h-4" />
        Abrir para guardar / imprimir
      </a>
    </div>
  )
}
