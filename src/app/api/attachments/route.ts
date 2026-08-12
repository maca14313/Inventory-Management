import { NextResponse } from 'next/server'
import { attachments } from '@/lib/attachments'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/**
 * GET /api/attachments
 * Query params (all optional):
 *   search, entityType, entityId, branchId, warehouseId,
 *   isImage ('true'|'false'), fileCategory,
 *   metaKey, metaValue, hasMetaKey, hasMetaValue, metaSearch,
 *   dateFrom, dateTo
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
      fileCategory: sp.get('fileCategory') || undefined,
      metaKey: sp.get('metaKey') || undefined,
      metaValue: sp.get('metaValue') || undefined,
      hasMetaKey: sp.get('hasMetaKey') || undefined,
      hasMetaValue: sp.get('hasMetaValue') || undefined,
      metaSearch: sp.get('metaSearch') || undefined,
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
 *   files:       File[] (required, one or more) — bundled into a single ZIP
 *   title:       string (optional)
 *   description: string (optional)
 *   entityType:  string (optional, default 'standalone')
 *                'standalone' | 'stock_in' | 'stock_in_item' | 'stock_out' |
 *                'stock_out_item' | 'return' | 'non_returnable' | 'order' |
 *                'order_item' | 'product'
 *   entityId:    number (optional)
 *   branchId:    number (optional)
 *   warehouseId: number (optional)
 *   enterpriseId:number (optional, super_admin only)
 *   metaFields:  JSON string of [{key,value,description}] (optional)
 *
 * Backward compat: a single field named 'file' is also accepted.
 *
 * Returns: Attachment
 */
export async function POST(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const form = await req.formData()

    // Collect all files: support both 'files' (multiple) and legacy 'file' (single)
    const files: { name: string; mimeType: string; buffer: Buffer }[] = []
    const allEntries = form.getAll('files')
    if (allEntries.length > 0) {
      for (const entry of allEntries) {
        if (entry instanceof File) {
          files.push({ name: entry.name, mimeType: entry.type || 'application/octet-stream', buffer: Buffer.from(await entry.arrayBuffer()) })
        }
      }
    }
    const single = form.get('file')
    if (single instanceof File) {
      files.push({ name: single.name, mimeType: single.type || 'application/octet-stream', buffer: Buffer.from(await single.arrayBuffer()) })
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    let metaFields: { key: string; value: string; description: string }[] = []
    const metaRaw = form.get('metaFields')
    if (metaRaw && typeof metaRaw === 'string') {
      try { metaFields = JSON.parse(metaRaw) } catch { metaFields = [] }
    }
    const enterpriseIdRaw = form.get('enterpriseId')
    const data = await attachments.create(ctx, {
      files,
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
