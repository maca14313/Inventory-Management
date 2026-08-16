import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'

/**
 * GET /api/features?eid=N — list features (optionally scoped by enterprise).
 *
 * POST /api/features — toggle a feature.
 *   Body: { enterpriseId: number, feature: string, enabled: boolean }
 *   Calls db.features.update(ctx, enterpriseId, feature, enabled).
 *   (This is the shape the frontend page.tsx ~line 787 sends.)
 */
export async function GET(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'features:view')
    const url = new URL(req.url)
    const eidParam = url.searchParams.get('eid')
    const eid = eidParam ? parseInt(eidParam, 10) : undefined
    const data = await db.features.findMany(ctx, eid)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}

export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'features:edit')
    const body = await req.json()
    const { enterpriseId, feature, enabled } = body || {}
    if (typeof enterpriseId !== 'number' || typeof feature !== 'string' || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Validation: enterpriseId (number), feature (string), enabled (boolean) are required' },
        { status: 400 },
      )
    }
    const data = await db.features.update(ctx, enterpriseId, feature, enabled)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
