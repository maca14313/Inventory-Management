import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'

/**
 * GET /api/returns/[id]?id=stockOutItemId
 *   Returns one stock-out item with: product, recorder (with all its items+products), returns[].
 *   Used by the source-record dialog on the Returns page.
 *
 * Note: [id] here is the stockOutItemId (NOT a Return.id) — the source-record dialog
 * shows "from what record this stock-out came" + the return history for that item.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'returns:view')
    const data = await db.returns.findItemById(ctx, parseInt(id, 10))
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
