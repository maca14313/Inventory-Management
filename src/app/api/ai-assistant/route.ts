import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * POST /api/ai-assistant
 * Body: { message: string }
 *
 * Backend-only consumer of z-ai-web-dev-sdk (SESSION_HANDOFF.md §5.5).
 * Builds a small inventory-context string from the dashboard stats so the
 * LLM can answer stock/product/lot questions with live data.
 */
export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const body = await req.json().catch(() => ({}))
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    if (!message) {
      return NextResponse.json({ error: 'Validation: message is required' }, { status: 400 })
    }

    // Build an inventory context string (best-effort — never fail the request
    // if dashboard stats aren't accessible).
    let context = ''
    try {
      const s = await db.dashboard.stats(ctx)
      const lowStockList = s.lowStockProducts
        .map((p) => `${p.name} (${p.totalQty}≤${p.reorderLevel})`)
        .join(', ')
      context =
        `Live inventory snapshot: ${s.productCount} products across ` +
        `${s.warehouseCount} warehouses, total stock value $${s.totalStockValue.toFixed(2)}, ` +
        `${s.openLots} open lots (of ${s.totalLots} total), ${s.stockInCount} stock-in recorders, ` +
        `${s.stockOutCount} stock-out recorders, ${s.pendingOrderCount} pending orders. ` +
        `Low stock items: ${lowStockList || 'none'}.`
    } catch {
      // ignore — context is optional
    }

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You are an inventory management assistant. Help the user with stock, products, orders, lots, and warehouse questions. Be concise and practical. ' +
            context,
        },
        { role: 'user', content: message },
      ],
      thinking: { type: 'disabled' },
    })

    const reply = completion.choices[0]?.message?.content || 'I could not process that.'
    return NextResponse.json({ reply })
  } catch (e) {
    return handleError(e)
  }
}
