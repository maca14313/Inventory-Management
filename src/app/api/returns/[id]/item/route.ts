import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * POST /api/returns/[id]/item
 * Body: { stockOutItemId, quantity, notes? }
 * Adds a return item: stocks back in, creates a Lot source='return',
 * increments the source StockOutItem.returnedQty.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const body = await req.json()
    const data = await db.returns.addItem(ctx, parseInt(id, 10), body)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
