import { NextResponse } from 'next/server'
import { attachments } from '@/lib/attachments'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'
import fs from 'fs'
import zlib from 'zlib'

/**
 * GET /api/attachments/[id]/download
 *
 * Query params:
 *   inline:     '1' to send Content-Disposition: inline (for <img src> previews)
 *   fileIndex:  number — extract and serve a single entry from the ZIP archive
 *               (used for image previews of single-file zips; multi-file zips
 *                can preview a specific entry by index). When omitted, the
 *                whole ZIP file is served for download.
 *
 * Behavior:
 *   - Whole-zip download:  Content-Type "application/zip", filename = "<original>.zip"
 *   - fileIndex=N:         Serves entry N with its original mime type; inline
 *                          disposition forces inline preview for images.
 *   - Legacy .gz files:    Gunzipped on the fly (backward compat).
 *
 * Tenant-checked.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'attachments:view')
    const url = new URL(req.url)
    const inline = url.searchParams.get('inline') === '1'
    const fileIndexRaw = url.searchParams.get('fileIndex')
    const fileIndex = fileIndexRaw !== null ? parseInt(fileIndexRaw, 10) : null

    // Single-entry extraction path
    if (fileIndex !== null && !Number.isNaN(fileIndex)) {
      const entry = await attachments.extractEntry(ctx, parseInt(id, 10), fileIndex)
      if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
      const disposition = inline
        ? `inline; filename="${entry.entryName.replace(/"/g, '')}"`
        : `attachment; filename="${entry.entryName.replace(/"/g, '')}"`
      return new NextResponse(new Uint8Array(entry.buffer), {
        status: 200,
        headers: {
          'Content-Type': entry.mimeType || 'application/octet-stream',
          'Content-Disposition': disposition,
          'Content-Length': String(entry.buffer.length),
          'Cache-Control': 'private, max-age=60',
        },
      })
    }

    // Whole-file download path
    const info = await attachments.getDownloadInfo(ctx, parseInt(id, 10))
    if (!info) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!fs.existsSync(info.filePath)) {
      return NextResponse.json({ error: 'File missing on disk' }, { status: 410 })
    }

    // Legacy .gz? gunzip and serve the single original file
    if (info.filePath.endsWith('.gz')) {
      const gzipped = fs.readFileSync(info.filePath)
      let original: Buffer
      try { original = zlib.gunzipSync(gzipped) } catch { original = gzipped }
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
    }

    // Modern .zip path — serve the whole archive
    const stat = fs.statSync(info.filePath)
    const zipFileName = info.fileName.replace(/\.[^.]+$/, '') + '.zip'
    const disposition = inline
      ? `inline; filename="${zipFileName.replace(/"/g, '')}"`
      : `attachment; filename="${zipFileName.replace(/"/g, '')}"`
    const stream = fs.createReadStream(info.filePath)
    // Convert Node ReadStream to a Web ReadableStream for NextResponse
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
        stream.on('end', () => controller.close())
        stream.on('error', (e) => controller.error(e))
      },
      cancel() { stream.destroy() },
    })
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': disposition,
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (e) { return handleError(e) }
}
