import type { Metadata } from "next"
import "./globals.css"
import { SessionProvider } from "next-auth/react"
import { auth } from "@/auth"

export const metadata: Metadata = {
  title: "VS.Media Calendar",
  description: "Plataforma de agendamento de serviços de vídeo e fotografia imobiliária",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Graceful fallback: auth() may throw if NEXTAUTH_SECRET is not set (demo mode)
  let session = null
  try {
    session = await auth()
  } catch {
    // running without auth config — demo mode works fine
  }

  return (
    <html lang="pt" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 antialiased">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  )
}
