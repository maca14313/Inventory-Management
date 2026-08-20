import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * POST /api/returns/process
 * Body: { stockOutItemId, quantity, notes? }
 * Single-item return convenience: creates a ReturnRecorder (using the source
 * stock-out recorder's person info) + one ReturnItem in one transaction.
 * Stocks the quantity back in and creates a Lot source='return'.
 */
export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const body = await req.json()
    const data = await db.returns.processSingle(ctx, body)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
