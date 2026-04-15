"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  CalendarPlus,
  Calendar,
  Users,
  Settings,
  LogOut,
  DollarSign,
  BarChart3,
  FileVideo,
  ChevronRight,
  X,
} from "lucide-react"
import { useSidebar } from "./sidebar-context"

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

type ViewRole = "ADMIN" | "CONSULTANT" | "VIDEOGRAPHER"

const ROLE_VIEWS: { key: ViewRole; label: string }[] = [
  { key: "ADMIN", label: "Admin" },
  { key: "CONSULTANT", label: "Consultor" },
  { key: "VIDEOGRAPHER", label: "Videógrafo" },
]

const ROLE_DASHBOARDS: Record<ViewRole, string> = {
  ADMIN: "/admin/dashboard",
  CONSULTANT: "/consultant/dashboard",
  VIDEOGRAPHER: "/videographer/dashboard",
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { isOpen, close } = useSidebar()
  const role = (session?.user as any)?.role as string | undefined
  const isAdmin = role === "ADMIN"

  const [viewAs, setViewAs] = useState<ViewRole>("ADMIN")

  // Persist view preference in localStorage
  useEffect(() => {
    const saved = localStorage.getItem("vs_admin_view") as ViewRole | null
    if (saved && isAdmin) setViewAs(saved)
  }, [isAdmin])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    close()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  function switchView(v: ViewRole) {
    setViewAs(v)
    localStorage.setItem("vs_admin_view", v)
    router.push(ROLE_DASHBOARDS[v])
  }

  const activeView = isAdmin ? viewAs : (role as ViewRole) ?? "CONSULTANT"

  const navItems =
    activeView === "ADMIN"
      ? adminNav
      : activeView === "VIDEOGRAPHER"
      ? videographerNav
      : consultantNav

  const roleLabel =
    activeView === "ADMIN"
      ? "Administrador"
      : activeView === "VIDEOGRAPHER"
      ? "Videógrafo"
      : "Consultor"

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          // Mobile: fixed overlay drawer
          "fixed inset-y-0 left-0 z-40 w-72",
          // Desktop: normal sidebar in flex flow
          "md:relative md:z-auto md:w-64 md:translate-x-0",
          // Transition
          "transition-transform duration-300 ease-in-out",
          // Mobile open/close
          isOpen ? "translate-x-0" : "-translate-x-full",
          "bg-[#0f172a] flex flex-col"
        )}
      >
        {/* Logo + mobile close button */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex flex-col items-center gap-1">
            <img src="/logo.svg" alt="VS.Media" className="h-5 w-auto object-contain" />
            <span className="text-[9px] text-white/30 uppercase tracking-[0.18em]">Calendar</span>
          </div>
          <button
            onClick={close}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role switcher — admin only */}
        {isAdmin && (
          <div className="px-3 pt-3 pb-2">
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-medium px-1 mb-1.5">
              Ver como
            </p>
            <div className="flex gap-1 bg-white/5 rounded-lg p-1">
              {ROLE_VIEWS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => switchView(v.key)}
                  className={cn(
                    "flex-1 text-xs font-semibold py-1.5 rounded-md transition-all duration-150",
                    viewAs === v.key
                      ? "bg-[#e94560] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Role Badge */}
        <div className="px-6 py-2.5 border-b border-white/10">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            {roleLabel}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/")
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
                    isActive
                      ? "text-[#e94560]"
                      : "text-slate-500 group-hover:text-slate-300"
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
                className="w-8 h-8 rounded-full border border-white/20 flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                {session?.user?.name?.[0] || "U"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {session?.user?.name}
              </p>
              <p className="text-slate-500 text-xs truncate">
                {session?.user?.email}
              </p>
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
    </>
  )
}
