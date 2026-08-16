import { NextResponse } from 'next/server'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { grantPermission, canManageTarget, resolvePermissions } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

/** GET /api/permissions/subordinates — list users whose permissions the current admin can manage. */
export async function GET(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    if (!ctx.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (ctx.role === 'warehouse_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get subordinates
    const { getSubordinateUsers } = await import('@/lib/permissions')
    const subs = await getSubordinateUsers(ctx)

    // For each subordinate, fetch their current permissions
    const enriched = await Promise.all(subs.map(async (s) => {
      const rows = await prisma.userPermission.findMany({
        where: { userId: s.id },
        orderBy: { ability: 'asc' },
      })
      const resolved = await resolvePermissions(s.id, s.role)
      return {
        ...s,
        permissions: rows.map(r => ({ ability: r.ability, canUse: r.canUse, canDelegate: r.canDelegate })),
        permCount: resolved.permissions.size,
        delegateCount: resolved.delegatable.size,
      }
    }))

    return NextResponse.json(enriched)
  } catch (e) { return handleError(e) }
}
