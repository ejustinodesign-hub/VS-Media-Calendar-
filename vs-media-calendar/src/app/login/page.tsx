import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { LoginForm } from "./login-form"
import { LoginLogo } from "./login-logo"
import { Calendar, CreditCard, Video } from "lucide-react"

interface Props {
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth()

  if (session?.user) {
    const role = (session?.user as any)?.role
    if (role === "ADMIN") redirect("/admin/dashboard")
    if (role === "VIDEOGRAPHER") redirect("/videographer/dashboard")
    redirect("/consultant/dashboard")
  }

  const { callbackUrl } = await searchParams

  const features = [
    { Icon: Calendar, label: "Agendamento Online" },
    { Icon: CreditCard, label: "Pagamento Seguro" },
    { Icon: Video, label: "Entrega Digital" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f3460] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex flex-col items-center gap-2 mb-3">
            <LoginLogo />
            <span className="text-white/40 text-xs uppercase tracking-[0.22em]">Calendar</span>
          </div>
          <p className="text-slate-400 mt-2 text-sm tracking-wide">
            Plataforma de Agendamento Imobiliário
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 p-8">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Bem-vindo</h2>
            <p className="text-slate-500 text-sm">
              Inicie sessão para aceder à plataforma
            </p>
          </div>

          <LoginForm callbackUrl={callbackUrl} />

          <p className="mt-6 text-center text-xs text-slate-400">
            Acesso reservado a membros da equipa VS.Brothers
          </p>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          {features.map(({ Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2 text-white/50 text-xs">
              <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                <Icon className="w-5 h-5 text-white/70" strokeWidth={1.5} />
              </div>
              <span className="leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
