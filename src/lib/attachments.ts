/**
 * Attachments — server-only domain layer.
 *
 * WHY A SEPARATE MODULE:
 *   src/lib/db.ts is imported by the client (page.tsx imports MEASUREMENTS), so it
 *   must stay browser-bundleable. This module uses Node-only builtins (fs, zlib,
 *   archiver, adm-zip) for ZIP archive creation + extraction, so it MUST NOT be
 *   imported by any client component. Only API route handlers import it.
 *
 * TENANT ISOLATION:
 *   Attachments never cross enterprise / branch / warehouse boundaries. See attachmentWhere().
 *
 * STORAGE:
 *   Files are bundled into a real ZIP archive (archiver) and stored on disk as
 *   <cwd>/../ims-attachments/att_<ts>_<rand>.zip. Single-file uploads still get
 *   zipped (one entry). Download endpoint streams the whole zip; ?fileIndex=N
 *   extracts a single entry for inline image preview.
 *   Legacy ".gz" files (created by the previous gzip-based implementation) are
 *   transparently handled by the download endpoint (gunzip fallback).
 */

import { prisma } from './prisma'
import {
  type AuthContext, canAccessEnterprise,
} from './db'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { ZipArchive } from 'archiver'
import AdmZip from 'adm-zip'

// ─── Types ─────────────────────────────────────────────────

export interface AttachmentMeta {
  id: number; attachmentId: number; key: string; value: string; description: string
  createdAt: string; updatedAt: string
}

export interface AttachmentFileEntry {
  name: string
  size: number
  mimeType: string
}

export interface Attachment {
  id: number; enterpriseId: number; branchId: number | null; warehouseId: number | null
  fileName: string; storedName: string; mimeType: string; originalSize: number; storedSize: number
  isImage: boolean; isMultiFile: boolean; fileCount: number; fileCategory: string
  fileListJson: string; previewData: string
  entityType: string; entityId: number | null
  title: string; description: string; uploadedById: number | null
  metaFields?: AttachmentMeta[]
  uploadedBy?: { id: number; username: string; fullName: string } | null
  createdAt: string; updatedAt: string
}

export interface AttachmentFilters {
  search?: string
  entityType?: string
  entityId?: number
  branchId?: number
  warehouseId?: number
  isImage?: boolean
  fileCategory?: string
  metaKey?: string
  metaValue?: string
  dateFrom?: string
  dateTo?: string
  /** Filter by a meta key=value pair (used by advanced filter content search). */
  hasMetaKey?: string
  hasMetaValue?: string
  /** Match any meta field whose key, value, or description contains this substring. */
  metaSearch?: string
}

// ─── Storage helpers ───────────────────────────────────────

// Store OUTSIDE the project tree so Turbopack's file watcher doesn't pick up
// writes (which caused dev-server crashes). Sibling dir: <cwd>/../ims-attachments
const ATTACHMENT_DIR = process.env.ATTACHMENTS_DIR || path.resolve(process.cwd(), '..', 'ims-attachments')
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']

function ensureAttachmentDir() {
  if (!fs.existsSync(ATTACHMENT_DIR)) fs.mkdirSync(ATTACHMENT_DIR, { recursive: true })
}

function attachmentFilePath(storedName: string): string {
  return path.join(ATTACHMENT_DIR, storedName)
}

function isImageFile(fileName: string, mimeType: string): boolean {
  if (mimeType && mimeType.startsWith('image/')) return true
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  return IMAGE_EXTENSIONS.includes(ext)
}

/** Classify a file into a coarse category used by the Attachments-page tabs. */
export function classifyFile(fileName: string, mimeType: string): string {
  const m = (mimeType || '').toLowerCase()
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.')) || ''
  if (m.startsWith('image/')) return 'image'
  if (m === 'application/pdf' || ext === '.pdf') return 'pdf'
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('audio/')) return 'audio'
  if (['.xls', '.xlsx', '.csv', '.ods'].includes(ext) || m.includes('spreadsheet') || m.includes('excel') || m === 'text/csv') return 'spreadsheet'
  if (['.ppt', '.pptx', '.odp'].includes(ext) || m.includes('presentation') || m.includes('powerpoint')) return 'presentation'
  if (['.doc', '.docx', '.odt', '.rtf', '.txt'].includes(ext) || m.includes('document') || m.includes('word') || m === 'text/plain') return 'document'
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'].includes(ext) || m.includes('archive') || m.includes('compressed') || m.includes('zip')) return 'archive'
  if (['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.cs', '.rb', '.php', '.json', '.xml', '.yml', '.yaml', '.html', '.css', '.sh', '.sql'].includes(ext)) return 'code'
  return 'other'
}

/** Convert Prisma rows to plain serializable objects (Date → ISO string). */
function ser(row: unknown): unknown {
  if (row === null || row === undefined) return row
  if (Array.isArray(row)) return row.map(ser)
  if (row instanceof Date) return row.toISOString()
  if (typeof row === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(row as Record<string, unknown>)) {
      const v = (row as Record<string, unknown>)[k]
      out[k] = v instanceof Date ? v.toISOString() : (v && typeof v === 'object' ? ser(v) : v)
    }
    return out
  }
  return row
}

/** Build tenant-scoped where for attachments (enterprise + branch + warehouse hierarchy). */
function attachmentWhere(ctx: AuthContext, f: AttachmentFilters = {}): any {
  const w: any = {}
  if (ctx.role === 'super_admin') {
    // sees everything; optional explicit filters apply below
  } else if (ctx.role === 'enterprise_admin') {
    if (!ctx.enterpriseId) return { id: -1 }
    w.enterpriseId = ctx.enterpriseId
  } else if (ctx.role === 'branch_admin') {
    if (!ctx.branchId) return { id: -1 }
    w.OR = [
      { branchId: ctx.branchId },
      { branchId: null, warehouseId: null, enterpriseId: ctx.enterpriseId },
    ]
  } else {
    if (!ctx.warehouseId) return { id: -1 }
    w.OR = [
      { warehouseId: ctx.warehouseId },
      { warehouseId: null, branchId: null, enterpriseId: ctx.enterpriseId },
    ]
  }
  if (f.entityType) w.entityType = f.entityType
  if (f.entityId !== undefined && f.entityId !== null) w.entityId = f.entityId
  if (f.branchId) w.branchId = f.branchId
  if (f.warehouseId) w.warehouseId = f.warehouseId
  if (f.isImage !== undefined) w.isImage = f.isImage
  if (f.fileCategory) w.fileCategory = f.fileCategory

  // Free-text search across title / fileName / description
  if (f.search) {
    const q = f.search.toLowerCase()
    const searchClause: any[] = [
      { title: { contains: q } },
      { fileName: { contains: q } },
      { description: { contains: q } },
    ]
    w.OR = (w.OR as any) ? [...(w.OR as any[]), ...searchClause] : searchClause
  }

  // Metadata filters
  if (f.metaKey) {
    w.metaFields = { some: { key: { contains: f.metaKey.toLowerCase() } } }
  }
  if (f.metaValue) {
    w.metaFields = w.metaFields
      ? { some: { AND: [{ key: { contains: (f.metaKey || '').toLowerCase() } }, { value: { contains: f.metaValue.toLowerCase() } }] } }
      : { some: { value: { contains: f.metaValue.toLowerCase() } } }
  }
  if (f.hasMetaKey && f.hasMetaValue) {
    w.metaFields = { some: { AND: [{ key: f.hasMetaKey }, { value: { contains: f.hasMetaValue } }] } }
  } else if (f.hasMetaKey) {
    w.metaFields = { some: { key: f.hasMetaKey } }
  }
  if (f.metaSearch) {
    const ms = f.metaSearch.toLowerCase()
    w.metaFields = { some: { OR: [
      { key: { contains: ms } },
      { value: { contains: ms } },
      { description: { contains: ms } },
    ] } }
  }

  if (f.dateFrom || f.dateTo) {
    const created: any = {}
    if (f.dateFrom) created.gte = new Date(f.dateFrom + 'T00:00:00')
    if (f.dateTo) created.lte = new Date(f.dateTo + 'T23:59:59')
    w.createdAt = created
  }
  return w
}

// ─── ZIP helpers ───────────────────────────────────────────

/** Create a ZIP archive Buffer from a list of file buffers. */
function createZipBuffer(files: { name: string; buffer: Buffer }[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 6 } })
    const chunks: Buffer[] = []
    archive.on('data', (c: Buffer) => chunks.push(c))
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)
    for (const f of files) {
      archive.append(f.buffer, { name: f.name })
    }
    archive.finalize()
  })
}

// ─── Domain API ────────────────────────────────────────────

export const attachments = {
  findMany: async (ctx: AuthContext, filters: AttachmentFilters = {}): Promise<Attachment[]> => {
    const where = attachmentWhere(ctx, filters)
    const rows = await prisma.attachment.findMany({
      where,
      orderBy: { id: 'desc' },
      include: {
        metaFields: { orderBy: { id: 'asc' } },
        uploadedBy: { select: { id: true, username: true, fullName: true } },
      },
    })
    return ser(rows) as Attachment[]
  },

  findById: async (ctx: AuthContext, id: number): Promise<Attachment | null> => {
    const a = await prisma.attachment.findUnique({
      where: { id },
      include: {
        metaFields: { orderBy: { id: 'asc' } },
        uploadedBy: { select: { id: true, username: true, fullName: true } },
      },
    })
    if (!a) return null
    if (!canAccessEnterprise(ctx, a.enterpriseId)) return null
    if (ctx.role === 'branch_admin' && a.branchId !== null && a.branchId !== ctx.branchId) return null
    if (ctx.role === 'warehouse_admin' && a.warehouseId !== null && a.warehouseId !== ctx.warehouseId) return null
    return ser(a) as Attachment
  },

  /** Create an attachment from one OR MORE file buffers. Bundles them into a single
   *  ZIP archive on disk, classifies the primary file, and stores metadata + metaFields. */
  create: async (
    ctx: AuthContext,
    params: {
      files: { name: string; mimeType: string; buffer: Buffer }[]
      title?: string
      description?: string
      entityType?: string
      entityId?: number | null
      branchId?: number | null
      warehouseId?: number | null
      enterpriseId?: number
      metaFields?: { key: string; value: string; description: string }[]
    }
  ): Promise<Attachment> => {
    if (!params.files || params.files.length === 0) throw new Error('Validation: no files provided')
    if (!ctx.enterpriseId && ctx.role !== 'super_admin') throw new Error('FORBIDDEN')
    const enterpriseId = ctx.role === 'super_admin' ? (params.enterpriseId || ctx.enterpriseId) : ctx.enterpriseId
    if (!enterpriseId) throw new Error('Validation: enterpriseId is required')
    if (ctx.role !== 'super_admin' && params.enterpriseId !== undefined && params.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')

    const branchId = params.branchId ?? null
    const warehouseId = params.warehouseId ?? null
    if (branchId) {
      const br = await prisma.branch.findUnique({ where: { id: branchId } })
      if (!br || br.enterpriseId !== enterpriseId) throw new Error('Validation: invalid branch')
    }
    if (warehouseId) {
      const wh = await prisma.warehouse.findUnique({ where: { id: warehouseId } })
      if (!wh || wh.enterpriseId !== enterpriseId) throw new Error('Validation: invalid warehouse')
    }

    ensureAttachmentDir()
    const files = params.files
    const primary = files[0]
    const isImg = isImageFile(primary.name, primary.mimeType)
    const category = classifyFile(primary.name, primary.mimeType)
    const totalOriginal = files.reduce((s, f) => s + f.buffer.length, 0)
    const fileList: AttachmentFileEntry[] = files.map(f => ({
      name: f.name,
      size: f.buffer.length,
      mimeType: f.mimeType || 'application/octet-stream',
    }))

    const zipBuffer = await createZipBuffer(files.map(f => ({ name: f.name, buffer: f.buffer })))
    const storedName = `att_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.zip`
    const filePath = attachmentFilePath(storedName)
    fs.writeFileSync(filePath, zipBuffer)

    let created: any
    try {
      created = await prisma.$transaction(async (tx) => {
        const a = await tx.attachment.create({
          data: {
            enterpriseId,
            branchId,
            warehouseId,
            fileName: primary.name,
            storedName,
            mimeType: primary.mimeType || 'application/octet-stream',
            originalSize: totalOriginal,
            storedSize: zipBuffer.length,
            isImage: isImg,
            isMultiFile: files.length > 1,
            fileCount: files.length,
            fileCategory: category,
            fileListJson: JSON.stringify(fileList),
            previewData: '',
            entityType: params.entityType || 'standalone',
            entityId: params.entityId ?? null,
            title: params.title || '',
            description: params.description || '',
            uploadedById: ctx.userId || null,
            metaFields: params.metaFields && params.metaFields.length > 0
              ? { create: params.metaFields.filter(m => m.key && m.key.trim()).map(m => ({ key: m.key.trim(), value: m.value || '', description: m.description || '' })) }
              : undefined,
          },
          include: {
            metaFields: { orderBy: { id: 'asc' } },
            uploadedBy: { select: { id: true, username: true, fullName: true } },
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: a.enterpriseId,
            action: 'attachment.create', entity: 'Attachment', entityId: a.id,
            details: `Uploaded attachment: ${a.fileName} (${a.fileCount} file(s), ${a.entityType}${a.entityId ? `#${a.entityId}` : ''})`,
          },
        })
        return a
      })
    } catch (e) {
      try { fs.unlinkSync(filePath) } catch {}
      throw e
    }
    return ser(created) as Attachment
  },

  update: async (
    ctx: AuthContext,
    id: number,
    d: Partial<{
      title: string
      description: string
      entityType: string
      entityId: number | null
      branchId: number | null
      warehouseId: number | null
      metaFields: { key: string; value: string; description: string }[]
    }>
  ): Promise<Attachment> => {
    const existing = await prisma.attachment.findUnique({ where: { id } })
    if (!existing) throw new Error('Not found')
    if (!canAccessEnterprise(ctx, existing.enterpriseId)) throw new Error('FORBIDDEN')
    if (ctx.role === 'warehouse_admin' && existing.warehouseId !== null && existing.warehouseId !== ctx.warehouseId) throw new Error('FORBIDDEN')
    if (ctx.role === 'branch_admin' && existing.branchId !== null && existing.branchId !== ctx.branchId) throw new Error('FORBIDDEN')

    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.attachment.update({
        where: { id },
        data: {
          ...(d.title !== undefined ? { title: d.title } : {}),
          ...(d.description !== undefined ? { description: d.description } : {}),
          ...(d.entityType !== undefined ? { entityType: d.entityType } : {}),
          ...(d.entityId !== undefined ? { entityId: d.entityId } : {}),
          ...(d.branchId !== undefined ? { branchId: d.branchId } : {}),
          ...(d.warehouseId !== undefined ? { warehouseId: d.warehouseId } : {}),
        },
      })
      if (d.metaFields !== undefined) {
        await tx.attachmentMeta.deleteMany({ where: { attachmentId: id } })
        if (d.metaFields.length > 0) {
          await tx.attachmentMeta.createMany({
            data: d.metaFields.filter(m => m.key && m.key.trim()).map(m => ({
              attachmentId: id,
              key: m.key.trim(),
              value: m.value || '',
              description: m.description || '',
            })),
          })
        }
      }
      await tx.auditLog.create({
        data: {
          userId: ctx.userId, enterpriseId: a.enterpriseId,
          action: 'attachment.update', entity: 'Attachment', entityId: a.id,
          details: `Updated attachment: ${a.fileName}`,
        },
      })
      return tx.attachment.findUnique({
        where: { id },
        include: {
          metaFields: { orderBy: { id: 'asc' } },
          uploadedBy: { select: { id: true, username: true, fullName: true } },
        },
      })
    })
    return ser(updated) as Attachment
  },

  remove: async (ctx: AuthContext, id: number): Promise<void> => {
    const existing = await prisma.attachment.findUnique({ where: { id } })
    if (!existing) throw new Error('Not found')
    if (!canAccessEnterprise(ctx, existing.enterpriseId)) throw new Error('FORBIDDEN')
    if (ctx.role === 'warehouse_admin' && existing.warehouseId !== null && existing.warehouseId !== ctx.warehouseId) throw new Error('FORBIDDEN')
    if (ctx.role === 'branch_admin' && existing.branchId !== null && existing.branchId !== ctx.branchId) throw new Error('FORBIDDEN')

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: ctx.userId, enterpriseId: existing.enterpriseId,
          action: 'attachment.delete', entity: 'Attachment', entityId: id,
          details: `Deleted attachment: ${existing.fileName}`,
        },
      })
      await tx.attachment.delete({ where: { id } })
    })
    try { fs.unlinkSync(attachmentFilePath(existing.storedName)) } catch {}
  },

  /** Returns disk path + original file info for download. Tenant-checked. */
  getDownloadInfo: async (ctx: AuthContext, id: number): Promise<{ filePath: string; fileName: string; mimeType: string; attachment: any } | null> => {
    const a = await prisma.attachment.findUnique({ where: { id } })
    if (!a) return null
    if (!canAccessEnterprise(ctx, a.enterpriseId)) return null
    if (ctx.role === 'warehouse_admin' && a.warehouseId !== null && a.warehouseId !== ctx.warehouseId) return null
    if (ctx.role === 'branch_admin' && a.branchId !== null && a.branchId !== ctx.branchId) return null
    return { filePath: attachmentFilePath(a.storedName), fileName: a.fileName, mimeType: a.mimeType, attachment: ser(a) }
  },

  /** Extract a single entry from the ZIP archive. Used for inline image preview
   *  (?fileIndex=N) and for serving individual files from a multi-file attachment.
   *  Returns null if index is out of range or file is missing/corrupt. */
  extractEntry: async (ctx: AuthContext, id: number, fileIndex: number): Promise<{ buffer: Buffer; entryName: string; mimeType: string } | null> => {
    const info = await attachments.getDownloadInfo(ctx, id)
    if (!info) return null
    const a = info.attachment
    if (!fs.existsSync(info.filePath)) return null
    // Legacy .gz file? gunzip and serve as single file (only index 0 valid)
    if (info.filePath.endsWith('.gz')) {
      if (fileIndex !== 0) return null
      try {
        const buf = zlib.gunzipSync(fs.readFileSync(info.filePath))
        return { buffer: buf, entryName: a.fileName, mimeType: a.mimeType }
      } catch {
        return null
      }
    }
    try {
      const zip = new AdmZip(info.filePath)
      const entries = zip.getEntries()
      if (fileIndex < 0 || fileIndex >= entries.length) return null
      const entry = entries[fileIndex]
      const buf = entry.getData()
      // Re-derive mime from entry name (the stored list may have it, but trust extension)
      const ext = entry.entryName.toLowerCase().substring(entry.entryName.lastIndexOf('.'))
      let mime = 'application/octet-stream'
      if (ext === '.png') mime = 'image/png'
      else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg'
      else if (ext === '.gif') mime = 'image/gif'
      else if (ext === '.webp') mime = 'image/webp'
      else if (ext === '.svg') mime = 'image/svg+xml'
      else if (ext === '.pdf') mime = 'application/pdf'
      else if (ext === '.txt') mime = 'text/plain'
      else if (ext === '.json') mime = 'application/json'
      else if (ext === '.csv') mime = 'text/csv'
      // For single-file zips where the file was originally an image, prefer stored mimeType
      if (fileIndex === 0 && a.isImage && a.mimeType.startsWith('image/')) mime = a.mimeType
      return { buffer: buf, entryName: entry.entryName, mimeType: mime }
    } catch {
      return null
    }
  },

  /** Attachment counts grouped by entityId for a given entityType. Powers "has attachments"
   *  badges + the "Has Attachments" advanced filter on list pages. */
  countsByEntity: async (ctx: AuthContext, entityType: string, entityIds: number[]): Promise<Record<number, number>> => {
    if (entityIds.length === 0) return {}
    const where = attachmentWhere(ctx, { entityType })
    const rows = await prisma.attachment.groupBy({
      by: ['entityId'],
      where: { ...where, entityType, entityId: { in: entityIds } },
      _count: { id: true },
    })
    const out: Record<number, number> = {}
    for (const r of rows) out[r.entityId as number] = r._count.id
    return out
  },

  /** Attachment counts grouped by entityType for a single entityId. Powers item-level badges. */
  countsForEntity: async (ctx: AuthContext, entityType: string, entityId: number): Promise<number> => {
    const where = attachmentWhere(ctx, { entityType, entityId })
    const c = await prisma.attachment.count({ where })
    return c
  },

  /** Distinct metadata keys across visible attachments — powers the meta-key filter dropdown
   *  AND the "by metadata type" tabs on the Attachments page. */
  distinctMetaKeys: async (ctx: AuthContext): Promise<string[]> => {
    const where = attachmentWhere(ctx)
    const rows = await prisma.attachmentMeta.findMany({
      where: { attachment: where },
      select: { key: true },
      distinct: ['key'],
      orderBy: { key: 'asc' },
    })
    return rows.map(r => r.key)
  },

  /** Counts of attachments grouped by fileCategory — powers the file-type tabs. */
  countsByCategory: async (ctx: AuthContext): Promise<Record<string, number>> => {
    const where = attachmentWhere(ctx)
    const rows = await prisma.attachment.groupBy({
      by: ['fileCategory'],
      where,
      _count: { id: true },
    })
    const out: Record<string, number> = {}
    for (const r of rows) out[r.fileCategory] = r._count.id
    return out
  },
}
