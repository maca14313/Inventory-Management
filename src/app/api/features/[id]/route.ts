import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'

/**
 * PUT /api/features/[id]
 *   `id` is the enterpriseId.
 *   Body: { feature: string, enabled: boolean }
 *   Calls db.features.update(ctx, enterpriseId, feature, enabled).
 *
 * (POST /api/features is the primary entry point the frontend uses;
 *  this PUT is a thin alternative for REST-style callers.)
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'features:edit')
    const body = await req.json()
    const { feature, enabled } = body || {}
    if (typeof feature !== 'string' || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Validation: feature (string) and enabled (boolean) are required' },
        { status: 400 },
      )
    }
    const enterpriseId = parseInt(id, 10)
    const data = await db.features.update(ctx, enterpriseId, feature, enabled)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
