import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export const DEFAULT_USER_ID = "default"

export async function ensureDefaultUser(): Promise<void> {
  const existing = await db.user.findUnique({ where: { id: DEFAULT_USER_ID } })
  if (!existing) {
    await db.user.create({
      data: {
        id: DEFAULT_USER_ID,
        email: "default@hermes.app",
        name: "HERMÈS User",
      },
    })
  }
}
