import { NextResponse } from 'next/server'
import { attachments } from '@/lib/attachments'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * GET /api/attachments
 * Query params (all optional):
 *   search, entityType, entityId, branchId, warehouseId,
 *   isImage ('true'|'false'), metaKey, metaValue, dateFrom, dateTo
 * Returns: Attachment[] (tenant-scoped, includes metaFields + uploadedBy)
 */
export async function GET(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const url = new URL(req.url)
    const sp = url.searchParams
    const filters = {
      search: sp.get('search') || undefined,
      entityType: sp.get('entityType') || undefined,
      entityId: sp.get('entityId') ? parseInt(sp.get('entityId')!, 10) : undefined,
      branchId: sp.get('branchId') ? parseInt(sp.get('branchId')!, 10) : undefined,
      warehouseId: sp.get('warehouseId') ? parseInt(sp.get('warehouseId')!, 10) : undefined,
      isImage: sp.get('isImage') === null ? undefined : sp.get('isImage') === 'true',
      metaKey: sp.get('metaKey') || undefined,
      metaValue: sp.get('metaValue') || undefined,
      dateFrom: sp.get('dateFrom') || undefined,
      dateTo: sp.get('dateTo') || undefined,
    }
    const data = await attachments.findMany(ctx, filters)
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}

/**
 * POST /api/attachments  (multipart/form-data)
 * Form fields:
 *   file:        File (required) — the file to zip + store
 *   title:       string (optional)
 *   description: string (optional)
 *   entityType:  string (optional, default 'standalone')
 *   entityId:    number (optional)
 *   branchId:    number (optional)
 *   warehouseId:number (optional)
 *   enterpriseId:number (optional, super_admin only)
 *   metaFields:  JSON string of [{key,value,description}] (optional)
 * Returns: Attachment
 */
export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const form = await req.formData()
    const file = form.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    let metaFields: { key: string; value: string; description: string }[] = []
    const metaRaw = form.get('metaFields')
    if (metaRaw && typeof metaRaw === 'string') {
      try { metaFields = JSON.parse(metaRaw) } catch { metaFields = [] }
    }
    const enterpriseIdRaw = form.get('enterpriseId')
    const data = await attachments.create(ctx, {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileBuffer,
      title: (form.get('title') as string) || '',
      description: (form.get('description') as string) || '',
      entityType: (form.get('entityType') as string) || 'standalone',
      entityId: form.get('entityId') ? parseInt(form.get('entityId') as string, 10) : null,
      branchId: form.get('branchId') ? parseInt(form.get('branchId') as string, 10) : null,
      warehouseId: form.get('warehouseId') ? parseInt(form.get('warehouseId') as string, 10) : null,
      ...(enterpriseIdRaw ? { enterpriseId: parseInt(enterpriseIdRaw as string, 10) } : {}),
      metaFields,
    })
    return NextResponse.json(data)
  } catch (e) { return handleError(e) }
}
