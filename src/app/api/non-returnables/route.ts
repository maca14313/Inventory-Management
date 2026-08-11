import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * GET /api/non-returnables?recorders=1
 *   Lists NonReturnableRecorder records (group "mark as non-returnable" decisions).
 *
 * GET /api/non-returnables?tab=flagged&wid=N
 *   Lists flagged stock-out items eligible for the non-returnable decision. This reuses
 *   db.returns.findReturnable(tab='flagged') because that function already returns
 *   nonReturnableQty + remainingQty for each flagged item, so the same data drives both the
 *   Returns page and the Non-Returnable decision UI.
 */
export async function GET(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const url = new URL(req.url)
    if (url.searchParams.get('recorders') === '1') {
      const data = await db.nonReturnables.findRecorders(ctx)
      return NextResponse.json(data)
    }
    const widParam = url.searchParams.get('wid')
    const warehouseId = widParam ? parseInt(widParam, 10) : undefined
    const data = await db.returns.findReturnable(ctx, { tab: 'flagged', warehouseId })
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}

/**
 * POST /api/non-returnables
 *   Body: { stockOutItemId, quantity, reason, reasonDetail?, notes? }
 *   Processes a single "mark as non-returnable" decision: creates a NonReturnable record
 *   (no stock change). The reason must be one of NON_RETURNABLE_REASONS.
 */
export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const body = await req.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Validation: body required' }, { status: 400 })
    }
    if (!body.reason || typeof body.reason !== 'string') {
      return NextResponse.json({ error: 'Validation: reason is required' }, { status: 400 })
    }
    const data = await db.nonReturnables.processNonReturnable(ctx, {
      stockOutItemId: parseInt(body.stockOutItemId, 10),
      quantity: parseInt(body.quantity, 10),
      reason: body.reason,
      reasonDetail: body.reasonDetail || undefined,
      notes: body.notes || undefined,
    })
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
