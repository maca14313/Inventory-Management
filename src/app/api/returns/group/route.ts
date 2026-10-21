import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'

/**
 * POST /api/returns/group
 *   Body: {
 *     personName, personPhone?, personEmail?, personAddress?, notes?,
 *     items: [{ stockOutItemId, quantity, notes? }]
 *   }
 *   Creates a NEW ReturnRecorder record (RET-YYYY-NNNN) with the person info — mirrors
 *   the StockInRecorder flow — then processes each stock-out item return linked to it.
 *   Returns: { recorder, processed, lastError }
 */
export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'returns:create')
    const body = await req.json()
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Validation: items[] required' }, { status: 400 })
    }
    const items = body.items.map((it: any) => ({
      stockOutItemId: parseInt(it.stockOutItemId, 10),
      quantity: parseInt(it.quantity, 10),
      notes: it.notes || undefined,
    }))
    const data = await db.returns.processGroupReturn(ctx, {
      personName: body.personName || '',
      personPhone: body.personPhone || '',
      personEmail: body.personEmail || '',
      personAddress: body.personAddress || '',
      personUserId: body.personUserId ? parseInt(body.personUserId, 10) : (body.personUserId === 0 ? null : undefined),
      notes: body.notes || '',
      items,
    })
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
