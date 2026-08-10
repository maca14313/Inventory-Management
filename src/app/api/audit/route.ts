import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * GET /api/audit?limit=N
 * Returns recent audit log entries (joined with user.fullName as userName).
 */
export async function GET(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const url = new URL(req.url)
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : undefined
    const data = await db.audit.findMany(ctx, limit)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
