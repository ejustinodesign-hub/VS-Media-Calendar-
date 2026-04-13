import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await auth()

  if (!session?.user) redirect("/login")

  const role = (session?.user as any)?.role
  if (role === "ADMIN") redirect("/admin/dashboard")
  if (role === "VIDEOGRAPHER") redirect("/videographer/dashboard")
  redirect("/consultant/dashboard")
}
