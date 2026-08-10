import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * DELETE /api/stock-out/[id]/item/[itemId]
 * Restores lot remainingQty (or creates a reversal Lot) and increments stock.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await db.stockOut.removeItem(ctx, parseInt(id, 10), parseInt(itemId, 10))
    return NextResponse.json({ ok: true })
  } catch (e) { return handleError(e) }
}
