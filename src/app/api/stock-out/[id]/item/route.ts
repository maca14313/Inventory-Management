import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * POST /api/stock-out/[id]/item
 * Body: Partial<StockOutItem> = { productId, warehouseId, quantity, unit?, isReturnable?, returnDeadline?, notes? }
 * Performs FIFO lot deduction; throws if stock insufficient (mapped to 400).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const body = await req.json()
    const data = await db.stockOut.addItem(ctx, parseInt(id, 10), body)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
