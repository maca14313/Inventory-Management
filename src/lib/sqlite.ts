/**
 * SQLite Layer — better-sqlite3 connection + schema + startup migrations.
 *
 * Plain SQLite storage — no ORM engine, no codegen (hard requirement).
 * - One synchronous connection, WAL mode, foreign keys ON (cascade/set-null works).
 * - Schema is declared here as idempotent DDL (CREATE TABLE IF NOT EXISTS …).
 * - `runMigrations()` is called from src/instrumentation.ts at app startup
 *   (deployment-guide rule 5: migrate at app start, never at install) and from
 *   scripts/migrate.js for manual runs.
 * - Databases created by earlier versions keep working: table names,
 *   column names, boolean 0/1 and epoch-ms DATETIME storage are identical.
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

// ─── Connection ─────────────────────────────────────────────

function resolveDbFile(): string {
  const fromEnv = process.env.DB_PATH || process.env.DATABASE_URL
  if (fromEnv) {
    const p = fromEnv.replace(/^file:/, '')
    return path.isAbsolute(p) ? p : path.join(process.cwd(), p)
  }
  return path.join(process.cwd(), 'db', 'custom.db')
}

export const DB_FILE = resolveDbFile()

function open(): Database.Database {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true })
  const conn = new Database(DB_FILE)
  conn.pragma('journal_mode = WAL')
  conn.pragma('foreign_keys = ON')
  conn.pragma('busy_timeout = 5000')
  return conn
}

const globalForSqlite = globalThis as unknown as {
  __imsSqlite?: Database.Database
  __imsStmtCache?: Map<string, Database.Statement>
}

// NOTE: Turbopack duplicates this module into multiple server chunks (one per
// route group). The globalThis singleton below is what guarantees ONE native
// connection + ONE statement cache per process — in dev AND production.
// (A previous version only stored it when NODE_ENV !== 'production'; the
// production build tree-shook the assignment away and every chunk opened its
// own Database, crashing better-sqlite3's napi cleanup hooks.)
export const sqlite: Database.Database = globalForSqlite.__imsSqlite ?? open()
globalForSqlite.__imsSqlite = sqlite

/**
 * Cached statement preparation — CRITICAL with better-sqlite3 + Next.js dev/HMR:
 * every `db.prepare()` creates a native statement with an environment cleanup hook.
 * Orphaned statements from stale module evaluations crash the process on GC
 * ("RemoveEnvironmentCleanupHook: (env) != nullptr"). Caching on globalThis keeps
 * one statement per SQL string alive for the whole process — and it's faster.
 */
export function prepare(sql: string): Database.Statement {
  let cache = globalForSqlite.__imsStmtCache
  if (!cache) {
    cache = new Map()
    globalForSqlite.__imsStmtCache = cache
  }
  let stmt = cache.get(sql)
  if (!stmt) {
    stmt = sqlite.prepare(sql)
    cache.set(sql, stmt)
  }
  return stmt
}

export function exec(sql: string): void {
  sqlite.exec(sql)
}

export function ping(): boolean {
  prepare('SELECT 1 AS ok').get()
  return true
}

// ─── Schema metadata (drives the ORM query engine in orm.ts) ───────────────

export type FieldType = 'int' | 'float' | 'string' | 'bool' | 'datetime'

export interface FieldDef {
  type: FieldType
  default?: unknown
  nullable?: boolean
}

export interface RelationDef {
  kind: 'toOne' | 'ToMany'
  /** toOne: FK column on THIS model */
  fk?: string
  /** toMany: model + FK column on the RELATED model pointing back here */
  relatedModel?: string
  relatedFk?: string
}

export interface ModelDef {
  fields: Record<string, FieldDef>
  relations: Record<string, RelationDef>
  /** compound unique keys, e.g. { userId_ability: ['userId', 'ability'] } */
  compoundUniques?: Record<string, string[]>
}

const DT: FieldDef = { type: 'datetime' }
const DTN: FieldDef = { type: 'datetime', nullable: true }
const INT: FieldDef = { type: 'int', default: 0 }
const INTN: FieldDef = { type: 'int', nullable: true }
const STR: FieldDef = { type: 'string', default: '' }
const STRN: FieldDef = { type: 'string', nullable: true }
const BOOL: FieldDef = { type: 'bool', default: false }
const FLT: FieldDef = { type: 'float', default: 0 }

export const MODELS: Record<string, ModelDef> = {
  Enterprise: {
    fields: {
      id: { type: 'int' }, name: { type: 'string' }, code: { type: 'string' },
      contactEmail: STR, contactPhone: STR, address: STR,
      isActive: { type: 'bool', default: true },
      maxBranches: { type: 'int', default: 10 }, maxWarehouses: { type: 'int', default: 50 }, maxUsers: { type: 'int', default: 100 },
      createdAt: DT, updatedAt: DT,
    },
    relations: {
      branches: { kind: 'ToMany', relatedModel: 'Branch', relatedFk: 'enterpriseId' },
      warehouses: { kind: 'ToMany', relatedModel: 'Warehouse', relatedFk: 'enterpriseId' },
      users: { kind: 'ToMany', relatedModel: 'User', relatedFk: 'enterpriseId' },
      lots: { kind: 'ToMany', relatedModel: 'Lot', relatedFk: 'enterpriseId' },
      attachments: { kind: 'ToMany', relatedModel: 'Attachment', relatedFk: 'enterpriseId' },
    },
  },
  Branch: {
    fields: {
      id: { type: 'int' }, enterpriseId: { type: 'int' }, name: { type: 'string' }, code: { type: 'string' },
      location: STR, managerName: STR, managerEmail: STR,
      maxWarehouses: { type: 'int', default: 20 }, maxUsers: { type: 'int', default: 50 },
      isActive: { type: 'bool', default: true }, createdAt: DT, updatedAt: DT,
    },
    relations: {
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
      warehouses: { kind: 'ToMany', relatedModel: 'Warehouse', relatedFk: 'branchId' },
      users: { kind: 'ToMany', relatedModel: 'User', relatedFk: 'branchId' },
    },
  },
  Warehouse: {
    fields: {
      id: { type: 'int' }, enterpriseId: { type: 'int' }, branchId: { type: 'int' },
      name: { type: 'string' }, code: { type: 'string' }, location: STR,
      capacity: { type: 'int', default: 1000 }, maxUsers: { type: 'int', default: 20 },
      managerName: STR, isActive: { type: 'bool', default: true }, createdAt: DT, updatedAt: DT,
    },
    relations: {
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
      branch: { kind: 'toOne', fk: 'branchId', relatedModel: 'Branch' },
      stock: { kind: 'ToMany', relatedModel: 'Stock', relatedFk: 'warehouseId' },
      lots: { kind: 'ToMany', relatedModel: 'Lot', relatedFk: 'warehouseId' },
      users: { kind: 'ToMany', relatedModel: 'User', relatedFk: 'warehouseId' },
    },
  },
  User: {
    fields: {
      id: { type: 'int' }, enterpriseId: INTN, branchId: INTN, warehouseId: INTN,
      username: { type: 'string' }, email: STR, fullName: { type: 'string' },
      role: { type: 'string' }, isActive: { type: 'bool', default: true },
      passwordHash: { type: 'string' }, mustResetPassword: BOOL,
      createdAt: DT, updatedAt: DT,
    },
    relations: {
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
      branch: { kind: 'toOne', fk: 'branchId', relatedModel: 'Branch' },
      warehouse: { kind: 'toOne', fk: 'warehouseId', relatedModel: 'Warehouse' },
      permissions: { kind: 'ToMany', relatedModel: 'UserPermission', relatedFk: 'userId' },
    },
  },
  UserPermission: {
    fields: {
      id: { type: 'int' }, userId: { type: 'int' }, ability: { type: 'string' },
      canUse: { type: 'bool', default: true }, canDelegate: BOOL,
      grantedById: INTN, createdAt: DT, updatedAt: DT,
    },
    relations: {
      user: { kind: 'toOne', fk: 'userId', relatedModel: 'User' },
      grantedBy: { kind: 'toOne', fk: 'grantedById', relatedModel: 'User' },
    },
    compoundUniques: { userId_ability: ['userId', 'ability'] },
  },
  Category: {
    fields: {
      id: { type: 'int' }, enterpriseId: { type: 'int' }, name: { type: 'string' },
      description: STR, createdAt: DT, updatedAt: DT,
    },
    relations: {
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
      products: { kind: 'ToMany', relatedModel: 'Product', relatedFk: 'categoryId' },
    },
  },
  Condition: {
    fields: {
      id: { type: 'int' }, enterpriseId: { type: 'int' }, name: { type: 'string' },
      description: STR, createdAt: DT, updatedAt: DT,
    },
    relations: { enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' } },
  },
  Supplier: {
    fields: {
      id: { type: 'int' }, enterpriseId: { type: 'int' }, name: { type: 'string' },
      contactPerson: STR, email: STR, phone: STR, address: STR, createdAt: DT, updatedAt: DT,
    },
    relations: {
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
      orders: { kind: 'ToMany', relatedModel: 'Order', relatedFk: 'supplierId' },
    },
  },
  Product: {
    fields: {
      id: { type: 'int' }, enterpriseId: { type: 'int' }, name: { type: 'string' },
      sku: { type: 'string' }, description: STR, categoryId: INTN,
      price: FLT, cost: FLT, unit: { type: 'string', default: 'piece' },
      reorderLevel: { type: 'int', default: 10 }, isActive: { type: 'bool', default: true },
      createdAt: DT, updatedAt: DT,
    },
    relations: {
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
      category: { kind: 'toOne', fk: 'categoryId', relatedModel: 'Category' },
      stock: { kind: 'ToMany', relatedModel: 'Stock', relatedFk: 'productId' },
      lots: { kind: 'ToMany', relatedModel: 'Lot', relatedFk: 'productId' },
    },
  },
  Stock: {
    fields: {
      id: { type: 'int' }, productId: { type: 'int' }, warehouseId: { type: 'int' },
      quantity: INT, createdAt: DT, updatedAt: DT,
    },
    relations: {
      product: { kind: 'toOne', fk: 'productId', relatedModel: 'Product' },
      warehouse: { kind: 'toOne', fk: 'warehouseId', relatedModel: 'Warehouse' },
    },
    compoundUniques: { productId_warehouseId: ['productId', 'warehouseId'] },
  },
  Lot: {
    fields: {
      id: { type: 'int' }, lotNumber: { type: 'string' }, productId: { type: 'int' },
      warehouseId: { type: 'int' }, enterpriseId: { type: 'int' },
      quantity: { type: 'int' }, remainingQty: { type: 'int' },
      unit: { type: 'string', default: 'piece' }, costPerUnit: FLT,
      supplierName: STRN, source: { type: 'string' }, sourceRef: STRN, notes: STRN,
      conditionId: INTN, receivedDate: DT, closedAt: DTN, createdAt: DT, updatedAt: DT,
    },
    relations: {
      product: { kind: 'toOne', fk: 'productId', relatedModel: 'Product' },
      warehouse: { kind: 'toOne', fk: 'warehouseId', relatedModel: 'Warehouse' },
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
      condition: { kind: 'toOne', fk: 'conditionId', relatedModel: 'Condition' },
    },
  },
  Order: {
    fields: {
      id: { type: 'int' }, enterpriseId: { type: 'int' }, type: { type: 'string' },
      supplierId: INTN, warehouseId: INTN, status: { type: 'string' },
      totalAmount: FLT, notes: STR, createdBy: INTN, createdAt: DT, updatedAt: DT,
    },
    relations: {
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
      supplier: { kind: 'toOne', fk: 'supplierId', relatedModel: 'Supplier' },
      warehouse: { kind: 'toOne', fk: 'warehouseId', relatedModel: 'Warehouse' },
      createdByUser: { kind: 'toOne', fk: 'createdBy', relatedModel: 'User' },
      items: { kind: 'ToMany', relatedModel: 'OrderItem', relatedFk: 'orderId' },
    },
  },
  OrderItem: {
    fields: {
      id: { type: 'int' }, orderId: { type: 'int' }, productId: { type: 'int' },
      warehouseId: { type: 'int' }, quantity: INT, unitPrice: FLT, createdAt: DT, updatedAt: DT,
    },
    relations: {
      order: { kind: 'toOne', fk: 'orderId', relatedModel: 'Order' },
      product: { kind: 'toOne', fk: 'productId', relatedModel: 'Product' },
      warehouse: { kind: 'toOne', fk: 'warehouseId', relatedModel: 'Warehouse' },
    },
  },
  StockInRecorder: {
    fields: {
      id: { type: 'int' }, enterpriseId: { type: 'int' }, warehouseId: { type: 'int' },
      recorderCode: { type: 'string' }, personName: STR, personPhone: STR, personEmail: STR,
      personAddress: STR, notes: STR, status: { type: 'string', default: 'pending' },
      personUserId: INTN, createdAt: DT, updatedAt: DT,
    },
    relations: {
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
      warehouse: { kind: 'toOne', fk: 'warehouseId', relatedModel: 'Warehouse' },
      personUser: { kind: 'toOne', fk: 'personUserId', relatedModel: 'User' },
      items: { kind: 'ToMany', relatedModel: 'StockInItem', relatedFk: 'recorderId' },
    },
  },
  StockInItem: {
    fields: {
      id: { type: 'int' }, recorderId: { type: 'int' }, productId: { type: 'int' },
      warehouseId: { type: 'int' }, quantity: INT, unit: { type: 'string', default: 'piece' },
      costPerUnit: FLT, notes: STR, conditionId: INTN, createdAt: DT, updatedAt: DT,
    },
    relations: {
      recorder: { kind: 'toOne', fk: 'recorderId', relatedModel: 'StockInRecorder' },
      product: { kind: 'toOne', fk: 'productId', relatedModel: 'Product' },
      warehouse: { kind: 'toOne', fk: 'warehouseId', relatedModel: 'Warehouse' },
      condition: { kind: 'toOne', fk: 'conditionId', relatedModel: 'Condition' },
    },
  },
  StockOutRecorder: {
    fields: {
      id: { type: 'int' }, enterpriseId: { type: 'int' }, warehouseId: { type: 'int' },
      recorderCode: { type: 'string' }, personName: STR, personPhone: STR, personEmail: STR,
      personAddress: STR, notes: STR, status: { type: 'string', default: 'pending' },
      personUserId: INTN, createdAt: DT, updatedAt: DT,
    },
    relations: {
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
      warehouse: { kind: 'toOne', fk: 'warehouseId', relatedModel: 'Warehouse' },
      personUser: { kind: 'toOne', fk: 'personUserId', relatedModel: 'User' },
      items: { kind: 'ToMany', relatedModel: 'StockOutItem', relatedFk: 'recorderId' },
    },
  },
  StockOutRecorder: {
    fields: {
      id: { type: 'int' }, enterpriseId: { type: 'int' }, warehouseId: { type: 'int' },
      recorderCode: { type: 'string' }, personName: STR, personPhone: STR, personEmail: STR,
      personAddress: STR, notes: STR, status: { type: 'string', default: 'pending' },
      personUserId: INTN, createdAt: DT, updatedAt: DT,
    },
    relations: {
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
      warehouse: { kind: 'toOne', fk: 'warehouseId', relatedModel: 'Warehouse' },
      personUser: { kind: 'toOne', fk: 'personUserId', relatedModel: 'User' },
      items: { kind: 'ToMany', relatedModel: 'StockOutItem', relatedFk: 'recorderId' },
    },
  },
  StockOutItem: {
    fields: {
      id: { type: 'int' }, recorderId: { type: 'int' }, productId: { type: 'int' },
      warehouseId: { type: 'int' }, quantity: INT, unit: { type: 'string', default: 'piece' },
      isReturnable: BOOL, returnDeadline: DTN, notes: STR, conditionId: INTN,
      createdAt: DT, updatedAt: DT,
    },
    relations: {
      recorder: { kind: 'toOne', fk: 'recorderId', relatedModel: 'StockInRecorder' },
      product: { kind: 'toOne', fk: 'productId', relatedModel: 'Product' },
      warehouse: { kind: 'toOne', fk: 'warehouseId', relatedModel: 'Warehouse' },
      condition: { kind: 'toOne', fk: 'conditionId', relatedModel: 'Condition' },
      returns: { kind: 'ToMany', relatedModel: 'Return', relatedFk: 'stockOutItemId' },
      nonReturnables: { kind: 'ToMany', relatedModel: 'NonReturnable', relatedFk: 'stockOutItemId' },
    },
  },
  ReturnRecorder: {
    fields: {
      id: { type: 'int' }, enterpriseId: { type: 'int' }, recorderCode: { type: 'string' },
      personName: STR, personPhone: STR, personEmail: STR, personAddress: STR, notes: STR,
      status: { type: 'string', default: 'completed' }, itemCount: INT, totalQty: INT,
      personUserId: INTN, createdAt: DT, updatedAt: DT,
    },
    relations: {
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
      personUser: { kind: 'toOne', fk: 'personUserId', relatedModel: 'User' },
      returns: { kind: 'ToMany', relatedModel: 'Return', relatedFk: 'returnRecorderId' },
    },
  },
  Return: {
    fields: {
      id: { type: 'int' }, stockOutItemId: { type: 'int' }, returnRecorderId: INTN,
      quantity: INT, unit: { type: 'string', default: 'piece' }, notes: STR,
      returnedAt: DT, createdAt: DT, updatedAt: DT,
    },
    relations: {
      stockOutItem: { kind: 'toOne', fk: 'stockOutItemId', relatedModel: 'StockOutItem' },
      returnRecorder: { kind: 'toOne', fk: 'returnRecorderId', relatedModel: 'ReturnRecorder' },
    },
  },
  NonReturnableRecorder: {
    fields: {
      id: { type: 'int' }, enterpriseId: { type: 'int' }, recorderCode: { type: 'string' },
      personName: STR, personPhone: STR, personEmail: STR, personAddress: STR, notes: STR,
      status: { type: 'string', default: 'completed' }, itemCount: INT, totalQty: INT,
      personUserId: INTN, createdAt: DT, updatedAt: DT,
    },
    relations: {
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
      personUser: { kind: 'toOne', fk: 'personUserId', relatedModel: 'User' },
      nonReturnables: { kind: 'ToMany', relatedModel: 'NonReturnable', relatedFk: 'nonReturnableRecorderId' },
    },
  },
  NonReturnable: {
    fields: {
      id: { type: 'int' }, stockOutItemId: { type: 'int' }, nonReturnableRecorderId: INTN,
      quantity: INT, unit: { type: 'string', default: 'piece' },
      reason: { type: 'string' }, reasonDetail: STR, notes: STR,
      decidedAt: DT, createdAt: DT, updatedAt: DT,
    },
    relations: {
      stockOutItem: { kind: 'toOne', fk: 'stockOutItemId', relatedModel: 'StockOutItem' },
      nonReturnableRecorder: { kind: 'toOne', fk: 'nonReturnableRecorderId', relatedModel: 'NonReturnableRecorder' },
    },
  },
  AuditLog: {
    fields: {
      id: { type: 'int' }, userId: INTN, enterpriseId: INTN,
      action: { type: 'string' }, entity: { type: 'string' }, entityId: INTN,
      details: STR, createdAt: DT,
    },
    relations: {
      user: { kind: 'toOne', fk: 'userId', relatedModel: 'User' },
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
    },
  },
  Feature: {
    fields: {
      id: { type: 'int' }, enterpriseId: { type: 'int' }, feature: { type: 'string' },
      enabled: { type: 'bool', default: true }, createdAt: DT, updatedAt: DT,
    },
    relations: { enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' } },
    compoundUniques: { enterpriseId_feature: ['enterpriseId', 'feature'] },
  },
  Attachment: {
    fields: {
      id: { type: 'int' }, enterpriseId: { type: 'int' }, branchId: INTN, warehouseId: INTN,
      fileName: { type: 'string' }, storedName: { type: 'string' }, mimeType: { type: 'string' },
      originalSize: { type: 'int' }, storedSize: { type: 'int' },
      isImage: BOOL, isMultiFile: BOOL, fileCount: { type: 'int', default: 1 },
      fileCategory: { type: 'string', default: 'other' },
      fileListJson: { type: 'string', default: '[]' }, previewData: STR,
      entityType: { type: 'string', default: 'standalone' }, entityId: INTN,
      title: STR, description: STR, uploadedById: INTN, createdAt: DT, updatedAt: DT,
    },
    relations: {
      enterprise: { kind: 'toOne', fk: 'enterpriseId', relatedModel: 'Enterprise' },
      branch: { kind: 'toOne', fk: 'branchId', relatedModel: 'Branch' },
      warehouse: { kind: 'toOne', fk: 'warehouseId', relatedModel: 'Warehouse' },
      uploadedBy: { kind: 'toOne', fk: 'uploadedById', relatedModel: 'User' },
      metaFields: { kind: 'ToMany', relatedModel: 'AttachmentMeta', relatedFk: 'attachmentId' },
    },
  },
  AttachmentMeta: {
    fields: {
      id: { type: 'int' }, attachmentId: { type: 'int' }, key: { type: 'string' },
      value: STR, description: STR, createdAt: DT, updatedAt: DT,
    },
    relations: { attachment: { kind: 'toOne', fk: 'attachmentId', relatedModel: 'Attachment' } },
  },
}

// ─── Migrations (idempotent, additive-only — deployment-guide §5.5) ─────────
//
// SQL files live in migrations/*.sql (sorted alphabetically) — the same folder
// scripts/migrate.js (plain-node CLI) and the deploy archive ship. Statements
// use IF NOT EXISTS wherever SQLite supports it; the runner additionally
// tolerates "duplicate column name" errors so re-runs are safe.

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations')

interface Migration { version: string; statements: string[] }

function loadMigrations(): Migration[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return []
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()
  return files.map(file => ({
    version: file.replace(/\.sql$/, ''),
    statements: fs
      .readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
      .split(/;\s*\n/)
      .map(s => s.replace(/^--[^\n]*\n?/gm, '').trim())
      .filter(s => s.length > 0),
  }))
}

/** A migration statement that fails because the column already exists is OK
 *  (SQLite has no IF NOT EXISTS for ALTER TABLE ADD COLUMN). */
const ERRORS_OK = ['duplicate column name']

export function runMigrations(): { applied: string[]; skipped: string[] } {
  exec(`CREATE TABLE IF NOT EXISTS "schema_migrations" (
    "version" TEXT PRIMARY KEY,
    "applied_at" DATETIME NOT NULL
  )`)
  const applied = new Set<string>(
    (prepare('SELECT version FROM schema_migrations').all() as { version: string }[]).map(r => r.version)
  )
  const nowApplied: string[] = []
  const skipped: string[] = []
  const insert = prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
  for (const m of loadMigrations()) {
    if (applied.has(m.version)) { skipped.push(m.version); continue }
    // Raw BEGIN/COMMIT — avoids better-sqlite3 native Transaction objects
    // (cleanup-hook lifecycle issues under Next.js dev HMR).
    exec('BEGIN IMMEDIATE')
    try {
      for (const stmt of m.statements) {
        try {
          exec(stmt)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          if (!ERRORS_OK.some(ok => msg.toLowerCase().includes(ok))) throw err
        }
      }
      insert.run(m.version, Date.now())
      exec('COMMIT')
    } catch (err) {
      try { exec('ROLLBACK') } catch { /* nothing to roll back */ }
      throw err
    }
    nowApplied.push(m.version)
  }
  return { applied: nowApplied, skipped }
}

/** True when the DB has all base tables (used by health endpoint). */
export function schemaReady(): boolean {
  const row = prepare(
    "SELECT count(*) AS c FROM sqlite_master WHERE type='table' AND name IN ('User','Enterprise','StockInRecorder','StockOutRecorder','ReturnRecorder','Attachment')"
  ).get() as { c: number }
  return row.c === 6
}
