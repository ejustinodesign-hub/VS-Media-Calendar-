import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DEMO_USERS } from "@/lib/demo-data"
import { Users, UserCheck, UserX, Shield, Camera, User } from "lucide-react"

const ROLE_CONFIG = {
  CONSULTANT: { label: "Consultor", color: "text-blue-700 bg-blue-100", icon: User },
  VIDEOGRAPHER: { label: "Videógrafo", color: "text-purple-700 bg-purple-100", icon: Camera },
  ADMIN: { label: "Admin", color: "text-emerald-700 bg-emerald-100", icon: Shield },
}

export default function DemoAdminUsersPage() {
  const active = DEMO_USERS.filter((u) => u.active)
  const inactive = DEMO_USERS.filter((u) => !u.active)

  const byRole = {
    CONSULTANT: DEMO_USERS.filter((u) => u.role === "CONSULTANT").length,
    VIDEOGRAPHER: DEMO_USERS.filter((u) => u.role === "VIDEOGRAPHER").length,
    ADMIN: DEMO_USERS.filter((u) => u.role === "ADMIN").length,
  }

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Gestão de Utilizadores</h2>
          <p className="text-sm text-slate-500">{DEMO_USERS.length} utilizadores registados</p>
        </div>
        <button className="bg-[#0f3460] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a4a7a] transition-colors">
          + Convidar
        </button>
      </header>

      <div className="flex-1 p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Ativos", value: active.length, icon: UserCheck, color: "text-emerald-600 bg-emerald-50" },
            { label: "Consultores", value: byRole.CONSULTANT, icon: User, color: "text-blue-600 bg-blue-50" },
            { label: "Videógrafos", value: byRole.VIDEOGRAPHER, icon: Camera, color: "text-purple-600 bg-purple-50" },
            { label: "Inativos", value: inactive.length, icon: UserX, color: "text-slate-600 bg-slate-100" },
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

        {/* Users table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              Todos os Utilizadores
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {DEMO_USERS.map((user) => {
                const role = ROLE_CONFIG[user.role as keyof typeof ROLE_CONFIG]
                const Icon = role.icon
                return (
                  <div key={user.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-sm flex-shrink-0">
                      {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 text-sm">{user.name}</p>
                        {!user.active && (
                          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Inativo</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${role.color}`}>
                        <Icon className="w-3 h-3" />
                        {role.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100 transition-colors">
                        Editar
                      </button>
                      <button className={`text-xs px-2 py-1 rounded transition-colors ${
                        user.active
                          ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                          : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      }`}>
                        {user.active ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
