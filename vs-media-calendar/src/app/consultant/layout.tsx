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
  const user = session.user as any
  if (user.role !== "CONSULTANT" && user.role !== "ADMIN") redirect("/login")
  if (user.role === "CONSULTANT" && !user.onboardingCompleted) redirect("/onboarding")

  return <AppShell>{children}</AppShell>
}
