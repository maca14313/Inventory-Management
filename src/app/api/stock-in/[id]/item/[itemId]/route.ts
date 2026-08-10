import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * DELETE /api/stock-in/[id]/item/[itemId]
 * Reverses the Lot (deletes if untouched, reduces if partially consumed)
 * and decrements stock.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await db.stockIn.removeItem(ctx, parseInt(id, 10), parseInt(itemId, 10))
    return NextResponse.json({ ok: true })
  } catch (e) { return handleError(e) }
}
