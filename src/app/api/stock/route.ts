import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'

export async function GET(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'stock:view')
    const data = await db.stock.findMany(ctx)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}

/**
 * POST /api/stock
 * Body shape (matches frontend src/app/page.tsx):
 *   - { action: 'stockIn',  productId, warehouseId, quantity, unit?, costPerUnit?, supplierName?, notes? }
 *   - { action: 'adjust',   productId, warehouseId, newQuantity, unit?, costPerUnit?, notes? }
 *
 * stockIn  → db.stock.stockIn  (creates Lot source='adjustment')
 * adjust   → db.stock.adjust   (creates Lot for positive delta)
 */
export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'stock:adjust')
    const body = await req.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Validation: body required' }, { status: 400 })
    }
    if (body.action === 'stockIn') {
      const { productId, warehouseId, quantity, unit, costPerUnit, supplierName, notes, conditionId } = body
      if (typeof productId !== 'number' || typeof warehouseId !== 'number' || typeof quantity !== 'number') {
        return NextResponse.json({ error: 'Validation: productId, warehouseId, quantity are required numbers' }, { status: 400 })
      }
      const data = await db.stock.stockIn(ctx, { productId, warehouseId, quantity, unit, costPerUnit, supplierName, notes, conditionId: typeof conditionId === 'number' ? conditionId : null })
      return NextResponse.json(data)
    }
    if (body.action === 'adjust') {
      const { productId, warehouseId, newQuantity, unit, costPerUnit, notes } = body
      if (typeof productId !== 'number' || typeof warehouseId !== 'number' || typeof newQuantity !== 'number') {
        return NextResponse.json({ error: 'Validation: productId, warehouseId, newQuantity are required numbers' }, { status: 400 })
      }
      const data = await db.stock.adjust(ctx, { productId, warehouseId, newQuantity, unit, costPerUnit, notes })
      return NextResponse.json(data)
    }
    return NextResponse.json({ error: 'Validation: action must be "stockIn" or "adjust"' }, { status: 400 })
  } catch (e) { return handleError(e) }
}
