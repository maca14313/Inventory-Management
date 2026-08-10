import { NextResponse } from 'next/server'
import { db, registerItems } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * POST /api/products/register
 * Body: { warehouseId: number, items: Array<{ name, sku, description?, categoryId?, price?, cost?, unit?, reorderLevel?, isActive?, quantity, costPerUnit?, supplierName?, notes? }> }
 * Returns: { products: Product[], lotsCreated: number }
 *
 * Change 3 — bulk product registration. Each item with quantity > 0 creates
 * a Lot (source='register_item') in a single transaction.
 */
export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const body = await req.json()
    if (!body || typeof body.warehouseId !== 'number') {
      return NextResponse.json({ error: 'Validation: warehouseId is required' }, { status: 400 })
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Validation: items[] must be a non-empty array' }, { status: 400 })
    }
    const result = await registerItems(ctx, body.warehouseId, body.items)
    return NextResponse.json(result)
  } catch (e) { return handleError(e) }
}
