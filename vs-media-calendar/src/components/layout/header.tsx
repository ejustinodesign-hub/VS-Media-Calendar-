"use client"

import { useSession } from "next-auth/react"
import { Bell, Menu } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useSidebar } from "./sidebar-context"

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession()
  const { toggle } = useSidebar()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={toggle}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h2 className="text-lg md:text-xl font-bold text-slate-900 truncate">{title}</h2>
          {subtitle && (
            <p className="text-xs md:text-sm text-slate-500 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {/* Notifications */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="relative w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <Bell className="w-4 h-4 text-slate-600" />
          </button>

          {open && (
            <div className="absolute right-0 top-11 w-72 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/60 z-50">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">Notificações</p>
              </div>
              <div className="py-10 flex flex-col items-center justify-center text-slate-400">
                <Bell className="w-7 h-7 mb-2 opacity-30" />
                <p className="text-sm">Sem notificações</p>
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
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
