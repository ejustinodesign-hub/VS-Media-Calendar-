"use client"

import { useSession } from "next-auth/react"
import { Bell, Menu } from "lucide-react"

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession()

  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button className="relative w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors">
          <Bell className="w-4 h-4 text-slate-600" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#e94560] text-white text-[10px] rounded-full flex items-center justify-center font-bold">
            3
          </span>
        </button>
        <div className="flex items-center gap-2">
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || ""}
              className="w-8 h-8 rounded-full border border-slate-200"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#0f3460] flex items-center justify-center text-white text-xs font-bold">
              {session?.user?.name?.[0] || "U"}
            </div>
          )}
          <span className="text-sm font-medium text-slate-700 hidden sm:block">
            {session?.user?.name?.split(" ")[0]}
          </span>
        </div>
      </div>
    </header>
  )
}
