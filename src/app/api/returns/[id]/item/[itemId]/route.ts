import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * DELETE /api/returns/[id]/item/[itemId]
 * Reverses a return item: decrements stock, deletes the return Lot,
 * decrements the source StockOutItem.returnedQty.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await db.returns.removeItem(ctx, parseInt(id, 10), parseInt(itemId, 10))
    return NextResponse.json({ ok: true })
  } catch (e) { return handleError(e) }
}
