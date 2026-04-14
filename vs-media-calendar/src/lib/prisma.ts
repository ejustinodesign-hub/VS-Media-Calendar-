import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set")
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

// Lazy proxy: the PrismaClient is only instantiated on the first actual
// database call, not at module-import time. This prevents build failures
// when DATABASE_URL is not available during static page generation.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!global.__prisma) {
      global.__prisma = createClient()
    }
    const value = (global.__prisma as any)[prop]
    return typeof value === "function" ? value.bind(global.__prisma) : value
  },
})
