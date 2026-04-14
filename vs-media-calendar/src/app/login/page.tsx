import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { LoginForm } from "./login-form"
import { VsMediaLogo } from "@/components/logo"

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
          <div className="flex justify-center mb-3">
            <VsMediaLogo variant="white" size="xl" />
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
