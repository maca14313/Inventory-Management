import { NextResponse } from 'next/server'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { seedAllExistingUsers } from '@/lib/permissions'

/** POST /api/permissions/seed — seed default permissions for all existing users
 *  who don't have any permission rows yet. Super_admin only. */
export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    if (ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const result = await seedAllExistingUsers()
    return NextResponse.json(result)
  } catch (e) { return handleError(e) }
}
