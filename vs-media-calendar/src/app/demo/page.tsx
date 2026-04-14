import Link from "next/link"
import { Video, Users, Camera, Shield } from "lucide-react"

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#e94560] flex items-center justify-center">
              <Video className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-white font-bold text-2xl leading-none">VS.Media</h1>
              <p className="text-slate-400 text-sm">Calendar</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-[#e94560]/20 border border-[#e94560]/30 rounded-full px-4 py-1.5 mb-4">
            <span className="w-1.5 h-1.5 bg-[#e94560] rounded-full animate-pulse" />
            <span className="text-[#e94560] text-sm font-semibold">Modo Demo</span>
          </div>
          <h2 className="text-white text-3xl font-bold mb-3">Escolha o seu perfil</h2>
          <p className="text-slate-400">
            Explore a plataforma com dados de exemplo — sem necessidade de conta ou base de dados.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid gap-4">
          <Link href="/demo/consultant/dashboard">
            <div className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/30 transition-colors">
                  <Users className="w-7 h-7 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg">Consultor</h3>
                  <p className="text-slate-400 text-sm mt-0.5">
                    Agende serviços de vídeo e fotografia, gira marcações e veja histórico
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {["Nova marcação", "Wizard de agendamento", "Histórico", "Dashboard"].map((f) => (
                      <span key={f} className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-slate-500 group-hover:text-white transition-colors text-xl">→</span>
              </div>
            </div>
          </Link>

          <Link href="/demo/videographer/dashboard">
            <div className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/30 transition-colors">
                  <Camera className="w-7 h-7 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg">Videógrafo</h3>
                  <p className="text-slate-400 text-sm mt-0.5">
                    Gira pedidos, aceite ou recuse serviços, veja agenda e entregue ficheiros
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {["Aceitar/Recusar", "Agenda", "Upload ficheiros", "Pedidos pendentes"].map((f) => (
                      <span key={f} className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-slate-500 group-hover:text-white transition-colors text-xl">→</span>
              </div>
            </div>
          </Link>

          <Link href="/demo/admin/dashboard">
            <div className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/30 transition-colors">
                  <Shield className="w-7 h-7 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg">Administrador</h3>
                  <p className="text-slate-400 text-sm mt-0.5">
                    Visão global da plataforma, gestão de utilizadores, preços e relatórios
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {["Dashboard global", "Gestão de preços", "Utilizadores", "Relatórios"].map((f) => (
                      <span key={f} className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-slate-500 group-hover:text-white transition-colors text-xl">→</span>
              </div>
            </div>
          </Link>
        </div>

        <p className="text-center text-slate-600 text-xs mt-8">
          Dados fictícios para demonstração · Nenhuma informação real é armazenada
        </p>
      </div>
    </div>
  )
}
