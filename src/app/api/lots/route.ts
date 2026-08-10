import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * GET /api/lots
 * Query params (Change 2):
 *   ?productId=X&warehouseId=Y → db.lots.findByProductWarehouse(ctx, productId, warehouseId)
 *   ?productId=X               → db.lots.findByProduct(ctx, productId)
 *   (none)                     → db.lots.findMany(ctx, optional openOnly=1)
 *
 * Returns: Lot[]  (each Lot has derived status: 'open' | 'closed')
 */
export async function GET(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const url = new URL(req.url)
    const productIdParam = url.searchParams.get('productId')
    const warehouseIdParam = url.searchParams.get('warehouseId')
    const openOnlyParam = url.searchParams.get('openOnly')

    if (productIdParam && warehouseIdParam) {
      const data = await db.lots.findByProductWarehouse(ctx, parseInt(productIdParam, 10), parseInt(warehouseIdParam, 10))
      return NextResponse.json(data)
    }
    if (productIdParam) {
      const data = await db.lots.findByProduct(ctx, parseInt(productIdParam, 10))
      return NextResponse.json(data)
    }
    const openOnly = openOnlyParam === '1' || openOnlyParam === 'true'
    const data = await db.lots.findMany(ctx, openOnly ? { openOnly: true } : undefined)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
