import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"

export default async function ConsultantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if ((session?.user as any)?.role !== "CONSULTANT" && (session?.user as any)?.role !== "ADMIN") {
    redirect("/login")
  }

  return <AppShell>{children}</AppShell>
}
