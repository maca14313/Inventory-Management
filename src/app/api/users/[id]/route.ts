import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'users:view')
    const data = await db.users.findById(ctx, parseInt(id, 10))
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const body = await req.json()
    // Granular permission checks based on what's being updated
    // Toggle on card sends only {isActive}; Edit dialog sends {username, fullName, email, password?, isActive}
    // Reset password sends {password, mustResetPassword}
    const hasOnlyActive = body.isActive !== undefined && body.password === undefined && body.username === undefined && body.fullName === undefined && body.email === undefined && body.role === undefined
    if (hasOnlyActive) {
      await requirePermission(ctx, 'users:toggle_active')
    } else if (body.password !== undefined) {
      await requirePermission(ctx, 'users:reset_password')
    } else {
      await requirePermission(ctx, 'users:edit')
    }
    const data = await db.users.update(ctx, parseInt(id, 10), body)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'users:delete')
    await db.users.remove(ctx, parseInt(id, 10))
    return NextResponse.json({ ok: true })
  } catch (e) { return handleError(e) }
}
