import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { handleError } from '@/lib/route-utils'

const COOKIE_NAME = 'ims-session'

/** Public shape returned to the client (no passwordHash). */
function publicUser(u: {
  id: number; username: string; fullName: string; email: string
  role: string; enterpriseId: number | null; branchId: number | null
  warehouseId: number | null; isActive: boolean; mustResetPassword: boolean
}) {
  return {
    id: u.id, username: u.username, fullName: u.fullName, email: u.email,
    role: u.role, enterpriseId: u.enterpriseId, branchId: u.branchId,
    warehouseId: u.warehouseId, isActive: u.isActive, mustResetPassword: u.mustResetPassword,
  }
}

/** GET /api/auth — return the current logged-in user (or 401). */
export async function GET() {
  try {
    const store = await cookies()
    const raw = store.get(COOKIE_NAME)?.value
    if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    let user: unknown
    try { user = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    return NextResponse.json(user)
  } catch (e) { return handleError(e) }
}

/** POST /api/auth — login (default) or logout (when body.action === 'logout'). */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const store = await cookies()

    // Logout
    if (body?.action === 'logout') {
      store.delete(COOKIE_NAME)
      return NextResponse.json({ ok: true })
    }

    // Login
    const { username, password } = body || {}
    if (!username || !password) {
      return NextResponse.json({ error: 'Validation: username and password are required' }, { status: 400 })
    }
    const user = await db.users.authenticate(username, password)
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const pub = publicUser(user)
    store.set(COOKIE_NAME, JSON.stringify(pub), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })
    return NextResponse.json(pub)
  } catch (e) { return handleError(e) }
}

/** DELETE /api/auth — explicit logout. */
export async function DELETE() {
  try {
    const store = await cookies()
    store.delete(COOKIE_NAME)
    return NextResponse.json({ ok: true })
  } catch (e) { return handleError(e) }
}
