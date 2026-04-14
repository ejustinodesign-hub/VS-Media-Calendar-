"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  CalendarPlus,
  Calendar,
  Users,
  DollarSign,
  BarChart3,
  FileVideo,
  ChevronRight,
  ArrowLeft,
} from "lucide-react"
import { VsMediaLogo } from "@/components/logo"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const consultantNav: NavItem[] = [
  { href: "/demo/consultant/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/demo/consultant/bookings/new", label: "Nova Marcação", icon: CalendarPlus },
  { href: "/demo/consultant/bookings", label: "As Minhas Marcações", icon: Calendar },
]

const videographerNav: NavItem[] = [
  { href: "/demo/videographer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/demo/videographer/bookings", label: "Pedidos", icon: FileVideo },
  { href: "/demo/videographer/schedule", label: "Agenda", icon: Calendar },
]

const adminNav: NavItem[] = [
  { href: "/demo/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/demo/admin/bookings", label: "Marcações", icon: Calendar },
  { href: "/demo/admin/users", label: "Utilizadores", icon: Users },
  { href: "/demo/admin/pricing", label: "Preços", icon: DollarSign },
  { href: "/demo/admin/reports", label: "Relatórios", icon: BarChart3 },
]

const DEMO_USERS = {
  consultant: { name: "Ana Silva", email: "ana.silva@agencia.pt", initials: "AS" },
  videographer: { name: "Eduardo Justino", email: "eduardo@vsmedia.pt", initials: "EJ" },
  admin: { name: "Admin VS.Media", email: "admin@vsmedia.pt", initials: "AV" },
}

type DemoRole = "consultant" | "videographer" | "admin"

export function DemoSidebar({ role }: { role: DemoRole }) {
  const pathname = usePathname()
  const navItems =
    role === "admin" ? adminNav : role === "videographer" ? videographerNav : consultantNav
  const user = DEMO_USERS[role]
  const roleLabel =
    role === "admin" ? "Administrador" : role === "videographer" ? "Videógrafo" : "Consultor"

  return (
    <aside className="w-64 min-h-screen bg-[#0f172a] flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <VsMediaLogo variant="white" size="md" subtitle="Calendar" />
      </div>

      {/* Demo banner */}
      <div className="mx-3 mt-3 px-3 py-2 bg-[#e94560]/20 border border-[#e94560]/30 rounded-lg">
        <p className="text-[#e94560] text-xs font-bold uppercase tracking-wider text-center">
          Modo Demo
        </p>
      </div>

      {/* Role Badge */}
      <div className="px-6 py-3 border-b border-white/10 mt-2">
        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
          {roleLabel}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (pathname.startsWith(item.href + "/") && item.href !== "/demo/consultant/bookings/new")
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
            </Link>
          )
        })}
      </nav>

      {/* User Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-semibold">
            {user.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user.name}</p>
            <p className="text-slate-500 text-xs truncate">{user.email}</p>
          </div>
        </div>
        <Link
          href="/demo"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Trocar Perfil
        </Link>
      </div>
    </aside>
  )
}
