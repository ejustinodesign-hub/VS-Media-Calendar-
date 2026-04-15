import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export type UserRole = "CONSULTANT" | "VIDEOGRAPHER" | "ADMIN"
export type UserTeamType = "INTERNAL" | "EXTERNAL"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: UserRole
      teamType: UserTeamType
      active: boolean
    }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      // Required so pre-invited users (created by admin) get linked
      // to their Google account on first sign-in
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, teamType: true, active: true },
        })
        if (dbUser) {
          (session.user as any).role = dbUser.role
          ;(session.user as any).teamType = dbUser.teamType
          ;(session.user as any).active = dbUser.active
        }
      }
      return session
    },
    async signIn({ user }) {
      if (!user.email) return false
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { active: true },
      })
      // Only allow users pre-approved by admin (active: true)
      // New OAuth sign-ins without a pre-existing record are denied
      return dbUser?.active === true
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "database",
  },
})
