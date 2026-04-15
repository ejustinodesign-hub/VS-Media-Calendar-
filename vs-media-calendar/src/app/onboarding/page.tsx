import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { OnboardingForm } from "./onboarding-form"

export default async function OnboardingPage() {
  const session = await auth()

  if (!session?.user) redirect("/login")

  const user = session.user as any
  const role = user.role as string

  // Admins skip onboarding
  if (role === "ADMIN") redirect("/admin/dashboard")

  // Already completed — go to dashboard
  if (user.onboardingCompleted) {
    if (role === "VIDEOGRAPHER") redirect("/videographer/dashboard")
    redirect("/consultant/dashboard")
  }

  return <OnboardingForm role={role} />
}
