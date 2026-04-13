import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { LoginForm } from "./login-form"

export default async function LoginPage() {
  const session = await auth()

  if (session?.user) {
    const role = (session?.user as any)?.role
    if (role === "ADMIN") redirect("/admin/dashboard")
    if (role === "VIDEOGRAPHER") redirect("/videographer/dashboard")
    redirect("/consultant/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f3460] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#e94560] mb-6 shadow-lg shadow-[#e94560]/30">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">VS.Media Calendar</h1>
          <p className="text-slate-400 mt-2 text-sm">
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

          <LoginForm />

          <p className="mt-6 text-center text-xs text-slate-400">
            Acesso reservado a membros da equipa VS.Media
          </p>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          {[
            { icon: "📅", label: "Agendamento Online" },
            { icon: "💳", label: "Pagamento Seguro" },
            { icon: "📹", label: "Entrega Digital" },
          ].map((f) => (
            <div key={f.label} className="text-slate-400 text-sm">
              <div className="text-2xl mb-1">{f.icon}</div>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
