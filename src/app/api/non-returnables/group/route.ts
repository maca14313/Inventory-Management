import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'

/**
 * POST /api/non-returnables/group
 *   Body: {
 *     personName, personPhone?, personEmail?, personAddress?, notes?,
 *     items: [{ stockOutItemId, quantity, reason, reasonDetail?, notes? }]
 *   }
 *   Creates a NEW NonReturnableRecorder record (NR-YYYY-NNNN) with the person info — mirrors
 *   the ReturnRecorder flow — then processes each stock-out item decision linked to it.
 *   Returns: { recorder, processed, lastError }
 */
export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'non_returnables:create')
    const body = await req.json()
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Validation: items[] required' }, { status: 400 })
    }
    const items = body.items.map((it: any) => ({
      stockOutItemId: parseInt(it.stockOutItemId, 10),
      quantity: parseInt(it.quantity, 10),
      reason: it.reason,
      reasonDetail: it.reasonDetail || undefined,
      notes: it.notes || undefined,
    }))
    // Every item must have a reason
    if (items.some((it: any) => !it.reason)) {
      return NextResponse.json({ error: 'Validation: each item requires a reason' }, { status: 400 })
    }
    const data = await db.nonReturnables.processGroupNonReturnable(ctx, {
      personName: body.personName || '',
      personPhone: body.personPhone || '',
      personEmail: body.personEmail || '',
      personAddress: body.personAddress || '',
      notes: body.notes || '',
      items,
    })
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
