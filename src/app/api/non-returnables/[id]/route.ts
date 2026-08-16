import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'

/**
 * GET /api/non-returnables/[id]?id=stockOutItemId
 *   Returns one stock-out item with: product, recorder (with all its items+products), returns[],
 *   nonReturnables[]. Used by the source-record dialog (which now shows BOTH the return history
 *   AND the non-returnable decision history for that item).
 *
 * Reuses db.returns.findItemById because that function now includes nonReturnables + computes
 * nonReturnableQty + remainingQty (qty - returned - nonReturnable).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'non_returnables:view')
    const data = await db.returns.findItemById(ctx, parseInt(id, 10))
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
