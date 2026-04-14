import { auth } from "@/auth"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Globe, Mail, DollarSign, Shield, Database } from "lucide-react"

export default async function AdminSettingsPage() {
  const session = await auth()

  const sections = [
    {
      icon: Globe,
      title: "Plataforma",
      color: "text-blue-600 bg-blue-50",
      items: [
        { label: "Nome da app", value: "VS.Media Calendar" },
        { label: "URL", value: process.env.NEXT_PUBLIC_APP_URL || "https://vsmediacalendar.netlify.app" },
        { label: "Ambiente", value: process.env.NODE_ENV === "production" ? "Produção" : "Desenvolvimento" },
      ],
    },
    {
      icon: DollarSign,
      title: "Taxas de Deslocação",
      color: "text-emerald-600 bg-emerald-50",
      items: [
        { label: "Endereço de origem", value: process.env.TRAVEL_ORIGIN_ADDRESS || "Metropolitan Business Center, Odivelas" },
        { label: "Limiar (horas de viagem)", value: `${process.env.TRAVEL_FEE_THRESHOLD_HOURS || "1"}h` },
        { label: "Valor da taxa", value: `€${process.env.TRAVEL_FEE_AMOUNT || "50"}` },
      ],
    },
    {
      icon: Mail,
      title: "Email",
      color: "text-purple-600 bg-purple-50",
      items: [
        { label: "Remetente", value: process.env.EMAIL_FROM || "VS.Media Calendar <noreply@vsmedia.pt>" },
        { label: "Fornecedor", value: "Resend" },
        { label: "Estado", value: process.env.RESEND_API_KEY ? "Configurado" : "Não configurado" },
      ],
    },
    {
      icon: Shield,
      title: "Autenticação",
      color: "text-orange-600 bg-orange-50",
      items: [
        { label: "Fornecedor", value: "Google OAuth" },
        { label: "Estratégia de sessão", value: "Base de dados" },
        { label: "Google OAuth", value: process.env.AUTH_GOOGLE_ID ? "Configurado" : "Não configurado" },
      ],
    },
    {
      icon: Database,
      title: "Base de dados",
      color: "text-slate-600 bg-slate-100",
      items: [
        { label: "Fornecedor", value: "Neon PostgreSQL" },
        { label: "ORM", value: "Prisma v7" },
        { label: "Estado", value: process.env.DATABASE_URL ? "Ligada" : "Não configurada" },
      ],
    },
  ]

  return (
    <>
      <Header
        title="Configurações"
        subtitle="Visão geral da configuração da plataforma"
      />
      <div className="flex-1 p-6 space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          <p className="font-semibold mb-0.5">Configurações via variáveis de ambiente</p>
          <p className="text-amber-700">Para alterar estas definições, actualize as variáveis de ambiente no painel do Netlify e faça um novo deploy.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <Card key={section.title}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${section.color}`}>
                    <section.icon className="w-4 h-4" />
                  </div>
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <dl className="space-y-2">
                  {section.items.map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-4 text-sm">
                      <dt className="text-slate-500 flex-shrink-0">{item.label}</dt>
                      <dd className="text-slate-900 font-medium text-right truncate max-w-[200px]" title={item.value}>
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Admin info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-600 bg-rose-50">
                <Shield className="w-4 h-4" />
              </div>
              Sessão actual
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Nome</dt>
                <dd className="text-slate-900 font-medium">{session?.user?.name}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Email</dt>
                <dd className="text-slate-900 font-medium">{session?.user?.email}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Papel</dt>
                <dd className="text-slate-900 font-medium">{(session?.user as any)?.role}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
