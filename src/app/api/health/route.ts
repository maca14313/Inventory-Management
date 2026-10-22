/**
 * GET /api/health — the deployment guide's observability window (§5.4).
 * 200 + JSON when everything is up; 503 with details when the DB is down.
 * Never throws, never leaks secrets.
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, unknown> = { app: 'ok', backend: 'sqlite' }
  let healthy = true
  const requestId = 'req-' + Math.random().toString(36).slice(2, 10)
  try {
    const { ping, schemaReady } = await import('@/lib/sqlite')
    ping()
    checks.database = 'ok'
    checks.schema = schemaReady() ? 'ok' : 'incomplete'
    if (!schemaReady()) { healthy = false; checks.schemaError = 'base tables missing' }
  } catch (err) {
    healthy = false
    checks.database = 'error'
    checks.databaseError = err instanceof Error ? err.message : String(err)
  }
  return NextResponse.json(
    { ok: healthy, status: healthy ? 200 : 503, checks, requestId, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  )
}
