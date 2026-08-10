/**
 * Prisma Client Singleton (raw Prisma access)
 *
 * This file exports `prisma` — the raw PrismaClient. The domain layer
 * (`src/lib/db.ts`) imports this and exposes a higher-level `db` object
 * with tenant-scoped methods. API routes use the domain `db`, while
 * `prisma` is used internally by db.ts and by seed.ts.
 *
 * PRISMA_CLIENT_VERSION is a hot-reload stamp: after `db:push` regenerates
 * the Prisma client, bump this string to force the dev server to drop the
 * cached singleton and pick up the new client (prevents "unknown field"
 * errors during iterative schema development).
 */

import { PrismaClient } from '@prisma/client'

export const PRISMA_CLIENT_VERSION = 'ims-v1-20250810-returnrec'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __prismaVersion?: string
}

// Re-instantiate if version changed (picks up regenerated client after db:push)
if (globalForPrisma.prisma && globalForPrisma.__prismaVersion !== PRISMA_CLIENT_VERSION) {
  globalForPrisma.prisma = undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.__prismaVersion = PRISMA_CLIENT_VERSION
}
