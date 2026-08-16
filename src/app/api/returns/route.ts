import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'

/**
 * GET /api/returns?tab=flagged|not_flagged&wid=N
 *   Lists stock-out items eligible for return, split by tab.
 *   - tab=flagged     → isReturnable=true  AND remaining > 0
 *   - tab=not_flagged → isReturnable=false AND remaining > 0
 *   Each item carries: product, recorder, returnedQty, remainingQty, returns[].
 */
export async function GET(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'returns:view')
    const url = new URL(req.url)
    // GET /api/returns?recorders=1 → list ReturnRecorder records (group-return records)
    if (url.searchParams.get('recorders') === '1') {
      const data = await db.returns.findRecorders(ctx)
      return NextResponse.json(data)
    }
    const tabParam = url.searchParams.get('tab') || 'flagged'
    const widParam = url.searchParams.get('wid')
    const tab: 'flagged' | 'not_flagged' = tabParam === 'not_flagged' ? 'not_flagged' : 'flagged'
    const warehouseId = widParam ? parseInt(widParam, 10) : undefined
    const data = await db.returns.findReturnable(ctx, { tab, warehouseId })
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}

/**
 * POST /api/returns
 *   Body: { stockOutItemId, quantity, notes? }
 *   Processes a single return: creates Return record, increments stock (via Lot source='adjustment'),
 *   updates StockOutRecorder status.
 */
export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'returns:create')
    const body = await req.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Validation: body required' }, { status: 400 })
    }
    const data = await db.returns.processReturn(ctx, {
      stockOutItemId: parseInt(body.stockOutItemId, 10),
      quantity: parseInt(body.quantity, 10),
      notes: body.notes || undefined,
    })
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
