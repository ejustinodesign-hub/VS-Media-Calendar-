import { DemoSidebar } from "@/components/layout/demo-sidebar"

export default function DemoAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <DemoSidebar role="admin" />
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50">{children}</main>
    </div>
  )
}
