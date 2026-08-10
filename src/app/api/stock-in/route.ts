import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

export async function GET(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const url = new URL(req.url)
    const eidParam = url.searchParams.get('eid')
    const widParam = url.searchParams.get('wid')
    const eid = eidParam ? parseInt(eidParam, 10) : undefined
    const wid = widParam ? parseInt(widParam, 10) : undefined
    const data = await db.stockIn.findMany(ctx, eid, wid)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}

export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const body = await req.json()
    const data = await db.stockIn.create(ctx, body)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
