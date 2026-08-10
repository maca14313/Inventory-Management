import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * POST /api/returns/group
 *   Body: { items: [{ stockOutItemId, quantity, notes? }] }
 *   Processes a group return — multiple stock-out items in one call (e.g. all items from one supplier/person).
 *   Stops on first error (e.g. insufficient remaining).
 *   Returns: { processed, lastError }
 */
export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const body = await req.json()
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Validation: items[] required' }, { status: 400 })
    }
    const items = body.items.map((it: any) => ({
      stockOutItemId: parseInt(it.stockOutItemId, 10),
      quantity: parseInt(it.quantity, 10),
      notes: it.notes || undefined,
    }))
    const data = await db.returns.processGroupReturn(ctx, items)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
