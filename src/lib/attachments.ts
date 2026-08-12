/**
 * Attachments — server-only domain layer.
 *
 * WHY A SEPARATE MODULE:
 *   src/lib/db.ts is imported by the client (page.tsx imports MEASUREMENTS), so it
 *   must stay browser-bundleable. This module uses Node-only builtins (fs, zlib) and
 *   sharp (child_process) for gzipped file storage + image thumbnails, so it MUST NOT
 *   be imported by any client component. Only API route handlers import it.
 *
 * TENANT ISOLATION:
 *   Attachments never cross enterprise / branch / warehouse boundaries. See attachmentWhere().
 *
 * STORAGE:
 *   Files are gzipped (zlib.gzipSync) and stored on disk as <cwd>/attachments/att_<ts>_<rand>.gz.
 *   Download endpoint gunzips on the fly and serves the original bytes + filename + mime.
 *   Image files also get a 320px JPEG base64 thumbnail stored in DB for fast preview.
 */

import { prisma } from './prisma'
import { Prisma } from '@prisma/client'
import {
  type AuthContext, canAccessEnterprise,
} from './db'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
// NOTE: no sharp dependency — image previews are served inline via the
// /api/attachments/[id]/download?inline=1 endpoint (browser <img> decompresses).

// ─── Types ─────────────────────────────────────────────────

export interface AttachmentMeta {
  id: number; attachmentId: number; key: string; value: string; description: string
  createdAt: string; updatedAt: string
}

export interface Attachment {
  id: number; enterpriseId: number; branchId: number | null; warehouseId: number | null
  fileName: string; storedName: string; mimeType: string; originalSize: number; storedSize: number
  isImage: boolean; previewData: string
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
  metaKey?: string
  metaValue?: string
  dateFrom?: string
  dateTo?: string
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
  return `${ATTACHMENT_DIR}/${storedName}`
}

function isImageFile(fileName: string, mimeType: string): boolean {
  if (mimeType && mimeType.startsWith('image/')) return true
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  return IMAGE_EXTENSIONS.includes(ext)
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
function attachmentWhere(ctx: AuthContext, f: AttachmentFilters = {}): Prisma.AttachmentWhereInput {
  const w: Prisma.AttachmentWhereInput = {}
  if (ctx.role === 'super_admin') {
    // sees everything; optional explicit filters apply below
  } else if (ctx.role === 'enterprise_admin') {
    if (!ctx.enterpriseId) return { id: -1 }
    w.enterpriseId = ctx.enterpriseId
  } else if (ctx.role === 'branch_admin') {
    if (!ctx.branchId) return { id: -1 }
    // branch-scoped attachments + enterprise-scoped (branch+warehouse null) ones
    w.OR = [
      { branchId: ctx.branchId },
      { branchId: null, warehouseId: null, enterpriseId: ctx.enterpriseId },
    ]
  } else {
    // warehouse_admin
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
  if (f.search) {
    const q = f.search.toLowerCase()
    const searchClause = [{ title: { contains: q } }, { fileName: { contains: q } }, { description: { contains: q } }]
    w.OR = (w.OR as any) ? [...(w.OR as any[]), ...searchClause] : searchClause
  }
  if (f.metaKey) {
    w.metaFields = { some: { key: { contains: f.metaKey.toLowerCase() } } }
  }
  if (f.metaValue) {
    w.metaFields = w.metaFields
      ? { some: { AND: [{ key: { contains: (f.metaKey || '').toLowerCase() } }, { value: { contains: f.metaValue.toLowerCase() } }] } }
      : { some: { value: { contains: f.metaValue.toLowerCase() } } }
  }
  if (f.dateFrom || f.dateTo) {
    const created: Prisma.DateTimeFilter = {}
    if (f.dateFrom) created.gte = new Date(f.dateFrom + 'T00:00:00')
    if (f.dateTo) created.lte = new Date(f.dateTo + 'T23:59:59')
    w.createdAt = created
  }
  return w
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

  /** Create an attachment from a file buffer. Gzips the file on disk, generates an image
   *  thumbnail if applicable, and stores metadata + metaFields in the DB. */
  create: async (
    ctx: AuthContext,
    params: {
      fileName: string
      mimeType: string
      fileBuffer: Buffer
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
    const isImg = isImageFile(params.fileName, params.mimeType)
    const gzipped = zlib.gzipSync(params.fileBuffer)
    const storedName = `att_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.gz`
    const filePath = attachmentFilePath(storedName)
    fs.writeFileSync(filePath, gzipped)

    // No server-side thumbnail generation (sharp native addon is unstable in
    // Turbopack). Image previews are rendered client-side via the inline download
    // endpoint. previewData stays empty.
    const previewData = ''

    let created: any
    try {
      created = await prisma.$transaction(async (tx) => {
        const a = await tx.attachment.create({
          data: {
            enterpriseId,
            branchId,
            warehouseId,
            fileName: params.fileName,
            storedName,
            mimeType: params.mimeType || 'application/octet-stream',
            originalSize: params.fileBuffer.length,
            storedSize: gzipped.length,
            isImage: isImg,
            previewData,
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
            details: `Uploaded attachment: ${a.fileName} (${a.entityType}${a.entityId ? `#${a.entityId}` : ''})`,
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
  getDownloadInfo: async (ctx: AuthContext, id: number): Promise<{ filePath: string; fileName: string; mimeType: string } | null> => {
    const a = await prisma.attachment.findUnique({ where: { id } })
    if (!a) return null
    if (!canAccessEnterprise(ctx, a.enterpriseId)) return null
    if (ctx.role === 'warehouse_admin' && a.warehouseId !== null && a.warehouseId !== ctx.warehouseId) return null
    if (ctx.role === 'branch_admin' && a.branchId !== null && a.branchId !== ctx.branchId) return null
    return { filePath: attachmentFilePath(a.storedName), fileName: a.fileName, mimeType: a.mimeType }
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

  /** Distinct metadata keys across visible attachments — powers the meta-key filter dropdown. */
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
}
