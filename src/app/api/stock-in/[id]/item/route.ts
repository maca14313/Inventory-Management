import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'

/**
 * POST /api/stock-in/[id]/item
 * Body: Partial<StockInItem> = { productId, warehouseId, quantity, unit?, costPerUnit?, notes? }
 * Creates a Lot source='stock_in', increments stock.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'stock_in:edit')
    const body = await req.json()
    const data = await db.stockIn.addItem(ctx, parseInt(id, 10), body)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
