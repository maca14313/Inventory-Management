import { NextResponse } from 'next/server'
import { attachments } from '@/lib/attachments'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const data = await attachments.findById(ctx, parseInt(id, 10))
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}

/**
 * PUT /api/attachments/[id]  (application/json)
 * Body: { title?, description?, entityType?, entityId?, branchId?, warehouseId?, metaFields? }
 * metaFields (if provided) fully replaces existing metadata: [{key,value,description}]
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const body = await req.json()
    const data = await attachments.update(ctx, parseInt(id, 10), body)
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
    await attachments.remove(ctx, parseInt(id, 10))
    return NextResponse.json({ ok: true })
  } catch (e) { return handleError(e) }
}
