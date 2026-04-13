import type { Role, TeamType } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: Role
      teamType: TeamType
      active: boolean
    }
  }
}

export {}
