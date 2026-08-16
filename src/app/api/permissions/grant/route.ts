import { NextResponse } from 'next/server'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { grantPermission } from '@/lib/permissions'

/** POST /api/permissions/grant — grant a permission to a subordinate user.
 *  Body: { targetUserId, ability, canUse?, canDelegate? }
 *  The granter must have canDelegate=true for the ability, and the target must
 *  be a subordinate within the granter's tenant scope. */
export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    if (!ctx.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { targetUserId, ability, canUse, canDelegate } = body || {}
    if (!targetUserId || !ability) {
      return NextResponse.json({ error: 'Validation: targetUserId and ability are required' }, { status: 400 })
    }
    await grantPermission(ctx, parseInt(targetUserId, 10), ability, {
      canUse: canUse ?? true,
      canDelegate: canDelegate ?? false,
    })
    return NextResponse.json({ ok: true })
  } catch (e) { return handleError(e) }
}
