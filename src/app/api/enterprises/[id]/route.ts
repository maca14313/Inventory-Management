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
    await requirePermission(ctx, 'enterprises:view')
    const numId = parseInt(id, 10)
    const data = await db.enterprises.findById(ctx, numId)
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
    // Determine the permission based on what's being updated
    const body = await req.json()
    // If toggling isActive, require toggle_active; if changing limits, require set_limits; otherwise edit
    if (body.isActive !== undefined) {
      await requirePermission(ctx, 'enterprises:toggle_active')
    } else if (body.maxBranches !== undefined || body.maxWarehouses !== undefined || body.maxUsers !== undefined) {
      await requirePermission(ctx, 'enterprises:set_limits')
    } else {
      await requirePermission(ctx, 'enterprises:edit')
    }
    const data = await db.enterprises.update(ctx, parseInt(id, 10), body)
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
    await requirePermission(ctx, 'enterprises:delete')
    await db.enterprises.remove(ctx, parseInt(id, 10))
    return NextResponse.json({ ok: true })
  } catch (e) { return handleError(e) }
}
