import { NextResponse } from 'next/server'
import { attachments } from '@/lib/attachments'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import fs from 'fs'
import zlib from 'zlib'

/**
 * GET /api/attachments/[id]/download[?inline=1]
 * Returns the original (decompressed) file with proper Content-Type.
 *   - default:                Content-Disposition: attachment (forces download)
 *   - ?inline=1:              Content-Disposition: inline (for <img src> previews)
 * Tenant-checked. The file is stored gzipped on disk and decompressed on the fly.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const info = await attachments.getDownloadInfo(ctx, parseInt(id, 10))
    if (!info) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!fs.existsSync(info.filePath)) {
      return NextResponse.json({ error: 'File missing on disk' }, { status: 410 })
    }
    const gzipped = fs.readFileSync(info.filePath)
    let original: Buffer
    try {
      original = zlib.gunzipSync(gzipped)
    } catch {
      original = gzipped // not gzipped (legacy/edge) — serve raw
    }
    const url = new URL(req.url)
    const inline = url.searchParams.get('inline') === '1'
    const disposition = inline
      ? `inline; filename="${info.fileName.replace(/"/g, '')}"`
      : `attachment; filename="${info.fileName.replace(/"/g, '')}"`
    return new NextResponse(new Uint8Array(original), {
      status: 200,
      headers: {
        'Content-Type': info.mimeType || 'application/octet-stream',
        'Content-Disposition': disposition,
        'Content-Length': String(original.length),
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (e) { return handleError(e) }
}
