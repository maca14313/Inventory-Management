import { NextResponse } from 'next/server'
import { db, registerItems } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * POST /api/products/register
 * Body: {
 *   warehouseId: number,
 *   items: Array<{ name, sku, description?, categoryId?, price?, cost?, unit?, reorderLevel?, isActive?, quantity, costPerUnit?, supplierName?, notes? }>,
 *   supplierInfo?: { personName?, personPhone?, personEmail?, personAddress?, notes? }  // top-level supplier/person — mirrors Stock In/Out recorder header
 * }
 * Returns: { products: Product[], lotsCreated: number }
 *
 * Change 3 — bulk product registration. This is the ONLY way to create new
 * products. Each item with quantity > 0 creates a Lot (source='register_item')
 * in a single transaction, attributed to the top-level supplier name.
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
    const supplierInfo = body.supplierInfo && typeof body.supplierInfo === 'object'
      ? {
          personName: typeof body.supplierInfo.personName === 'string' ? body.supplierInfo.personName : null,
          personPhone: typeof body.supplierInfo.personPhone === 'string' ? body.supplierInfo.personPhone : null,
          personEmail: typeof body.supplierInfo.personEmail === 'string' ? body.supplierInfo.personEmail : null,
          personAddress: typeof body.supplierInfo.personAddress === 'string' ? body.supplierInfo.personAddress : null,
          notes: typeof body.supplierInfo.notes === 'string' ? body.supplierInfo.notes : null,
        }
      : undefined
    const result = await registerItems(ctx, body.warehouseId, body.items, supplierInfo)
    return NextResponse.json(result)
  } catch (e) { return handleError(e) }
}
