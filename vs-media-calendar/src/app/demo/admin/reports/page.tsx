import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DEMO_BOOKINGS } from "@/lib/demo-data"
import { BarChart3, TrendingUp, DollarSign, Calendar, Users } from "lucide-react"

export default function DemoAdminReportsPage() {
  const paid = DEMO_BOOKINGS.filter((b) => !["PENDING_PAYMENT", "CANCELLED"].includes(b.status))
  const totalRevenue = paid.reduce((sum, b) => sum + b.amount, 0)
  const avgAmount = paid.length > 0 ? Math.round(totalRevenue / paid.length) : 0
  const travelFeeCount = paid.filter((b) => b.hasTravelFee).length
  const travelFeeRevenue = travelFeeCount * 50

  // Revenue by videographer
  const byVideographer = ["Eduardo Justino", "Tomás Almeida", "Bernardo Pavão"].map((name) => {
    const bookings = paid.filter((b) => b.videographerName === name)
    return {
      name,
      count: bookings.length,
      revenue: bookings.reduce((sum, b) => sum + b.amount, 0),
    }
  })

  // Revenue by service type (approx)
  const serviceRevenue = paid.flatMap((b) =>
    b.services.map((s) => ({ service: s, amount: 0 }))
  )
  const serviceGroups = serviceRevenue.reduce<Record<string, number>>((acc, { service }) => {
    acc[service] = (acc[service] || 0) + 1
    return acc
  }, {})

  // Monthly (mock — group by month of scheduledAt)
  const monthly: Record<string, number> = {}
  paid.forEach((b) => {
    const key = new Date(b.scheduledAt).toLocaleDateString("pt-PT", { month: "short", year: "numeric" })
    monthly[key] = (monthly[key] || 0) + b.amount
  })

  const maxMonthly = Math.max(...Object.values(monthly), 1)

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Relatórios</h2>
          <p className="text-sm text-slate-500">Análise de receita e performance</p>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-6">
        {/* Top KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Receita Total", value: `${totalRevenue} €`, icon: DollarSign, color: "text-emerald-600 bg-emerald-50" },
            { label: "Marcações Pagas", value: paid.length, icon: Calendar, color: "text-blue-600 bg-blue-50" },
            { label: "Valor Médio", value: `${avgAmount} €`, icon: TrendingUp, color: "text-purple-600 bg-purple-50" },
            { label: "Taxa Deslocação", value: `${travelFeeRevenue} €`, icon: Users, color: "text-amber-600 bg-amber-50" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 py-5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Revenue by month */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-500" />
                Receita por Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(monthly).map(([month, amount]) => (
                <div key={month}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-slate-700 capitalize">{month}</span>
                    <span className="text-sm font-bold text-slate-900">{amount} €</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0f3460] rounded-full transition-all"
                      style={{ width: `${(amount / maxMonthly) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Revenue by videographer */}
          <Card>
            <CardHeader>
              <CardTitle>Receita por Videógrafo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {byVideographer.map((v, i) => {
                const maxRev = Math.max(...byVideographer.map((x) => x.revenue), 1)
                const colors = ["bg-[#e94560]", "bg-[#0f3460]", "bg-purple-500"]
                return (
                  <div key={v.name}>
                    <div className="flex justify-between mb-1">
                      <div>
                        <span className="text-sm font-semibold text-slate-900">{v.name}</span>
                        <span className="text-xs text-slate-400 ml-2">{v.count} serviços</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{v.revenue} €</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors[i]} rounded-full transition-all`}
                        style={{ width: `${(v.revenue / maxRev) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* Services breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Serviços Mais Solicitados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(serviceGroups)
                .sort(([, a], [, b]) => b - a)
                .map(([service, count]) => (
                  <div key={service} className="bg-slate-50 rounded-xl p-4">
                    <p className="text-sm font-semibold text-slate-900">{service}</p>
                    <p className="text-2xl font-bold text-[#0f3460] mt-1">{count}x</p>
                    <p className="text-xs text-slate-400">solicitações</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
