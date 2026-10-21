import { NextResponse } from 'next/server'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { resolvePermissions, ALL_PERMISSIONS, PERMISSION_GROUPS } from '@/lib/permissions'
import { orm } from '@/lib/orm'

/** GET /api/permissions — list the current user's permissions + delegatable abilities.
 *  Also returns the full permission catalog (for UI rendering). */
export async function GET(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    if (!ctx.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolvePermissions(ctx.userId, ctx.role)

    // For super_admin, return the full catalog with everything enabled
    if (resolved.isSuperAdmin) {
      return NextResponse.json({
        isSuperAdmin: true,
        permissions: Array.from(resolved.permissions).sort(),
        delegatable: Array.from(resolved.delegatable).sort(),
        catalog: ALL_PERMISSIONS,
        groups: PERMISSION_GROUPS,
        raw: [],
      })
    }

    // For non-super: fetch raw rows so the UI can show canUse/canDelegate per ability
    const raw = await orm.userPermission.findMany({
      where: { userId: ctx.userId },
      orderBy: { ability: 'asc' },
    })

    return NextResponse.json({
      isSuperAdmin: false,
      permissions: Array.from(resolved.permissions).sort(),
      delegatable: Array.from(resolved.delegatable).sort(),
      catalog: ALL_PERMISSIONS,
      groups: PERMISSION_GROUPS,
      raw: raw.map(r => ({ ability: r.ability, canUse: r.canUse, canDelegate: r.canDelegate, grantedById: r.grantedById })),
    })
  } catch (e) { return handleError(e) }
}
