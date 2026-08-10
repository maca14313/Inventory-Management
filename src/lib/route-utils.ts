import { NextResponse } from 'next/server'

/**
 * Centralised error mapping for API routes.
 *
 * Contract (SESSION_HANDOFF.md §5.6):
 *   'FORBIDDEN'        → 403 { error: 'Forbidden' }
 *   'Not found'        → 404 { error: 'Not found' }
 *   'Validation: ...'  → 400 { error: msg }
 *   anything else      → 500 { error: 'Internal server error' }
 */
export function handleError(e: unknown) {
  const msg = e instanceof Error ? e.message : 'Unknown error'
  console.error('[handleError]', msg)
  if (msg === 'FORBIDDEN' || msg.startsWith('FORBIDDEN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (msg === 'Not found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (msg.startsWith('Validation')) {
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
