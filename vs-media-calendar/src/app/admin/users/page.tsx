import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserManagement } from "./user-management"
import { InviteUserForm } from "./invite-user-form"

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      teamType: true,
      active: true,
      onboardingCompleted: true,
      createdAt: true,
      _count: { select: { bookingsAsConsultant: true, bookingsAsVideographer: true } },
      videographerProfile: { select: { displayName: true, acceptingWork: true, weeklyCapacity: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <>
      <Header title="Gestão de Utilizadores" subtitle={`${users.length} utilizadores`} />
      <div className="flex-1 p-6 space-y-6">

        {/* Invite form */}
        <Card>
          <CardHeader>
            <CardTitle>Convidar Utilizador</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteUserForm />
          </CardContent>
        </Card>

        {/* Users table */}
        <Card>
          <CardHeader>
            <CardTitle>Todos os Utilizadores</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Utilizador", "Perfil", "Equipa", "Ativo", "Onboarding", "Marcações", "Ações"].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.image ? (
                            <img src={user.image} alt="" className="w-9 h-9 rounded-full border border-slate-200" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-[#0f3460] flex items-center justify-center text-white text-sm font-bold">
                              {user.name?.[0] || "?"}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{user.name || <span className="text-slate-400 italic">Sem nome</span>}</p>
                            <p className="text-xs text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          user.role === "ADMIN" ? "bg-purple-100 text-purple-700" :
                          user.role === "VIDEOGRAPHER" ? "bg-blue-100 text-blue-700" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {user.role === "ADMIN" ? "Admin" : user.role === "VIDEOGRAPHER" ? "Videógrafo" : "Consultor"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium ${user.teamType === "INTERNAL" ? "text-emerald-700" : "text-orange-700"}`}>
                          {user.teamType === "INTERNAL" ? "Interna" : "Externa"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`w-2 h-2 rounded-full inline-block ${user.active ? "bg-emerald-500" : "bg-red-400"}`} />
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium ${user.onboardingCompleted ? "text-emerald-600" : "text-amber-600"}`}>
                          {user.onboardingCompleted ? "Completo" : "Pendente"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {user.role === "CONSULTANT"
                          ? `${user._count.bookingsAsConsultant} marc.`
                          : user.role === "VIDEOGRAPHER"
                          ? `${user._count.bookingsAsVideographer} serv.`
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <UserManagement userId={user.id} currentRole={user.role} currentActive={user.active} currentName={user.name ?? null} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
