import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'

export async function GET(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'suppliers:view')
    const url = new URL(req.url)
    const eidParam = url.searchParams.get('eid')
    const eid = eidParam ? parseInt(eidParam, 10) : undefined
    const data = await db.suppliers.findMany(ctx, eid)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}

export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'suppliers:create')
    const body = await req.json()
    const data = await db.suppliers.create(ctx, body)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
