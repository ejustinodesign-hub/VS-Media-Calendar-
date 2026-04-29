import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { ProfileForm } from "@/app/consultant/profile/profile-form"

export default async function VideographerProfilePage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      phone: true,
      billingName: true,
      billingCompany: true,
      billingNif: true,
      billingAddress: true,
    },
  })

  if (!user) redirect("/login")

  return (
    <>
      <Header title="O Meu Perfil" subtitle="Dados pessoais e de faturação" />
      <div className="flex-1 p-6 max-w-2xl">
        <ProfileForm user={user} />
      </div>
    </>
  )
}
