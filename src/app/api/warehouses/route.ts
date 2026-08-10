import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

export async function GET(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const url = new URL(req.url)
    const eidParam = url.searchParams.get('eid')
    const bidParam = url.searchParams.get('bid')
    const eid = eidParam ? parseInt(eidParam, 10) : undefined
    const bid = bidParam ? parseInt(bidParam, 10) : undefined
    const data = await db.warehouses.findMany(ctx, eid, bid)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}

export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const body = await req.json()
    const data = await db.warehouses.create(ctx, body)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
