"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  CalendarPlus,
  Calendar,
  Users,
  Settings,
  LogOut,
  Video,
  DollarSign,
  BarChart3,
  FileVideo,
  Clock,
  ChevronRight,
} from "lucide-react"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

const consultantNav: NavItem[] = [
  { href: "/consultant/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/consultant/bookings/new", label: "Nova Marcação", icon: CalendarPlus },
  { href: "/consultant/bookings", label: "As Minhas Marcações", icon: Calendar },
]

const videographerNav: NavItem[] = [
  { href: "/videographer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/videographer/bookings", label: "Pedidos", icon: FileVideo },
  { href: "/videographer/schedule", label: "Agenda", icon: Calendar },
]

const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Marcações", icon: Calendar },
  { href: "/admin/users", label: "Utilizadores", icon: Users },
  { href: "/admin/pricing", label: "Preços", icon: DollarSign },
  { href: "/admin/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/admin/settings", label: "Configurações", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined

  const navItems =
    role === "ADMIN"
      ? adminNav
      : role === "VIDEOGRAPHER"
      ? videographerNav
      : consultantNav

  return (
    <aside className="w-64 min-h-screen bg-[#0f172a] flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#e94560] flex items-center justify-center">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-none">VS.Media</h1>
            <p className="text-slate-400 text-xs mt-0.5">Calendar</p>
          </div>
        </div>
      </div>

      {/* Role Badge */}
      <div className="px-6 py-3 border-b border-white/10">
        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
          {role === "ADMIN" ? "Administrador" : role === "VIDEOGRAPHER" ? "Videógrafo" : "Consultor"}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  isActive ? "text-[#e94560]" : "text-slate-500 group-hover:text-slate-300"
                )}
              />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              {item.badge && (
                <span className="ml-auto bg-[#e94560] text-white text-xs px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || ""}
              className="w-8 h-8 rounded-full border border-white/20"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-semibold">
              {session?.user?.name?.[0] || "U"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{session?.user?.name}</p>
            <p className="text-slate-500 text-xs truncate">{session?.user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Terminar Sessão
        </button>
      </div>
    </aside>
  )
}
