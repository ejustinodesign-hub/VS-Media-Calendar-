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
      onboardingCompleted: boolean
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
          select: { role: true, teamType: true, active: true, onboardingCompleted: true, name: true, image: true },
        })
        if (dbUser) {
          // Expose db fields on session
          session.user.name = dbUser.name
          session.user.image = dbUser.image
          ;(session.user as any).role = dbUser.role
          ;(session.user as any).teamType = dbUser.teamType
          ;(session.user as any).active = dbUser.active
          ;(session.user as any).onboardingCompleted = dbUser.onboardingCompleted
        }
      }
      return session
    },
    async signIn({ user, profile }) {
      if (!user.email) return false
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { active: true, name: true, image: true },
      })
      // Only allow users pre-approved by admin (active: true)
      if (dbUser?.active !== true) return false

      // Sync name + photo from Google only if not manually overridden
      const googleName = (profile as any)?.name || user.name || null
      const googleImage = (profile as any)?.picture || user.image || null
      const updateData: Record<string, string> = {}
      // Only set name from Google if user has no name yet
      if (googleName && !dbUser.name) updateData.name = googleName
      // Only set image from Google if user has no image, or if current image is already a Google URL
      // (preserve manually uploaded avatars stored on Vercel Blob)
      if (googleImage && (!dbUser.image || dbUser.image.includes("googleusercontent.com"))) {
        updateData.image = googleImage
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({ where: { email: user.email }, data: updateData })
      }

      return true
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
