import { NextResponse } from 'next/server'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { revokePermission } from '@/lib/permissions'

/** POST /api/permissions/revoke — revoke a permission from a subordinate user.
 *  Body: { targetUserId, ability } */
export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    if (!ctx.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { targetUserId, ability } = body || {}
    if (!targetUserId || !ability) {
      return NextResponse.json({ error: 'Validation: targetUserId and ability are required' }, { status: 400 })
    }
    await revokePermission(ctx, parseInt(targetUserId, 10), ability)
    return NextResponse.json({ ok: true })
  } catch (e) { return handleError(e) }
}
