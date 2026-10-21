/**
 * Multi-Tenant Enterprise IMS — Domain Layer
 *
 * HIERARCHY ENFORCEMENT:
 *   Super Admin       → sees everything, manages all enterprises
 *   Enterprise Admin  → scoped to their enterpriseId
 *   Branch Admin      → scoped to their branchId (and its warehouses)
 *   Warehouse Admin   → scoped to their warehouseId
 *
 * All findMany/findById/create/update/remove operations accept an
 * AuthContext that enforces tenant boundaries. API routes call
 * `db.<domain>.<method>(ctx, ...)` and never touch the SQLite client directly.
 *
 * LOT TRACKING (Change 2):
 *   Every stock-in path creates a Lot:
 *     - db.stock.stockIn()        → Lot source='adjustment'
 *     - db.stockIn.addItem()      → Lot source='stock_in'
 *     - db.registerItem()         → Lot source='register_item'
 *     - db.registerItems()        → Lot source='register_item' per item
 *     - db.stock.adjust()         → Lot source='adjustment' (for increase delta)
 *   FIFO deduction on stock-out via deductLotsFIFO().
 *   Lot reversal on stock-in delete via reverseLot().
 *
 * NO Batch / BatchEntry — replaced entirely by Lot + StockInRecorder (Change 1).
 */

import { orm } from './orm'

// ─── Core Types ─────────────────────────────────────────────

export type Role = 'super_admin' | 'enterprise_admin' | 'branch_admin' | 'warehouse_admin'

export interface AuthContext {
  userId: number
  role: Role
  enterpriseId: number | null
  branchId: number | null
  warehouseId: number | null
}

export interface Enterprise {
  id: number; name: string; code: string
  contactEmail: string; contactPhone: string; address: string
  isActive: boolean; maxBranches: number; maxWarehouses: number; maxUsers: number
  createdAt: string; updatedAt: string
}

export interface Branch {
  id: number; enterpriseId: number; name: string; code: string
  location: string; managerName: string; managerEmail: string; isActive: boolean
  createdAt: string; updatedAt: string
}

export interface Warehouse {
  id: number; enterpriseId: number; branchId: number; name: string; code: string
  location: string; capacity: number; managerName: string; isActive: boolean
  createdAt: string; updatedAt: string
}

export interface User {
  id: number; enterpriseId: number | null; branchId: number | null; warehouseId: number | null
  username: string; email: string; fullName: string; role: Role
  isActive: boolean; mustResetPassword: boolean
  createdAt: string; updatedAt: string
}

export interface Category {
  id: number; enterpriseId: number; name: string; description: string
  createdAt: string; updatedAt: string
}

export interface Condition {
  id: number; enterpriseId: number; name: string; description: string
  createdAt: string; updatedAt: string
}

export interface Supplier {
  id: number; enterpriseId: number; name: string; contactPerson: string; email: string
  phone: string; address: string
  createdAt: string; updatedAt: string
}

export interface Product {
  id: number; enterpriseId: number; name: string; sku: string; description: string
  categoryId: number | null; price: number; cost: number; unit: string
  reorderLevel: number; isActive: boolean
  createdAt: string; updatedAt: string
}

export interface Stock {
  id: number; productId: number; warehouseId: number; quantity: number
  createdAt: string; updatedAt: string
}

export interface Lot {
  id: number; lotNumber: string; productId: number; warehouseId: number; enterpriseId: number
  quantity: number; remainingQty: number; unit: string; costPerUnit: number
  supplierName: string | null; source: 'stock_in' | 'register_item' | 'adjustment'
  sourceRef: string | null; notes: string | null
  conditionId?: number | null
  condition?: { id: number; name: string; description: string } | null
  receivedDate: string; closedAt: string | null
  createdAt: string; updatedAt: string
  status?: 'open' | 'closed'  // derived
}

export interface Order {
  id: number; enterpriseId: number; type: 'purchase' | 'sales'
  supplierId: number | null; warehouseId: number | null
  status: 'pending' | 'approved' | 'shipped' | 'received' | 'cancelled'
  totalAmount: number; notes: string; createdBy: number | null
  createdAt: string; updatedAt: string
}

export interface OrderItem {
  id: number; orderId: number; productId: number; warehouseId: number
  quantity: number; unitPrice: number
  createdAt: string; updatedAt: string
}

export interface StockInRecorder {
  id: number; enterpriseId: number; warehouseId: number; recorderCode: string
  personName: string; personPhone: string; personEmail: string; personAddress: string
  personUserId?: number | null
  personUser?: { id: number; username: string; fullName: string; role: string } | null
  notes: string; status: 'pending' | 'submitted'
  createdAt: string; updatedAt: string
}

export interface StockInItem {
  id: number; recorderId: number; productId: number; warehouseId: number
  quantity: number; unit: string; costPerUnit: number; notes: string
  conditionId?: number | null
  condition?: { id: number; name: string; description: string } | null
  createdAt: string; updatedAt: string
}

export interface StockOutRecorder {
  id: number; enterpriseId: number; warehouseId: number; recorderCode: string
  personName: string; personPhone: string; personEmail: string; personAddress: string
  personUserId?: number | null
  personUser?: { id: number; username: string; fullName: string; role: string } | null
  notes: string; status: 'pending' | 'partial_return' | 'returned'
  createdAt: string; updatedAt: string
}

export interface StockOutItem {
  id: number; recorderId: number; productId: number; warehouseId: number
  quantity: number; unit: string; isReturnable: boolean; returnDeadline: string | null
  notes: string
  conditionId?: number | null
  condition?: { id: number; name: string; description: string } | null
  createdAt: string; updatedAt: string
}

export interface ReturnRecord {
  id: number; stockOutItemId: number; returnRecorderId: number | null; quantity: number; unit: string; notes: string
  returnedAt: string; createdAt: string; updatedAt: string
}

export interface ReturnRecorder {
  id: number; enterpriseId: number; recorderCode: string
  personName: string; personPhone: string; personEmail: string; personAddress: string
  personUserId?: number | null
  personUser?: { id: number; username: string; fullName: string; role: string } | null
  notes: string; status: string; itemCount: number; totalQty: number
  createdAt: string; updatedAt: string
  returns?: ReturnRecord[]
}

export interface NonReturnable {
  id: number; stockOutItemId: number; nonReturnableRecorderId: number | null
  quantity: number; unit: string; reason: string; reasonDetail: string; notes: string
  decidedAt: string; createdAt: string; updatedAt: string
  stockOutItem?: { id: number; productId: number; warehouseId: number; quantity: number; unit: string; product?: Product }
}

export interface NonReturnableRecorder {
  id: number; enterpriseId: number; recorderCode: string
  personName: string; personPhone: string; personEmail: string; personAddress: string
  personUserId?: number | null
  personUser?: { id: number; username: string; fullName: string; role: string } | null
  notes: string; status: string; itemCount: number; totalQty: number
  createdAt: string; updatedAt: string
  nonReturnables?: (NonReturnable & { stockOutItem?: { product: Product } })[]
}

export interface ReturnableItem extends StockOutItem {
  returnedQty: number
  remainingQty: number
  nonReturnableQty: number
  product: Product
  recorder: StockOutRecorder
  returns: ReturnRecord[]
  nonReturnables?: NonReturnable[]
}

export interface AuditLog {
  id: number; userId: number | null; enterpriseId: number | null
  action: string; entity: string; entityId: number | null
  details: string; createdAt: string
  userName?: string | null
}

export interface Feature {
  id: number; enterpriseId: number; feature: string; enabled: boolean
  createdAt: string; updatedAt: string
}

export interface DashboardStats {
  enterpriseCount: number; branchCount: number; warehouseCount: number; userCount: number
  productCount: number; orderCount: number; pendingOrderCount: number
  totalStockValue: number
  lowStockProducts: { id: number; name: string; sku: string; reorderLevel: number; totalQty: number }[]
  totalLots: number; openLots: number
  stockInCount: number; stockOutCount: number
}

export interface AnalyticsData {
  stockByWarehouse: { name: string; value: number }[]
  stockByCategory: { name: string; value: number }[]
  topProducts: { name: string; quantity: number; value: number }[]
  recentActivity: { id: number; action: string; entity: string; entityId: number | null; details: string; createdAt: string; userName: string | null }[]
}

// ─── Measurements ──────────────────────────────────────────

export const MEASUREMENTS = [
  'piece', 'kg', 'g', 'liter', 'ml', 'box', 'pack', 'meter', 'cm', 'roll', 'bottle', 'carton',
] as const

export type Measurement = typeof MEASUREMENTS[number]

// ─── Tenant Scoping Helpers ────────────────────────────────

type Tx = typeof orm

function canAccessEnterprise(ctx: AuthContext, eid: number | null): boolean {
  if (eid === null) return false
  if (ctx.role === 'super_admin') return true
  return ctx.enterpriseId === eid
}

function canAccessBranch(ctx: AuthContext, eid: number | null, bid: number | null): boolean {
  if (!canAccessEnterprise(ctx, eid)) return false
  if (ctx.role === 'super_admin' || ctx.role === 'enterprise_admin') return true
  return ctx.branchId === bid
}

function canAccessWarehouse(ctx: AuthContext, eid: number | null, bid: number | null, wid: number | null): boolean {
  if (!canAccessBranch(ctx, eid, bid)) return false
  if (ctx.role === 'warehouse_admin') return ctx.warehouseId === wid
  return true
}

function canManageUser(ctx: AuthContext, target: { role: string; enterpriseId: number | null; branchId: number | null }): boolean {
  const targetRole = target.role as Role
  if (ctx.role === 'super_admin') return true
  const roleOrder: Record<Role, number> = { super_admin: 0, enterprise_admin: 1, branch_admin: 2, warehouse_admin: 3 }
  if (ctx.role === 'enterprise_admin') {
    if (target.enterpriseId !== ctx.enterpriseId) return false
    return roleOrder[ctx.role] < roleOrder[targetRole]
  }
  if (ctx.role === 'branch_admin') {
    if (target.branchId !== ctx.branchId) return false
    return targetRole === 'warehouse_admin'
  }
  return false
}

/** Build where-filter for enterprises */
function enterpriseWhere(ctx: AuthContext, eid?: number): any {
  if (eid) return { id: eid }
  if (ctx.role === 'super_admin') return {}
  if (!ctx.enterpriseId) return { id: -1 }
  return { id: ctx.enterpriseId }
}

/** Build where-filter for branches */
function branchWhere(ctx: AuthContext, eid?: number, bid?: number): any {
  const w: any = {}
  if (eid) w.enterpriseId = eid
  if (bid) w.id = bid
  if (ctx.role === 'super_admin') return w
  if (ctx.role === 'enterprise_admin') {
    if (!ctx.enterpriseId) return { id: -1 }
    w.enterpriseId = ctx.enterpriseId
    return w
  }
  // branch_admin / warehouse_admin: only their branch
  if (!ctx.branchId) return { id: -1 }
  w.id = ctx.branchId
  return w
}

/** Build where-filter for warehouses */
function warehouseWhere(ctx: AuthContext, eid?: number, bid?: number): any {
  const w: any = {}
  if (eid) w.enterpriseId = eid
  if (bid) w.branchId = bid
  if (ctx.role === 'super_admin') return w
  if (ctx.role === 'enterprise_admin') {
    if (!ctx.enterpriseId) return { id: -1 }
    w.enterpriseId = ctx.enterpriseId
    return w
  }
  if (ctx.role === 'branch_admin') {
    if (!ctx.branchId) return { id: -1 }
    w.branchId = ctx.branchId
    return w
  }
  // warehouse_admin
  if (!ctx.warehouseId) return { id: -1 }
  w.id = ctx.warehouseId
  return w
}

/** Build where-filter for users */
function userWhere(ctx: AuthContext, eid?: number, bid?: number): any {
  const w: any = {}
  if (eid) w.enterpriseId = eid
  if (bid) w.branchId = bid
  if (ctx.role === 'super_admin') return w
  if (ctx.role === 'enterprise_admin') {
    if (!ctx.enterpriseId) return { id: -1 }
    w.enterpriseId = ctx.enterpriseId
    return w
  }
  if (ctx.role === 'branch_admin') {
    if (!ctx.branchId) return { id: -1 }
    w.branchId = ctx.branchId
    return w
  }
  // warehouse_admin: only self
  w.id = ctx.userId
  return w
}

/** Build where-filter for enterprise-scoped entities (categories, suppliers, products).
 *  Returns a generic shape compatible with any *WhereInput that has enterpriseId. */
function enterpriseScopedWhere(ctx: AuthContext, eid?: number): { enterpriseId?: number } {
  if (eid) return { enterpriseId: eid }
  if (ctx.role === 'super_admin') return {}
  if (!ctx.enterpriseId) return { enterpriseId: -1 }
  return { enterpriseId: ctx.enterpriseId }
}

/** Return list of warehouse IDs accessible to ctx */
async function getAccessibleWarehouseIds(ctx: AuthContext, tx?: Tx): Promise<number[]> {
  const client = tx ?? orm
  if (ctx.role === 'super_admin') {
    const ws = await client.warehouse.findMany({ select: { id: true } })
    return ws.map(w => w.id)
  }
  if (ctx.role === 'enterprise_admin') {
    if (!ctx.enterpriseId) return []
    const ws = await client.warehouse.findMany({ where: { enterpriseId: ctx.enterpriseId }, select: { id: true } })
    return ws.map(w => w.id)
  }
  if (ctx.role === 'branch_admin') {
    if (!ctx.branchId) return []
    const ws = await client.warehouse.findMany({ where: { branchId: ctx.branchId }, select: { id: true } })
    return ws.map(w => w.id)
  }
  return ctx.warehouseId ? [ctx.warehouseId] : []
}

// ─── Serialization Helpers ─────────────────────────────────

/** Convert model rows to plain serializable objects (Date → ISO string).
 *  Returns `unknown` so callers MUST cast to their target type — TypeScript
 *  cannot verify the Date→string conversion structurally. */
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

// ─── Lot Helpers ───────────────────────────────────────────

async function generateLotNumber(tx: Tx): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `LOT-${year}-`
  const count = await tx.lot.count({ where: { lotNumber: { startsWith: prefix } } })
  return `${prefix}${String(count + 1).padStart(4, '0')}`
}

interface CreateLotParams {
  productId: number
  warehouseId: number
  enterpriseId: number
  quantity: number
  unit?: string
  costPerUnit?: number
  supplierName?: string | null
  source: 'stock_in' | 'register_item' | 'adjustment'
  sourceRef?: string | null
  notes?: string | null
  conditionId?: number | null
  receivedDate?: Date
}

async function createLot(tx: Tx, ctx: AuthContext, p: CreateLotParams) {
  const lotNumber = await generateLotNumber(tx)
  const lot = await tx.lot.create({
    data: {
      lotNumber,
      productId: p.productId,
      warehouseId: p.warehouseId,
      enterpriseId: p.enterpriseId,
      quantity: p.quantity,
      remainingQty: p.quantity,
      unit: p.unit || 'piece',
      costPerUnit: p.costPerUnit ?? 0,
      supplierName: p.supplierName ?? null,
      source: p.source,
      sourceRef: p.sourceRef ?? null,
      notes: p.notes ?? null,
      conditionId: p.conditionId ?? null,
      receivedDate: p.receivedDate ?? new Date(),
      closedAt: null,
    },
  })
  await tx.auditLog.create({
    data: {
      userId: ctx.userId,
      enterpriseId: p.enterpriseId,
      action: 'lot.create',
      entity: 'Lot',
      entityId: lot.id,
      details: `Created lot ${lotNumber} for product #${p.productId} / warehouse #${p.warehouseId} (qty=${p.quantity}, source=${p.source})`,
    },
  })
  return lot
}

/**
 * Deduct `quantity` from open lots of (productId, warehouseId) using FIFO.
 * Sets closedAt when a lot's remainingQty hits 0.
 * Throws if total open remainingQty < quantity.
 */
async function deductLotsFIFO(
  tx: Tx,
  ctx: AuthContext,
  productId: number,
  warehouseId: number,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) return
  const openLots = await tx.lot.findMany({
    where: {
      productId,
      warehouseId,
      remainingQty: { gt: 0 },
      closedAt: null,
    },
    orderBy: { receivedDate: 'asc' },
  })
  const totalOpen = openLots.reduce((s, l) => s + l.remainingQty, 0)
  if (totalOpen < quantity) {
    throw new Error(
      `Insufficient open lot quantity for FIFO deduction (product #${productId}, warehouse #${warehouseId}): needed ${quantity}, available ${totalOpen}`,
    )
  }
  let remaining = quantity
  for (const lot of openLots) {
    if (remaining <= 0) break
    const take = Math.min(lot.remainingQty, remaining)
    const newRemaining = lot.remainingQty - take
    await tx.lot.update({
      where: { id: lot.id },
      data: {
        remainingQty: newRemaining,
        closedAt: newRemaining === 0 ? new Date() : null,
      },
    })
    remaining -= take
  }
  await tx.auditLog.create({
    data: {
      userId: ctx.userId,
      enterpriseId: ctx.enterpriseId,
      action: 'lot.deduct_fifo',
      entity: 'Lot',
      entityId: null,
      details: `FIFO-deducted ${quantity} from product #${productId} / warehouse #${warehouseId}`,
    },
  })
}

/**
 * Reverse a lot by sourceRef:
 *   - If remainingQty === quantity (untouched), delete the lot.
 *   - Else, reduce both quantity and remainingQty by `quantity`.
 *
 * If the lot was partially consumed (remainingQty < quantity), we can only
 * restore what's still on the lot (the rest has been shipped out). Caller
 * must adjust stock independently.
 */
async function reverseLot(
  tx: Tx,
  ctx: AuthContext,
  sourceRef: string,
  quantity: number,
): Promise<void> {
  const lot = await tx.lot.findFirst({ where: { sourceRef } })
  if (!lot) {
    // No lot to reverse — silent no-op (defensive).
    return
  }
  if (lot.remainingQty === lot.quantity && lot.quantity === quantity) {
    // Untouched: delete entirely.
    await tx.lot.delete({ where: { id: lot.id } })
    await tx.auditLog.create({
      data: {
        userId: ctx.userId,
        enterpriseId: lot.enterpriseId,
        action: 'lot.reverse_delete',
        entity: 'Lot',
        entityId: lot.id,
        details: `Deleted untouched lot ${lot.lotNumber} (sourceRef=${sourceRef})`,
      },
    })
    return
  }
  // Partially consumed: reduce both quantity & remainingQty by `quantity`
  // (but never below 0).
  const newQty = Math.max(0, lot.quantity - quantity)
  const newRemaining = Math.max(0, lot.remainingQty - quantity)
  await tx.lot.update({
    where: { id: lot.id },
    data: {
      quantity: newQty,
      remainingQty: newRemaining,
      closedAt: newRemaining === 0 ? (lot.closedAt ?? new Date()) : null,
    },
  })
  await tx.auditLog.create({
    data: {
      userId: ctx.userId,
      enterpriseId: lot.enterpriseId,
      action: 'lot.reverse_reduce',
      entity: 'Lot',
      entityId: lot.id,
      details: `Reduced lot ${lot.lotNumber} by ${quantity} (sourceRef=${sourceRef}); new qty=${newQty}, remaining=${newRemaining}`,
    },
  })
}

// ─── Recorder Code Generators ──────────────────────────────

async function generateRecorderCode(tx: Tx, prefix: string, field: 'recorderCode'): Promise<string> {
  const year = new Date().getFullYear()
  const fullPrefix = `${prefix}-${year}-`
  // Count existing recorders with this prefix
  const count =
    prefix === 'SIN'
      ? await tx.stockInRecorder.count({ where: { recorderCode: { startsWith: fullPrefix } } })
      : await tx.stockOutRecorder.count({ where: { recorderCode: { startsWith: fullPrefix } } })
  return `${fullPrefix}${String(count + 1).padStart(4, '0')}`
}

// ─── Domain Objects ────────────────────────────────────────

export const db = {
  // ── Enterprises ─────────────────────────────────────────
  enterprises: {
    findMany: async (ctx: AuthContext, eid?: number): Promise<Enterprise[]> => {
      const rows = await orm.enterprise.findMany({ where: enterpriseWhere(ctx, eid), orderBy: { id: 'asc' } })
      return ser(rows) as Enterprise[]
    },
    findById: async (ctx: AuthContext, id: number): Promise<Enterprise | null> => {
      const e = await orm.enterprise.findUnique({ where: { id } })
      if (!e) return null
      if (!canAccessEnterprise(ctx, e.id)) return null
      return ser(e) as Enterprise
    },
    create: async (ctx: AuthContext, d: Partial<Enterprise>): Promise<Enterprise> => {
      if (ctx.role !== 'super_admin') throw new Error('FORBIDDEN: Only super_admin can create enterprises')
      const created = await orm.$transaction(async (tx) => {
        const e = await tx.enterprise.create({
          data: {
            name: d.name!,
            code: d.code!,
            contactEmail: d.contactEmail || '',
            contactPhone: d.contactPhone || '',
            address: d.address || '',
            isActive: d.isActive ?? true,
            maxBranches: d.maxBranches ?? 10,
            maxWarehouses: d.maxWarehouses ?? 50,
            maxUsers: d.maxUsers ?? 100,
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: e.id,
            action: 'enterprise.create', entity: 'Enterprise', entityId: e.id,
            details: `Created enterprise: ${e.name} (${e.code})`,
          },
        })
        return e
      })
      return ser(created) as Enterprise
    },
    update: async (ctx: AuthContext, id: number, d: Partial<Enterprise>): Promise<Enterprise> => {
      const existing = await orm.enterprise.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (!canAccessEnterprise(ctx, existing.id)) throw new Error('FORBIDDEN: Cannot access this enterprise')
      const updated = await orm.$transaction(async (tx) => {
        const e = await tx.enterprise.update({
          where: { id },
          data: {
            ...(d.name !== undefined ? { name: d.name } : {}),
            ...(d.code !== undefined ? { code: d.code } : {}),
            ...(d.contactEmail !== undefined ? { contactEmail: d.contactEmail } : {}),
            ...(d.contactPhone !== undefined ? { contactPhone: d.contactPhone } : {}),
            ...(d.address !== undefined ? { address: d.address } : {}),
            ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
            ...(ctx.role === 'super_admin' && d.maxBranches !== undefined ? { maxBranches: d.maxBranches } : {}),
            ...(ctx.role === 'super_admin' && d.maxWarehouses !== undefined ? { maxWarehouses: d.maxWarehouses } : {}),
            ...(ctx.role === 'super_admin' && d.maxUsers !== undefined ? { maxUsers: d.maxUsers } : {}),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: e.id,
            action: 'enterprise.update', entity: 'Enterprise', entityId: e.id,
            details: `Updated enterprise: ${e.name} (${e.code})`,
          },
        })
        return e
      })
      return ser(updated) as Enterprise
    },
    remove: async (ctx: AuthContext, id: number): Promise<void> => {
      if (ctx.role !== 'super_admin') throw new Error('FORBIDDEN: Only super_admin can delete enterprises')
      const existing = await orm.enterprise.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      await orm.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: null,
            action: 'enterprise.delete', entity: 'Enterprise', entityId: id,
            details: `Deleted enterprise: ${existing.name} (${existing.code})`,
          },
        })
        await tx.enterprise.delete({ where: { id } })
      })
    },
  },

  // ── Branches ────────────────────────────────────────────
  branches: {
    findMany: async (ctx: AuthContext, eid?: number, bid?: number): Promise<Branch[]> => {
      const rows = await orm.branch.findMany({ where: branchWhere(ctx, eid, bid), orderBy: { id: 'asc' } })
      return ser(rows) as Branch[]
    },
    findById: async (ctx: AuthContext, id: number): Promise<Branch | null> => {
      const b = await orm.branch.findUnique({ where: { id } })
      if (!b) return null
      if (!canAccessBranch(ctx, b.enterpriseId, b.id)) return null
      return ser(b) as Branch
    },
    create: async (ctx: AuthContext, d: Partial<Branch>): Promise<Branch> => {
      if (ctx.role !== 'super_admin' && ctx.role !== 'enterprise_admin') {
        throw new Error('FORBIDDEN: Only super_admin or enterprise_admin can create branches')
      }
      if (ctx.role === 'enterprise_admin' && d.enterpriseId !== ctx.enterpriseId) {
        throw new Error('FORBIDDEN: Cannot create branch in another enterprise')
      }
      const created = await orm.$transaction(async (tx) => {
        const b = await tx.branch.create({
          data: {
            enterpriseId: d.enterpriseId!,
            name: d.name!,
            code: d.code!,
            location: d.location || '',
            managerName: d.managerName || '',
            managerEmail: d.managerEmail || '',
            isActive: d.isActive ?? true,
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: b.enterpriseId,
            action: 'branch.create', entity: 'Branch', entityId: b.id,
            details: `Created branch: ${b.name} (${b.code})`,
          },
        })
        return b
      })
      return ser(created) as Branch
    },
    update: async (ctx: AuthContext, id: number, d: Partial<Branch>): Promise<Branch> => {
      const existing = await orm.branch.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (!canAccessBranch(ctx, existing.enterpriseId, existing.id)) throw new Error('FORBIDDEN')
      const updated = await orm.$transaction(async (tx) => {
        const b = await tx.branch.update({
          where: { id },
          data: {
            ...(d.name !== undefined ? { name: d.name } : {}),
            ...(d.code !== undefined ? { code: d.code } : {}),
            ...(d.location !== undefined ? { location: d.location } : {}),
            ...(d.managerName !== undefined ? { managerName: d.managerName } : {}),
            ...(d.managerEmail !== undefined ? { managerEmail: d.managerEmail } : {}),
            ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: b.enterpriseId,
            action: 'branch.update', entity: 'Branch', entityId: b.id,
            details: `Updated branch: ${b.name} (${b.code})`,
          },
        })
        return b
      })
      return ser(updated) as Branch
    },
    remove: async (ctx: AuthContext, id: number): Promise<void> => {
      const existing = await orm.branch.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (ctx.role !== 'super_admin' && ctx.role !== 'enterprise_admin') throw new Error('FORBIDDEN')
      if (!canAccessBranch(ctx, existing.enterpriseId, existing.id)) throw new Error('FORBIDDEN')
      await orm.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: existing.enterpriseId,
            action: 'branch.delete', entity: 'Branch', entityId: id,
            details: `Deleted branch: ${existing.name} (${existing.code})`,
          },
        })
        await tx.branch.delete({ where: { id } })
      })
    },
  },

  // ── Warehouses ──────────────────────────────────────────
  warehouses: {
    findMany: async (ctx: AuthContext, eid?: number, bid?: number): Promise<Warehouse[]> => {
      const rows = await orm.warehouse.findMany({ where: warehouseWhere(ctx, eid, bid), orderBy: { id: 'asc' } })
      return ser(rows) as Warehouse[]
    },
    findById: async (ctx: AuthContext, id: number): Promise<Warehouse | null> => {
      const w = await orm.warehouse.findUnique({ where: { id } })
      if (!w) return null
      if (!canAccessWarehouse(ctx, w.enterpriseId, w.branchId, w.id)) return null
      return ser(w) as Warehouse
    },
    create: async (ctx: AuthContext, d: Partial<Warehouse>): Promise<Warehouse> => {
      if (ctx.role === 'warehouse_admin') throw new Error('FORBIDDEN: warehouse_admin cannot create warehouses')
      if (ctx.role === 'branch_admin' && d.branchId !== ctx.branchId) {
        throw new Error('FORBIDDEN: Cannot create warehouse in another branch')
      }
      if (ctx.role === 'enterprise_admin' && d.enterpriseId !== ctx.enterpriseId) {
        throw new Error('FORBIDDEN: Cannot create warehouse in another enterprise')
      }
      const created = await orm.$transaction(async (tx) => {
        const w = await tx.warehouse.create({
          data: {
            enterpriseId: d.enterpriseId!,
            branchId: d.branchId!,
            name: d.name!,
            code: d.code!,
            location: d.location || '',
            capacity: d.capacity ?? 1000,
            managerName: d.managerName || '',
            isActive: d.isActive ?? true,
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: w.enterpriseId,
            action: 'warehouse.create', entity: 'Warehouse', entityId: w.id,
            details: `Created warehouse: ${w.name} (${w.code})`,
          },
        })
        return w
      })
      return ser(created) as Warehouse
    },
    update: async (ctx: AuthContext, id: number, d: Partial<Warehouse>): Promise<Warehouse> => {
      const existing = await orm.warehouse.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (!canAccessWarehouse(ctx, existing.enterpriseId, existing.branchId, existing.id)) throw new Error('FORBIDDEN')
      const updated = await orm.$transaction(async (tx) => {
        const w = await tx.warehouse.update({
          where: { id },
          data: {
            ...(d.name !== undefined ? { name: d.name } : {}),
            ...(d.code !== undefined ? { code: d.code } : {}),
            ...(d.location !== undefined ? { location: d.location } : {}),
            ...(d.capacity !== undefined ? { capacity: d.capacity } : {}),
            ...(d.managerName !== undefined ? { managerName: d.managerName } : {}),
            ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: w.enterpriseId,
            action: 'warehouse.update', entity: 'Warehouse', entityId: w.id,
            details: `Updated warehouse: ${w.name} (${w.code})`,
          },
        })
        return w
      })
      return ser(updated) as Warehouse
    },
    remove: async (ctx: AuthContext, id: number): Promise<void> => {
      const existing = await orm.warehouse.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (ctx.role === 'warehouse_admin') throw new Error('FORBIDDEN')
      if (!canAccessWarehouse(ctx, existing.enterpriseId, existing.branchId, existing.id)) throw new Error('FORBIDDEN')
      await orm.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: existing.enterpriseId,
            action: 'warehouse.delete', entity: 'Warehouse', entityId: id,
            details: `Deleted warehouse: ${existing.name} (${existing.code})`,
          },
        })
        await tx.warehouse.delete({ where: { id } })
      })
    },
  },

  // ── Users ───────────────────────────────────────────────
  users: {
    findMany: async (ctx: AuthContext, eid?: number, bid?: number): Promise<User[]> => {
      const rows = await orm.user.findMany({
        where: userWhere(ctx, eid, bid),
        orderBy: { id: 'asc' },
        select: {
          id: true, enterpriseId: true, branchId: true, warehouseId: true,
          username: true, email: true, fullName: true, role: true, isActive: true, mustResetPassword: true,
          createdAt: true, updatedAt: true,
          // NOTE: passwordHash intentionally omitted from list view
        },
      })
      return ser(rows) as User[]
    },
    findById: async (ctx: AuthContext, id: number): Promise<User | null> => {
      const u = await orm.user.findUnique({
        where: { id },
        select: {
          id: true, enterpriseId: true, branchId: true, warehouseId: true,
          username: true, email: true, fullName: true, role: true, isActive: true, mustResetPassword: true,
          createdAt: true, updatedAt: true,
        },
      })
      if (!u) return null
      if (u.id === ctx.userId) return ser(u) as User
      if (ctx.role === 'super_admin') return ser(u) as User
      if (ctx.role === 'enterprise_admin' && u.enterpriseId === ctx.enterpriseId) return ser(u) as User
      if (ctx.role === 'branch_admin' && u.branchId === ctx.branchId) return ser(u) as User
      if (ctx.role === 'warehouse_admin' && u.id === ctx.userId) return ser(u) as User
      return null
    },
    /** Authenticate by username + plaintext password (uses bcrypt.compare) */
    authenticate: async (username: string, password: string): Promise<User | null> => {
      const bcrypt = await import('bcryptjs')
      const u = await orm.user.findUnique({ where: { username } })
      if (!u || !u.isActive) return null
      const ok = await bcrypt.compare(password, u.passwordHash)
      if (!ok) return null
      const { passwordHash: _ph, ...safe } = u
      return ser(safe) as User
    },
    create: async (ctx: AuthContext, d: Partial<User> & { password?: string }): Promise<User> => {
      if (ctx.role === 'warehouse_admin') throw new Error('FORBIDDEN: warehouse_admin cannot create users')
      if (ctx.role === 'branch_admin') {
        if (d.role !== 'warehouse_admin') throw new Error('FORBIDDEN: branch_admin can only create warehouse_admin users')
        if (d.branchId !== ctx.branchId) throw new Error('FORBIDDEN: Cannot create user in another branch')
        if (d.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN: Cannot create user in another enterprise')
      }
      if (ctx.role === 'enterprise_admin') {
        if (d.role === 'super_admin') throw new Error('FORBIDDEN: Cannot create super_admin')
        if (d.role === 'enterprise_admin') throw new Error('FORBIDDEN: Cannot create peer enterprise_admin')
        if (d.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN: Cannot create user in another enterprise')
      }
      // ENFORCE SINGLE SUPER_ADMIN: no one can create a super_admin via this endpoint.
      // The only super_admin is the seeded one.
      if (d.role === 'super_admin') throw new Error('FORBIDDEN: Cannot create super_admin (single super admin policy)')
      const bcrypt = await import('bcryptjs')
      const passwordHash = d.password
        ? await bcrypt.hash(d.password, 10)
        : await bcrypt.hash('admin123', 10)
      const created = await orm.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            enterpriseId: d.enterpriseId ?? null,
            branchId: d.branchId ?? null,
            warehouseId: d.warehouseId ?? null,
            username: d.username!,
            email: d.email || '',
            fullName: d.fullName!,
            role: d.role as Role,
            isActive: d.isActive ?? true,
            passwordHash,
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: u.enterpriseId,
            action: 'user.create', entity: 'User', entityId: u.id,
            details: `Created user: ${u.username} (${u.fullName}, role=${u.role})`,
          },
        })
        return u
      })
      // Seed default permissions for the new user (skips super_admin internally)
      const { seedDefaultPermissions } = await import('./permissions')
      await seedDefaultPermissions(created.id, created.role, ctx.userId || undefined)
      const { passwordHash: _ph, ...safe } = created
      return ser(safe) as User
    },
    update: async (ctx: AuthContext, id: number, d: Partial<User> & { password?: string }): Promise<User> => {
      const existing = await orm.user.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      // Self-update is allowed for non-role changes
      if (id !== ctx.userId) {
        if (!canManageUser(ctx, existing)) throw new Error('FORBIDDEN: Cannot manage this user')
      }
      const bcrypt = await import('bcryptjs')
      const passwordHash = d.password ? await bcrypt.hash(d.password, 10) : undefined
      const updated = await orm.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id },
          data: {
            ...(d.username !== undefined ? { username: d.username } : {}),
            ...(d.email !== undefined ? { email: d.email } : {}),
            ...(d.fullName !== undefined ? { fullName: d.fullName } : {}),
            ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
            ...(d.enterpriseId !== undefined ? { enterpriseId: d.enterpriseId } : {}),
            ...(d.branchId !== undefined ? { branchId: d.branchId } : {}),
            ...(d.warehouseId !== undefined ? { warehouseId: d.warehouseId } : {}),
            ...(d.role !== undefined && id !== ctx.userId ? { role: d.role as Role } : {}),
            ...(d.mustResetPassword !== undefined ? { mustResetPassword: d.mustResetPassword } : {}),
            ...(passwordHash !== undefined ? { passwordHash, mustResetPassword: false } : {}),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: u.enterpriseId,
            action: 'user.update', entity: 'User', entityId: u.id,
            details: `Updated user: ${u.username} (${u.fullName})`,
          },
        })
        return u
      })
      const { passwordHash: _ph, ...safe } = updated
      return ser(safe) as User
    },
    remove: async (ctx: AuthContext, id: number): Promise<void> => {
      const existing = await orm.user.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (id === ctx.userId) throw new Error('FORBIDDEN: Cannot delete your own account')
      if (!canManageUser(ctx, existing)) throw new Error('FORBIDDEN: Cannot delete this user')
      await orm.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: existing.enterpriseId,
            action: 'user.delete', entity: 'User', entityId: id,
            details: `Deleted user: ${existing.username} (${existing.fullName})`,
          },
        })
        await tx.user.delete({ where: { id } })
      })
    },
  },

  // ── Categories ──────────────────────────────────────────
  categories: {
    findMany: async (ctx: AuthContext, eid?: number): Promise<Category[]> => {
      const where: any = eid ? { enterpriseId: eid } : enterpriseScopedWhere(ctx)
      const rows = await orm.category.findMany({ where, orderBy: { id: 'asc' } })
      return ser(rows) as Category[]
    },
    findById: async (ctx: AuthContext, id: number): Promise<Category | null> => {
      const c = await orm.category.findUnique({ where: { id } })
      if (!c) return null
      if (!canAccessEnterprise(ctx, c.enterpriseId)) return null
      return ser(c) as Category
    },
    create: async (ctx: AuthContext, d: Partial<Category>): Promise<Category> => {
      if (ctx.role === 'warehouse_admin') throw new Error('FORBIDDEN')
      if (ctx.role !== 'super_admin' && d.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const created = await orm.$transaction(async (tx) => {
        const c = await tx.category.create({
          data: {
            enterpriseId: d.enterpriseId!,
            name: d.name!,
            description: d.description || '',
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: c.enterpriseId,
            action: 'category.create', entity: 'Category', entityId: c.id,
            details: `Created category: ${c.name}`,
          },
        })
        return c
      })
      return ser(created) as Category
    },
    update: async (ctx: AuthContext, id: number, d: Partial<Category>): Promise<Category> => {
      const existing = await orm.category.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (!canAccessEnterprise(ctx, existing.enterpriseId)) throw new Error('FORBIDDEN')
      if (ctx.role === 'warehouse_admin' || ctx.role === 'branch_admin') throw new Error('FORBIDDEN')
      const updated = await orm.$transaction(async (tx) => {
        const c = await tx.category.update({
          where: { id },
          data: {
            ...(d.name !== undefined ? { name: d.name } : {}),
            ...(d.description !== undefined ? { description: d.description } : {}),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: c.enterpriseId,
            action: 'category.update', entity: 'Category', entityId: c.id,
            details: `Updated category: ${c.name}`,
          },
        })
        return c
      })
      return ser(updated) as Category
    },
    remove: async (ctx: AuthContext, id: number): Promise<void> => {
      const existing = await orm.category.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (!canAccessEnterprise(ctx, existing.enterpriseId)) throw new Error('FORBIDDEN')
      if (ctx.role === 'warehouse_admin' || ctx.role === 'branch_admin') throw new Error('FORBIDDEN')
      await orm.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: existing.enterpriseId,
            action: 'category.delete', entity: 'Category', entityId: id,
            details: `Deleted category: ${existing.name}`,
          },
        })
        await tx.category.delete({ where: { id } })
      })
    },
  },

  // ── Conditions ──────────────────────────────────────────
  conditions: {
    findMany: async (ctx: AuthContext, eid?: number): Promise<Condition[]> => {
      const where: any = eid ? { enterpriseId: eid } : enterpriseScopedWhere(ctx)
      const rows = await orm.condition.findMany({ where, orderBy: { id: 'asc' } })
      return ser(rows) as Condition[]
    },
    findById: async (ctx: AuthContext, id: number): Promise<Condition | null> => {
      const c = await orm.condition.findUnique({ where: { id } })
      if (!c) return null
      if (!canAccessEnterprise(ctx, c.enterpriseId)) return null
      return ser(c) as Condition
    },
    create: async (ctx: AuthContext, d: Partial<Condition>): Promise<Condition> => {
      if (ctx.role === 'warehouse_admin') throw new Error('FORBIDDEN')
      if (ctx.role !== 'super_admin' && d.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const created = await orm.$transaction(async (tx) => {
        const c = await tx.condition.create({
          data: {
            enterpriseId: d.enterpriseId!,
            name: d.name!,
            description: d.description || '',
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: c.enterpriseId,
            action: 'condition.create', entity: 'Condition', entityId: c.id,
            details: `Created condition: ${c.name}`,
          },
        })
        return c
      })
      return ser(created) as Condition
    },
    update: async (ctx: AuthContext, id: number, d: Partial<Condition>): Promise<Condition> => {
      const existing = await orm.condition.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (!canAccessEnterprise(ctx, existing.enterpriseId)) throw new Error('FORBIDDEN')
      if (ctx.role === 'warehouse_admin' || ctx.role === 'branch_admin') throw new Error('FORBIDDEN')
      const updated = await orm.$transaction(async (tx) => {
        const c = await tx.condition.update({
          where: { id },
          data: {
            ...(d.name !== undefined ? { name: d.name } : {}),
            ...(d.description !== undefined ? { description: d.description } : {}),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: c.enterpriseId,
            action: 'condition.update', entity: 'Condition', entityId: c.id,
            details: `Updated condition: ${c.name}`,
          },
        })
        return c
      })
      return ser(updated) as Condition
    },
    remove: async (ctx: AuthContext, id: number): Promise<void> => {
      const existing = await orm.condition.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (!canAccessEnterprise(ctx, existing.enterpriseId)) throw new Error('FORBIDDEN')
      if (ctx.role === 'warehouse_admin' || ctx.role === 'branch_admin') throw new Error('FORBIDDEN')
      await orm.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: existing.enterpriseId,
            action: 'condition.delete', entity: 'Condition', entityId: id,
            details: `Deleted condition: ${existing.name}`,
          },
        })
        await tx.condition.delete({ where: { id } })
      })
    },
  },

  // ── Suppliers ───────────────────────────────────────────
  suppliers: {
    findMany: async (ctx: AuthContext, eid?: number): Promise<Supplier[]> => {
      const where: any = eid ? { enterpriseId: eid } : enterpriseScopedWhere(ctx)
      const rows = await orm.supplier.findMany({ where, orderBy: { id: 'asc' } })
      return ser(rows) as Supplier[]
    },
    findById: async (ctx: AuthContext, id: number): Promise<Supplier | null> => {
      const s = await orm.supplier.findUnique({ where: { id } })
      if (!s) return null
      if (!canAccessEnterprise(ctx, s.enterpriseId)) return null
      return ser(s) as Supplier
    },
    create: async (ctx: AuthContext, d: Partial<Supplier>): Promise<Supplier> => {
      if (ctx.role === 'warehouse_admin' || ctx.role === 'branch_admin') throw new Error('FORBIDDEN')
      if (ctx.role !== 'super_admin' && d.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const created = await orm.$transaction(async (tx) => {
        const s = await tx.supplier.create({
          data: {
            enterpriseId: d.enterpriseId!,
            name: d.name!,
            contactPerson: d.contactPerson || '',
            email: d.email || '',
            phone: d.phone || '',
            address: d.address || '',
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: s.enterpriseId,
            action: 'supplier.create', entity: 'Supplier', entityId: s.id,
            details: `Created supplier: ${s.name}`,
          },
        })
        return s
      })
      return ser(created) as Supplier
    },
    update: async (ctx: AuthContext, id: number, d: Partial<Supplier>): Promise<Supplier> => {
      const existing = await orm.supplier.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (!canAccessEnterprise(ctx, existing.enterpriseId)) throw new Error('FORBIDDEN')
      if (ctx.role === 'warehouse_admin' || ctx.role === 'branch_admin') throw new Error('FORBIDDEN')
      const updated = await orm.$transaction(async (tx) => {
        const s = await tx.supplier.update({
          where: { id },
          data: {
            ...(d.name !== undefined ? { name: d.name } : {}),
            ...(d.contactPerson !== undefined ? { contactPerson: d.contactPerson } : {}),
            ...(d.email !== undefined ? { email: d.email } : {}),
            ...(d.phone !== undefined ? { phone: d.phone } : {}),
            ...(d.address !== undefined ? { address: d.address } : {}),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: s.enterpriseId,
            action: 'supplier.update', entity: 'Supplier', entityId: s.id,
            details: `Updated supplier: ${s.name}`,
          },
        })
        return s
      })
      return ser(updated) as Supplier
    },
    remove: async (ctx: AuthContext, id: number): Promise<void> => {
      const existing = await orm.supplier.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (!canAccessEnterprise(ctx, existing.enterpriseId)) throw new Error('FORBIDDEN')
      if (ctx.role === 'warehouse_admin' || ctx.role === 'branch_admin') throw new Error('FORBIDDEN')
      await orm.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: existing.enterpriseId,
            action: 'supplier.delete', entity: 'Supplier', entityId: id,
            details: `Deleted supplier: ${existing.name}`,
          },
        })
        await tx.supplier.delete({ where: { id } })
      })
    },
  },

  // ── Products ────────────────────────────────────────────
  products: {
    findMany: async (ctx: AuthContext, eid?: number): Promise<Product[]> => {
      const where: any = eid ? { enterpriseId: eid } : enterpriseScopedWhere(ctx)
      const rows = await orm.product.findMany({ where, orderBy: { id: 'asc' } })
      return ser(rows) as Product[]
    },
    findById: async (ctx: AuthContext, id: number): Promise<Product | null> => {
      const p = await orm.product.findUnique({ where: { id } })
      if (!p) return null
      if (!canAccessEnterprise(ctx, p.enterpriseId)) return null
      return ser(p) as Product
    },
    create: async (ctx: AuthContext, d: Partial<Product>): Promise<Product> => {
      if (ctx.role === 'warehouse_admin') throw new Error('FORBIDDEN')
      if (ctx.role !== 'super_admin' && d.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const created = await orm.$transaction(async (tx) => {
        const p = await tx.product.create({
          data: {
            enterpriseId: d.enterpriseId!,
            name: d.name!,
            sku: d.sku!,
            description: d.description || '',
            categoryId: d.categoryId ?? null,
            price: d.price ?? 0,
            cost: d.cost ?? 0,
            unit: d.unit || 'piece',
            reorderLevel: d.reorderLevel ?? 10,
            isActive: d.isActive ?? true,
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: p.enterpriseId,
            action: 'product.create', entity: 'Product', entityId: p.id,
            details: `Created product: ${p.name} (${p.sku})`,
          },
        })
        return p
      })
      return ser(created) as Product
    },
    update: async (ctx: AuthContext, id: number, d: Partial<Product>): Promise<Product> => {
      const existing = await orm.product.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (!canAccessEnterprise(ctx, existing.enterpriseId)) throw new Error('FORBIDDEN')
      if (ctx.role === 'warehouse_admin') throw new Error('FORBIDDEN')
      const updated = await orm.$transaction(async (tx) => {
        const p = await tx.product.update({
          where: { id },
          data: {
            ...(d.name !== undefined ? { name: d.name } : {}),
            ...(d.sku !== undefined ? { sku: d.sku } : {}),
            ...(d.description !== undefined ? { description: d.description } : {}),
            ...(d.categoryId !== undefined ? { categoryId: d.categoryId } : {}),
            ...(d.price !== undefined ? { price: d.price } : {}),
            ...(d.cost !== undefined ? { cost: d.cost } : {}),
            ...(d.unit !== undefined ? { unit: d.unit } : {}),
            ...(d.reorderLevel !== undefined ? { reorderLevel: d.reorderLevel } : {}),
            ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: p.enterpriseId,
            action: 'product.update', entity: 'Product', entityId: p.id,
            details: `Updated product: ${p.name} (${p.sku})`,
          },
        })
        return p
      })
      return ser(updated) as Product
    },
    remove: async (ctx: AuthContext, id: number): Promise<void> => {
      const existing = await orm.product.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (!canAccessEnterprise(ctx, existing.enterpriseId)) throw new Error('FORBIDDEN')
      if (ctx.role === 'warehouse_admin') throw new Error('FORBIDDEN')
      await orm.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: existing.enterpriseId,
            action: 'product.delete', entity: 'Product', entityId: id,
            details: `Deleted product: ${existing.name} (${existing.sku})`,
          },
        })
        await tx.product.delete({ where: { id } })
      })
    },
  },

  // ── Stock ───────────────────────────────────────────────
  stock: {
    findMany: async (ctx: AuthContext): Promise<Stock[]> => {
      const whIds = await getAccessibleWarehouseIds(ctx)
      if (whIds.length === 0) return []
      const rows = await orm.stock.findMany({
        where: { warehouseId: { in: whIds } },
        orderBy: { id: 'asc' },
      })
      return ser(rows) as Stock[]
    },
    findById: async (ctx: AuthContext, id: number): Promise<Stock | null> => {
      const s = await orm.stock.findUnique({ where: { id } })
      if (!s) return null
      const w = await orm.warehouse.findUnique({ where: { id: s.warehouseId } })
      if (!w) return null
      if (!canAccessWarehouse(ctx, w.enterpriseId, w.branchId, w.id)) return null
      return ser(s) as Stock
    },
    /** Quick stock-in: upsert Stock + create Lot (source='adjustment') */
    stockIn: async (
      ctx: AuthContext,
      d: {
        productId: number; warehouseId: number; quantity: number
        unit?: string; costPerUnit?: number; supplierName?: string | null; notes?: string | null
        conditionId?: number | null
      },
    ): Promise<Stock> => {
      if (d.quantity <= 0) throw new Error('Validation: quantity must be positive')
      const wh = await orm.warehouse.findUnique({ where: { id: d.warehouseId } })
      if (!wh) throw new Error(`Warehouse #${d.warehouseId} not found`)
      const prod = await orm.product.findUnique({ where: { id: d.productId } })
      if (!prod) throw new Error(`Product #${d.productId} not found. Register the product first before adding stock.`)
      if (!canAccessWarehouse(ctx, wh.enterpriseId, wh.branchId, wh.id)) throw new Error('FORBIDDEN: Cannot add stock in this warehouse')
      const result = await orm.$transaction(async (tx) => {
        const s = await tx.stock.upsert({
          where: { productId_warehouseId: { productId: d.productId, warehouseId: d.warehouseId } },
          update: { quantity: { increment: d.quantity } },
          create: { productId: d.productId, warehouseId: d.warehouseId, quantity: d.quantity },
        })
        await createLot(tx, ctx, {
          productId: d.productId,
          warehouseId: d.warehouseId,
          enterpriseId: wh.enterpriseId,
          quantity: d.quantity,
          unit: d.unit || prod.unit,
          costPerUnit: d.costPerUnit ?? prod.cost,
          supplierName: d.supplierName ?? null,
          source: 'adjustment',
          sourceRef: null,
          notes: d.notes ?? null,
          conditionId: d.conditionId ?? null,
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: wh.enterpriseId,
            action: 'stock_in', entity: 'Stock', entityId: s.id,
            details: `Stock in: +${d.quantity} ${d.unit || prod.unit} of ${prod.name} to ${wh.name}. New total: ${s.quantity}`,
          },
        })
        return s
      })
      return ser(result) as Stock
    },
    /** Adjust stock to a new quantity; if increasing, creates a Lot for the diff */
    adjust: async (
      ctx: AuthContext,
      d: { productId: number; warehouseId: number; newQuantity: number; unit?: string; costPerUnit?: number; notes?: string | null },
    ): Promise<Stock> => {
      if (d.newQuantity < 0) throw new Error('Validation: newQuantity cannot be negative')
      const wh = await orm.warehouse.findUnique({ where: { id: d.warehouseId } })
      if (!wh) throw new Error('Warehouse not found')
      const prod = await orm.product.findUnique({ where: { id: d.productId } })
      if (!prod) throw new Error('Product not found')
      if (!canAccessWarehouse(ctx, wh.enterpriseId, wh.branchId, wh.id)) throw new Error('FORBIDDEN')
      const result = await orm.$transaction(async (tx) => {
        const existing = await tx.stock.findUnique({
          where: { productId_warehouseId: { productId: d.productId, warehouseId: d.warehouseId } },
        })
        const currentQty = existing?.quantity ?? 0
        const diff = d.newQuantity - currentQty
        const s = await tx.stock.upsert({
          where: { productId_warehouseId: { productId: d.productId, warehouseId: d.warehouseId } },
          update: { quantity: d.newQuantity },
          create: { productId: d.productId, warehouseId: d.warehouseId, quantity: d.newQuantity },
        })
        if (diff > 0) {
          await createLot(tx, ctx, {
            productId: d.productId,
            warehouseId: d.warehouseId,
            enterpriseId: wh.enterpriseId,
            quantity: diff,
            unit: d.unit || prod.unit,
            costPerUnit: d.costPerUnit ?? prod.cost,
            source: 'adjustment',
            sourceRef: null,
            notes: d.notes ?? `Manual adjust from ${currentQty} to ${d.newQuantity}`,
          })
        }
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: wh.enterpriseId,
            action: 'stock_adjust', entity: 'Stock', entityId: s.id,
            details: `Stock adjust: ${prod.name} in ${wh.name} from ${currentQty} to ${d.newQuantity} (diff ${diff > 0 ? '+' : ''}${diff})`,
          },
        })
        return s
      })
      return ser(result) as Stock
    },
    remove: async (ctx: AuthContext, id: number): Promise<void> => {
      const existing = await orm.stock.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      const w = await orm.warehouse.findUnique({ where: { id: existing.warehouseId } })
      if (!w) throw new Error('Not found')
      if (!canAccessWarehouse(ctx, w.enterpriseId, w.branchId, w.id)) throw new Error('FORBIDDEN')
      await orm.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: w.enterpriseId,
            action: 'stock.delete', entity: 'Stock', entityId: id,
            details: `Deleted stock row #${id} (product #${existing.productId}, warehouse #${existing.warehouseId}, qty was ${existing.quantity})`,
          },
        })
        await tx.stock.delete({ where: { id } })
      })
    },
  },

  // ── Lots (Change 2) ─────────────────────────────────────
  lots: {
    findByProductWarehouse: async (ctx: AuthContext, productId: number, warehouseId: number): Promise<Lot[]> => {
      const w = await orm.warehouse.findUnique({ where: { id: warehouseId } })
      if (!w) return []
      if (!canAccessWarehouse(ctx, w.enterpriseId, w.branchId, w.id)) return []
      const rows = await orm.lot.findMany({
        where: { productId, warehouseId },
        include: { condition: true },
        orderBy: { receivedDate: 'asc' },
      })
      const serialized = ser(rows) as Lot[]
      return serialized.map(l => ({ ...l, status: (l.remainingQty > 0 && !l.closedAt) ? 'open' : 'closed' as const }))
    },
    findByProduct: async (ctx: AuthContext, productId: number): Promise<Lot[]> => {
      const p = await orm.product.findUnique({ where: { id: productId } })
      if (!p) return []
      if (!canAccessEnterprise(ctx, p.enterpriseId)) return []
      const whIds = await getAccessibleWarehouseIds(ctx)
      const rows = await orm.lot.findMany({
        where: { productId, warehouseId: whIds.length ? { in: whIds } : undefined },
        include: { condition: true },
        orderBy: { receivedDate: 'asc' },
      })
      const serialized = ser(rows) as Lot[]
      return serialized.map(l => ({ ...l, status: (l.remainingQty > 0 && !l.closedAt) ? 'open' : 'closed' as const }))
    },
    findMany: async (ctx: AuthContext, filters?: { productId?: number; warehouseId?: number; openOnly?: boolean }): Promise<Lot[]> => {
      const whIds = await getAccessibleWarehouseIds(ctx)
      if (whIds.length === 0) return []
      const where: any = { warehouseId: { in: whIds } }
      if (filters?.productId) where.productId = filters.productId
      if (filters?.warehouseId) where.warehouseId = filters.warehouseId
      if (filters?.openOnly) {
        where.remainingQty = { gt: 0 }
        where.closedAt = null
      }
      const rows = await orm.lot.findMany({ where, include: { condition: true }, orderBy: { receivedDate: 'asc' } })
      const serialized = ser(rows) as Lot[]
      return serialized.map(l => ({ ...l, status: (l.remainingQty > 0 && !l.closedAt) ? 'open' : 'closed' as const }))
    },
  },

  // ── Stock In Recorders ──────────────────────────────────
  stockIn: {
    findMany: async (ctx: AuthContext, eid?: number, wid?: number): Promise<StockInRecorder[]> => {
      const whIds = await getAccessibleWarehouseIds(ctx)
      if (whIds.length === 0) return []
      const where: any = { warehouseId: { in: whIds } }
      if (eid) where.enterpriseId = eid
      if (wid) where.warehouseId = wid
      const rows = await orm.stockInRecorder.findMany({
        where,
        orderBy: { id: 'desc' },
        include: { items: { include: { condition: true } }, personUser: { select: { id: true, username: true, fullName: true, role: true } } },
      })
      return ser(rows) as StockInRecorder[]
    },
    findById: async (ctx: AuthContext, id: number): Promise<StockInRecorder | null> => {
      const r = await orm.stockInRecorder.findUnique({
        where: { id },
        include: { items: { include: { condition: true } }, personUser: { select: { id: true, username: true, fullName: true, role: true } } },
      })
      if (!r) return null
      if (!canAccessWarehouse(ctx, r.enterpriseId, null, r.warehouseId) && ctx.role !== 'super_admin' && r.enterpriseId !== ctx.enterpriseId) return null
      return ser(r) as StockInRecorder
    },
    create: async (ctx: AuthContext, d: Partial<StockInRecorder>): Promise<StockInRecorder> => {
      if (ctx.role !== 'super_admin' && d.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const wh = await orm.warehouse.findUnique({ where: { id: d.warehouseId! } })
      if (!wh) throw new Error('Warehouse not found')
      if (!canAccessWarehouse(ctx, wh.enterpriseId, wh.branchId, wh.id)) throw new Error('FORBIDDEN')
      const created = await orm.$transaction(async (tx) => {
        const recorderCode = await generateRecorderCode(tx, 'SIN', 'recorderCode')
        const r = await tx.stockInRecorder.create({
          data: {
            enterpriseId: d.enterpriseId!,
            warehouseId: d.warehouseId!,
            recorderCode,
            personName: d.personName || '',
            personPhone: d.personPhone || '',
            personEmail: d.personEmail || '',
            personAddress: d.personAddress || '',
            personUserId: (d as any).personUserId ?? null,
            notes: d.notes || '',
            status: (d.status as 'pending' | 'submitted') || 'pending',
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: r.enterpriseId,
            action: 'stock_in.create', entity: 'StockInRecorder', entityId: r.id,
            details: `Created stock-in recorder ${r.recorderCode}`,
          },
        })
        return r
      })
      return ser(created) as StockInRecorder
    },
    update: async (ctx: AuthContext, id: number, d: Partial<StockInRecorder>): Promise<StockInRecorder> => {
      const existing = await orm.stockInRecorder.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (ctx.role !== 'super_admin' && existing.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const updated = await orm.$transaction(async (tx) => {
        const r = await tx.stockInRecorder.update({
          where: { id },
          data: {
            ...(d.personName !== undefined ? { personName: d.personName } : {}),
            ...(d.personPhone !== undefined ? { personPhone: d.personPhone } : {}),
            ...(d.personEmail !== undefined ? { personEmail: d.personEmail } : {}),
            ...(d.personAddress !== undefined ? { personAddress: d.personAddress } : {}),
            ...((d as any).personUserId !== undefined ? { personUserId: (d as any).personUserId } : {}),
            ...(d.notes !== undefined ? { notes: d.notes } : {}),
            ...(d.status !== undefined ? { status: d.status } : {}),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: r.enterpriseId,
            action: 'stock_in.update', entity: 'StockInRecorder', entityId: r.id,
            details: `Updated stock-in recorder ${r.recorderCode}`,
          },
        })
        return r
      })
      return ser(updated) as StockInRecorder
    },
    /** Add item to a stock-in recorder: increment stock + create Lot (source='stock_in') */
    addItem: async (
      ctx: AuthContext,
      recorderId: number,
      d: Partial<StockInItem>,
    ): Promise<StockInItem> => {
      const r = await orm.stockInRecorder.findUnique({ where: { id: recorderId } })
      if (!r) throw new Error(`Stock-in recorder #${recorderId} not found`)
      if (ctx.role !== 'super_admin' && r.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const qty = d.quantity ?? 0
      if (qty <= 0) throw new Error('Validation: quantity must be positive')
      if (!d.productId) throw new Error('Validation: productId is required')
      if (!d.warehouseId) throw new Error('Validation: warehouseId is required')
      const prod = await orm.product.findUnique({ where: { id: d.productId } })
      if (!prod) throw new Error(`Product #${d.productId} not found`)
      const wh = await orm.warehouse.findUnique({ where: { id: d.warehouseId } })
      if (!wh) throw new Error(`Warehouse #${d.warehouseId} not found`)
      if (!canAccessWarehouse(ctx, wh.enterpriseId, wh.branchId, wh.id)) throw new Error('FORBIDDEN')
      const result = await orm.$transaction(async (tx) => {
        const item = await tx.stockInItem.create({
          data: {
            recorderId,
            productId: d.productId!,
            warehouseId: d.warehouseId!,
            quantity: qty,
            unit: d.unit || prod.unit,
            costPerUnit: d.costPerUnit ?? prod.cost,
            notes: d.notes || '',
            conditionId: d.conditionId ?? null,
          },
        })
        const s = await tx.stock.upsert({
          where: { productId_warehouseId: { productId: d.productId!, warehouseId: d.warehouseId! } },
          update: { quantity: { increment: qty } },
          create: { productId: d.productId!, warehouseId: d.warehouseId!, quantity: qty },
        })
        await createLot(tx, ctx, {
          productId: d.productId!,
          warehouseId: d.warehouseId!,
          enterpriseId: r.enterpriseId,
          quantity: qty,
          unit: d.unit || prod.unit,
          costPerUnit: d.costPerUnit ?? prod.cost,
          supplierName: r.personName || null,
          source: 'stock_in',
          sourceRef: `${r.recorderCode}-${item.id}`,
          notes: d.notes || null,
          conditionId: d.conditionId ?? null,
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: r.enterpriseId,
            action: 'stock_in_add_item', entity: 'StockInItem', entityId: item.id,
            details: `Stock in ${qty} ${d.unit || prod.unit} of ${prod.name} to ${wh.name} (recorder ${r.recorderCode}). Stock now ${s.quantity}`,
          },
        })
        return item
      })
      return ser(result) as StockInItem
    },
    /** Remove a stock-in item: reverse Lot + decrement stock + delete item */
    removeItem: async (ctx: AuthContext, recorderId: number, itemId: number): Promise<void> => {
      const r = await orm.stockInRecorder.findUnique({ where: { id: recorderId } })
      if (!r) throw new Error(`Stock-in recorder #${recorderId} not found`)
      if (ctx.role !== 'super_admin' && r.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const item = await orm.stockInItem.findUnique({ where: { id: itemId } })
      if (!item || item.recorderId !== recorderId) throw new Error(`Item #${itemId} not found in recorder #${recorderId}`)
      const prod = await orm.product.findUnique({ where: { id: item.productId } })
      await orm.$transaction(async (tx) => {
        // Reverse the lot (delete if untouched, reduce if partially consumed)
        await reverseLot(tx, ctx, `${r.recorderCode}-${itemId}`, item.quantity)
        // Decrement stock (never below 0)
        const existing = await tx.stock.findUnique({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
        })
        if (existing) {
          await tx.stock.update({
            where: { id: existing.id },
            data: { quantity: Math.max(0, existing.quantity - item.quantity) },
          })
        }
        await tx.stockInItem.delete({ where: { id: itemId } })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: r.enterpriseId,
            action: 'stock_in_remove_item', entity: 'StockInItem', entityId: itemId,
            details: `Removed stock-in item: -${item.quantity} ${item.unit} of ${prod?.name || `Product #${item.productId}`} (recorder ${r.recorderCode}). Lot reversed, stock decremented.`,
          },
        })
      })
    },
    remove: async (ctx: AuthContext, id: number): Promise<void> => {
      const existing = await orm.stockInRecorder.findUnique({
        where: { id },
        include: { items: true },
      })
      if (!existing) throw new Error(`Stock-in recorder #${id} not found`)
      if (ctx.role !== 'super_admin' && existing.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      await orm.$transaction(async (tx) => {
        // Reverse lots & decrement stock for every item
        for (const item of existing.items) {
          await reverseLot(tx, ctx, `${existing.recorderCode}-${item.id}`, item.quantity)
          const s = await tx.stock.findUnique({
            where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
          })
          if (s) {
            await tx.stock.update({
              where: { id: s.id },
              data: { quantity: Math.max(0, s.quantity - item.quantity) },
            })
          }
          await tx.stockInItem.delete({ where: { id: item.id } })
        }
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: existing.enterpriseId,
            action: 'stock_in_delete_recorder', entity: 'StockInRecorder', entityId: id,
            details: `Deleted recorder ${existing.recorderCode} and reversed ${existing.items.length} item(s)`,
          },
        })
        await tx.stockInRecorder.delete({ where: { id } })
      })
    },
  },

  // ── Stock Out Recorders ─────────────────────────────────
  stockOut: {
    findMany: async (ctx: AuthContext, eid?: number, wid?: number): Promise<StockOutRecorder[]> => {
      const whIds = await getAccessibleWarehouseIds(ctx)
      if (whIds.length === 0) return []
      const where: any = { warehouseId: { in: whIds } }
      if (eid) where.enterpriseId = eid
      if (wid) where.warehouseId = wid
      const rows = await orm.stockOutRecorder.findMany({
        where,
        orderBy: { id: 'desc' },
        include: { items: { include: { condition: true } }, personUser: { select: { id: true, username: true, fullName: true, role: true } } },
      })
      return ser(rows) as StockOutRecorder[]
    },
    findById: async (ctx: AuthContext, id: number): Promise<StockOutRecorder | null> => {
      const r = await orm.stockOutRecorder.findUnique({
        where: { id },
        include: { items: { include: { condition: true } }, personUser: { select: { id: true, username: true, fullName: true, role: true } } },
      })
      if (!r) return null
      if (ctx.role !== 'super_admin' && r.enterpriseId !== ctx.enterpriseId) return null
      return ser(r) as StockOutRecorder
    },
    create: async (ctx: AuthContext, d: Partial<StockOutRecorder>): Promise<StockOutRecorder> => {
      if (ctx.role !== 'super_admin' && d.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const wh = await orm.warehouse.findUnique({ where: { id: d.warehouseId! } })
      if (!wh) throw new Error('Warehouse not found')
      if (!canAccessWarehouse(ctx, wh.enterpriseId, wh.branchId, wh.id)) throw new Error('FORBIDDEN')
      const created = await orm.$transaction(async (tx) => {
        const recorderCode = await generateRecorderCode(tx, 'SOUT', 'recorderCode')
        const r = await tx.stockOutRecorder.create({
          data: {
            enterpriseId: d.enterpriseId!,
            warehouseId: d.warehouseId!,
            recorderCode,
            personName: d.personName || '',
            personPhone: d.personPhone || '',
            personEmail: d.personEmail || '',
            personAddress: d.personAddress || '',
            personUserId: (d as any).personUserId ?? null,
            notes: d.notes || '',
            status: (d.status as 'pending' | 'partial_return' | 'returned') || 'pending',
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: r.enterpriseId,
            action: 'stock_out.create', entity: 'StockOutRecorder', entityId: r.id,
            details: `Created stock-out recorder ${r.recorderCode}`,
          },
        })
        return r
      })
      return ser(created) as StockOutRecorder
    },
    update: async (ctx: AuthContext, id: number, d: Partial<StockOutRecorder>): Promise<StockOutRecorder> => {
      const existing = await orm.stockOutRecorder.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (ctx.role !== 'super_admin' && existing.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const updated = await orm.$transaction(async (tx) => {
        const r = await tx.stockOutRecorder.update({
          where: { id },
          data: {
            ...(d.personName !== undefined ? { personName: d.personName } : {}),
            ...(d.personPhone !== undefined ? { personPhone: d.personPhone } : {}),
            ...(d.personEmail !== undefined ? { personEmail: d.personEmail } : {}),
            ...(d.personAddress !== undefined ? { personAddress: d.personAddress } : {}),
            ...((d as any).personUserId !== undefined ? { personUserId: (d as any).personUserId } : {}),
            ...(d.notes !== undefined ? { notes: d.notes } : {}),
            ...(d.status !== undefined ? { status: d.status } : {}),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: r.enterpriseId,
            action: 'stock_out.update', entity: 'StockOutRecorder', entityId: r.id,
            details: `Updated stock-out recorder ${r.recorderCode}`,
          },
        })
        return r
      })
      return ser(updated) as StockOutRecorder
    },
    /** Add item: deduct stock via FIFO lots */
    addItem: async (
      ctx: AuthContext,
      recorderId: number,
      d: Partial<StockOutItem>,
    ): Promise<StockOutItem> => {
      const r = await orm.stockOutRecorder.findUnique({ where: { id: recorderId } })
      if (!r) throw new Error(`Stock-out recorder #${recorderId} not found`)
      if (ctx.role !== 'super_admin' && r.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const qty = d.quantity ?? 0
      if (qty <= 0) throw new Error('Validation: quantity must be positive')
      if (!d.productId) throw new Error('Validation: productId is required')
      if (!d.warehouseId) throw new Error('Validation: warehouseId is required')
      const prod = await orm.product.findUnique({ where: { id: d.productId } })
      if (!prod) throw new Error(`Product #${d.productId} not found`)
      const wh = await orm.warehouse.findUnique({ where: { id: d.warehouseId } })
      if (!wh) throw new Error(`Warehouse #${d.warehouseId} not found`)
      if (!canAccessWarehouse(ctx, wh.enterpriseId, wh.branchId, wh.id)) throw new Error('FORBIDDEN')
      const result = await orm.$transaction(async (tx) => {
        // Check current stock
        const existing = await tx.stock.findUnique({
          where: { productId_warehouseId: { productId: d.productId!, warehouseId: d.warehouseId! } },
        })
        const currentQty = existing?.quantity ?? 0
        if (currentQty < qty) {
          throw new Error(`Insufficient stock: only ${currentQty} available for ${prod.name}, requested ${qty}`)
        }
        // FIFO deduct lots (throws if insufficient open lots)
        await deductLotsFIFO(tx, ctx, d.productId!, d.warehouseId!, qty)
        // Decrement stock
        const s = await tx.stock.update({
          where: { id: existing!.id },
          data: { quantity: { decrement: qty } },
        })
        // Create stock-out item
        const item = await tx.stockOutItem.create({
          data: {
            recorderId,
            productId: d.productId!,
            warehouseId: d.warehouseId!,
            quantity: qty,
            unit: d.unit || prod.unit,
            isReturnable: d.isReturnable ?? false,
            returnDeadline: d.returnDeadline ? new Date(d.returnDeadline as unknown as string) : null,
            notes: d.notes || '',
            conditionId: d.conditionId ?? null,
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: r.enterpriseId,
            action: 'stock_out_add_item', entity: 'StockOutItem', entityId: item.id,
            details: `Stock out ${qty} ${d.unit || prod.unit} of ${prod.name} from ${wh.name} (recorder ${r.recorderCode}). Stock was ${currentQty}, now ${s.quantity}.`,
          },
        })
        return item
      })
      return ser(result) as StockOutItem
    },
    /** Remove a stock-out item: restore stock + restore lot remainingQty */
    removeItem: async (ctx: AuthContext, recorderId: number, itemId: number): Promise<void> => {
      const r = await orm.stockOutRecorder.findUnique({ where: { id: recorderId } })
      if (!r) throw new Error(`Stock-out recorder #${recorderId} not found`)
      if (ctx.role !== 'super_admin' && r.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const item = await orm.stockOutItem.findUnique({ where: { id: itemId } })
      if (!item || item.recorderId !== recorderId) throw new Error(`Item #${itemId} not found in recorder #${recorderId}`)
      const prod = await orm.product.findUnique({ where: { id: item.productId } })
      await orm.$transaction(async (tx) => {
        // Restore lot remainingQty: increment the youngest open lot, or create a reversal Lot
        const openLots = await tx.lot.findMany({
          where: { productId: item.productId, warehouseId: item.warehouseId, remainingQty: { gt: 0 }, closedAt: null },
          orderBy: { receivedDate: 'desc' },
        })
        if (openLots.length > 0) {
          const lot = openLots[0]
          await tx.lot.update({
            where: { id: lot.id },
            data: {
              remainingQty: { increment: item.quantity },
              closedAt: null,  // reopen if was closed (it wasn't since we filtered)
            },
          })
        } else {
          // No open lot — create a reversal Lot with source='adjustment'
          await createLot(tx, ctx, {
            productId: item.productId,
            warehouseId: item.warehouseId,
            enterpriseId: r.enterpriseId,
            quantity: item.quantity,
            unit: item.unit,
            costPerUnit: prod?.cost ?? 0,
            source: 'adjustment',
            sourceRef: `REVERSE-OUT-${r.recorderCode}-${itemId}`,
            notes: `Reversal of stock-out item #${itemId} from recorder ${r.recorderCode}`,
          })
        }
        // Increment stock
        const s = await tx.stock.findUnique({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
        })
        if (s) {
          await tx.stock.update({ where: { id: s.id }, data: { quantity: { increment: item.quantity } } })
        } else {
          await tx.stock.create({
            data: { productId: item.productId, warehouseId: item.warehouseId, quantity: item.quantity },
          })
        }
        await tx.stockOutItem.delete({ where: { id: itemId } })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: r.enterpriseId,
            action: 'stock_out_remove_item', entity: 'StockOutItem', entityId: itemId,
            details: `Removed stock-out item: restored ${item.quantity} ${item.unit} of ${prod?.name || `Product #${item.productId}`} (recorder ${r.recorderCode}). Stock restored, lot adjusted.`,
          },
        })
      })
    },
    remove: async (ctx: AuthContext, id: number): Promise<void> => {
      const existing = await orm.stockOutRecorder.findUnique({
        where: { id },
        include: { items: true },
      })
      if (!existing) throw new Error(`Stock-out recorder #${id} not found`)
      if (ctx.role !== 'super_admin' && existing.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      await orm.$transaction(async (tx) => {
        for (const item of existing.items) {
          // Restore lot (find youngest open, else create reversal lot)
          const openLots = await tx.lot.findMany({
            where: { productId: item.productId, warehouseId: item.warehouseId, remainingQty: { gt: 0 }, closedAt: null },
            orderBy: { receivedDate: 'desc' },
          })
          if (openLots.length > 0) {
            await tx.lot.update({
              where: { id: openLots[0].id },
              data: { remainingQty: { increment: item.quantity }, closedAt: null },
            })
          } else {
            await createLot(tx, ctx, {
              productId: item.productId,
              warehouseId: item.warehouseId,
              enterpriseId: existing.enterpriseId,
              quantity: item.quantity,
              unit: item.unit,
              source: 'adjustment',
              sourceRef: `REVERSE-OUT-${existing.recorderCode}-${item.id}`,
              notes: `Reversal of stock-out on recorder deletion`,
            })
          }
          // Restore stock
          const s = await tx.stock.findUnique({
            where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
          })
          if (s) {
            await tx.stock.update({ where: { id: s.id }, data: { quantity: { increment: item.quantity } } })
          } else {
            await tx.stock.create({
              data: { productId: item.productId, warehouseId: item.warehouseId, quantity: item.quantity },
            })
          }
          await tx.stockOutItem.delete({ where: { id: item.id } })
        }
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: existing.enterpriseId,
            action: 'stock_out_delete_recorder', entity: 'StockOutRecorder', entityId: id,
            details: `Deleted recorder ${existing.recorderCode} and restored ${existing.items.length} item(s) to stock`,
          },
        })
        await tx.stockOutRecorder.delete({ where: { id } })
      })
    },
  },

  // ── Orders ──────────────────────────────────────────────
  orders: {
    findMany: async (ctx: AuthContext, eid?: number): Promise<Order[]> => {
      const where: any = {}
      if (eid) where.enterpriseId = eid
      if (ctx.role === 'super_admin') {
        // all
      } else if (ctx.role === 'enterprise_admin') {
        where.enterpriseId = ctx.enterpriseId!
      } else if (ctx.role === 'branch_admin') {
        const whIds = await getAccessibleWarehouseIds(ctx)
        where.enterpriseId = ctx.enterpriseId!
        where.warehouseId = { in: whIds }
      } else {
        // warehouse_admin
        where.warehouseId = ctx.warehouseId!
      }
      const rows = await orm.order.findMany({ where, orderBy: { id: 'desc' } })
      return ser(rows) as Order[]
    },
    findById: async (ctx: AuthContext, id: number): Promise<Order | null> => {
      const o = await orm.order.findUnique({ where: { id }, include: { items: true } })
      if (!o) return null
      if (ctx.role === 'super_admin') return ser(o) as Order
      if (o.enterpriseId !== ctx.enterpriseId) return null
      if (ctx.role === 'branch_admin') {
        const whIds = await getAccessibleWarehouseIds(ctx)
        if (!o.warehouseId || !whIds.includes(o.warehouseId)) return null
      }
      if (ctx.role === 'warehouse_admin' && o.warehouseId !== ctx.warehouseId) return null
      return ser(o) as Order
    },
    create: async (ctx: AuthContext, d: Partial<Order>): Promise<Order> => {
      if (ctx.role === 'warehouse_admin') throw new Error('FORBIDDEN: warehouse_admin cannot create orders')
      if (ctx.role !== 'super_admin' && d.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const created = await orm.$transaction(async (tx) => {
        const o = await tx.order.create({
          data: {
            enterpriseId: d.enterpriseId!,
            type: d.type as 'purchase' | 'sales',
            supplierId: d.supplierId ?? null,
            warehouseId: d.warehouseId ?? null,
            status: 'pending',
            totalAmount: d.totalAmount ?? 0,
            notes: d.notes || '',
            createdBy: ctx.userId,
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: o.enterpriseId,
            action: 'order.create', entity: 'Order', entityId: o.id,
            details: `Created ${o.type} order #${o.id}`,
          },
        })
        return o
      })
      return ser(created) as Order
    },
    update: async (ctx: AuthContext, id: number, d: Partial<Order>): Promise<Order> => {
      const existing = await orm.order.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (ctx.role !== 'super_admin' && existing.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const updated = await orm.$transaction(async (tx) => {
        const o = await tx.order.update({
          where: { id },
          data: {
            ...(d.type !== undefined ? { type: d.type } : {}),
            ...(d.supplierId !== undefined ? { supplierId: d.supplierId } : {}),
            ...(d.warehouseId !== undefined ? { warehouseId: d.warehouseId } : {}),
            ...(d.status !== undefined ? { status: d.status } : {}),
            ...(d.totalAmount !== undefined ? { totalAmount: d.totalAmount } : {}),
            ...(d.notes !== undefined ? { notes: d.notes } : {}),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: o.enterpriseId,
            action: 'order.update', entity: 'Order', entityId: o.id,
            details: `Updated order #${o.id} (status=${o.status})`,
          },
        })
        return o
      })
      return ser(updated) as Order
    },
    remove: async (ctx: AuthContext, id: number): Promise<void> => {
      const existing = await orm.order.findUnique({ where: { id } })
      if (!existing) throw new Error('Not found')
      if (ctx.role !== 'super_admin' && existing.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      await orm.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: existing.enterpriseId,
            action: 'order.delete', entity: 'Order', entityId: id,
            details: `Deleted order #${id}`,
          },
        })
        await tx.order.delete({ where: { id } })
      })
    },
  },

  // ── Audit ───────────────────────────────────────────────
  audit: {
    findMany: async (ctx: AuthContext, limit = 100): Promise<AuditLog[]> => {
      const where: any = {}
      if (ctx.role !== 'super_admin') {
        if (!ctx.enterpriseId) return []
        where.enterpriseId = ctx.enterpriseId
      }
      const rows = await orm.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { user: { select: { fullName: true } } },
      })
      return ser(rows.map(r => ({ ...r, userName: r.user?.fullName ?? null }))) as AuditLog[]
    },
    log: async (ctx: AuthContext, d: { action: string; entity: string; entityId?: number | null; details?: string; enterpriseId?: number | null }): Promise<AuditLog> => {
      const created = await orm.auditLog.create({
        data: {
          userId: ctx.userId,
          enterpriseId: d.enterpriseId ?? ctx.enterpriseId,
          action: d.action,
          entity: d.entity,
          entityId: d.entityId ?? null,
          details: d.details || '',
        },
      })
      return ser(created) as AuditLog
    },
  },

  // ── Features ────────────────────────────────────────────
  features: {
    findMany: async (ctx: AuthContext, eid?: number): Promise<Feature[]> => {
      const where: any = {}
      if (eid) where.enterpriseId = eid
      else if (ctx.role !== 'super_admin') {
        if (!ctx.enterpriseId) return []
        where.enterpriseId = ctx.enterpriseId
      }
      const rows = await orm.feature.findMany({ where, orderBy: { id: 'asc' } })
      return ser(rows) as Feature[]
    },
    update: async (ctx: AuthContext, enterpriseId: number, feature: string, enabled: boolean): Promise<Feature> => {
      if (ctx.role !== 'super_admin') throw new Error('FORBIDDEN: Only super_admin can toggle features')
      const result = await orm.$transaction(async (tx) => {
        const existing = await tx.feature.findUnique({
          where: { enterpriseId_feature: { enterpriseId, feature } },
        })
        let f: { id: number; enterpriseId: number; feature: string; enabled: boolean; createdAt: Date; updatedAt: Date }
        if (existing) {
          f = await tx.feature.update({ where: { id: existing.id }, data: { enabled } })
        } else {
          f = await tx.feature.create({ data: { enterpriseId, feature, enabled } })
        }
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId,
            action: 'feature.update', entity: 'Feature', entityId: f.id,
            details: `Set feature '${feature}' = ${enabled} for enterprise #${enterpriseId}`,
          },
        })
        return f
      })
      return ser(result) as Feature
    },
  },

  // ── Dashboard ───────────────────────────────────────────
  dashboard: {
    stats: async (ctx: AuthContext): Promise<DashboardStats> => {
      const eid = ctx.role === 'super_admin' ? undefined : ctx.enterpriseId ?? undefined
      const entWhere = eid ? { enterpriseId: eid } : {}
      const whIds = await getAccessibleWarehouseIds(ctx)

      const [enterprises, branches, warehouses, users, products, orders, stockRows, totalLots, openLots, stockInCount, stockOutCount] = await Promise.all([
        orm.enterprise.count(),
        orm.branch.count({ where: entWhere }),
        orm.warehouse.count({ where: entWhere }),
        orm.user.count({ where: ctx.role === 'super_admin' ? {} : { enterpriseId: ctx.enterpriseId ?? -1 } }),
        orm.product.count({ where: entWhere }),
        orm.order.findMany({ where: entWhere }),
        whIds.length ? orm.stock.findMany({ where: { warehouseId: { in: whIds } }, include: { product: true } }) : [],
        orm.lot.count({ where: entWhere }),
        orm.lot.count({ where: { ...entWhere, remainingQty: { gt: 0 }, closedAt: null } }),
        orm.stockInRecorder.count({ where: entWhere }),
        orm.stockOutRecorder.count({ where: entWhere }),
      ])

      const totalStockValue = stockRows.reduce((s, r) => s + r.quantity * (r.product?.price ?? 0), 0)
      const pendingOrderCount = orders.filter(o => o.status === 'pending').length

      const allProducts = eid ? await orm.product.findMany({ where: { enterpriseId: eid } }) : await orm.product.findMany()
      const stockByProduct = new Map<number, number>()
      for (const s of stockRows) {
        stockByProduct.set(s.productId, (stockByProduct.get(s.productId) ?? 0) + s.quantity)
      }
      const lowStockProducts = allProducts
        .filter(p => p.isActive && (stockByProduct.get(p.id) ?? 0) <= p.reorderLevel)
        .map(p => ({
          id: p.id, name: p.name, sku: p.sku, reorderLevel: p.reorderLevel,
          totalQty: stockByProduct.get(p.id) ?? 0,
        }))

      return {
        enterpriseCount: enterprises,
        branchCount: branches,
        warehouseCount: warehouses,
        userCount: users,
        productCount: products,
        orderCount: orders.length,
        pendingOrderCount,
        totalStockValue,
        lowStockProducts,
        totalLots,
        openLots,
        stockInCount,
        stockOutCount,
      }
    },
  },

  // ── Analytics (Task 1) ──────────────────────────────────
  analytics: {
    chartData: async (ctx: AuthContext): Promise<AnalyticsData> => {
      const whIds = await getAccessibleWarehouseIds(ctx)
      if (whIds.length === 0) {
        return { stockByWarehouse: [], stockByCategory: [], topProducts: [], recentActivity: [] }
      }
      const eid = ctx.role === 'super_admin' ? undefined : ctx.enterpriseId ?? undefined

      // Stock by warehouse
      const warehouses = await orm.warehouse.findMany({
        where: { id: { in: whIds } },
        include: { stock: true },
      })
      const stockByWarehouse = warehouses.map(w => ({
        name: w.name,
        value: w.stock.reduce((s, st) => s + st.quantity, 0),
      }))

      // Stock by category
      const products = eid ? await orm.product.findMany({ where: { enterpriseId: eid }, include: { stock: true, category: true } }) : await orm.product.findMany({ include: { stock: true, category: true } })
      const byCat = new Map<string, number>()
      for (const p of products) {
        // Only count stock rows in accessible warehouses
        const accessibleStock = p.stock.filter(s => whIds.includes(s.warehouseId))
        const total = accessibleStock.reduce((s, st) => s + st.quantity, 0)
        const catName = p.category?.name || 'Uncategorized'
        byCat.set(catName, (byCat.get(catName) ?? 0) + total)
      }
      const stockByCategory = Array.from(byCat.entries()).map(([name, value]) => ({ name, value }))

      // Top products by total stock quantity
      const topProducts = products
        .map(p => {
          const accessibleStock = p.stock.filter(s => whIds.includes(s.warehouseId))
          const quantity = accessibleStock.reduce((s, st) => s + st.quantity, 0)
          return { name: p.name, quantity, value: quantity * p.price }
        })
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)

      // Recent activity (last 10 audit logs with userName)
      const where: any = {}
      if (ctx.role !== 'super_admin') {
        if (!ctx.enterpriseId) return { stockByWarehouse, stockByCategory, topProducts, recentActivity: [] }
        where.enterpriseId = ctx.enterpriseId
      }
      const logs = await orm.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { fullName: true } } },
      })
      const recentActivity = logs.map(l => ({
        id: l.id, action: l.action, entity: l.entity, entityId: l.entityId,
        details: l.details, createdAt: l.createdAt.toISOString(),
        userName: l.user?.fullName ?? null,
      }))

      return { stockByWarehouse, stockByCategory, topProducts, recentActivity }
    },
  },

  // ── Returns (process returns against StockOutItems) ────
  returns: {
    /**
     * List stock-out items eligible for return, split by tab.
     *  - tab='flagged'     → isReturnable=true  AND remaining > 0
     *  - tab='not_flagged' → isReturnable=false AND remaining > 0
     * Each item carries: product, recorder, returnedQty, remainingQty, returns[].
     * Items with remaining=0 are excluded (fully returned).
     */
    findReturnable: async (
      ctx: AuthContext,
      opts: { tab: 'flagged' | 'not_flagged'; warehouseId?: number },
    ): Promise<ReturnableItem[]> => {
      const whIds = await getAccessibleWarehouseIds(ctx)
      if (whIds.length === 0) return []
      const where: any = {
        warehouseId: { in: whIds },
        isReturnable: opts.tab === 'flagged',
      }
      if (opts.warehouseId) where.warehouseId = opts.warehouseId
      const rows = await orm.stockOutItem.findMany({
        where,
        include: {
          product: true,
          recorder: true,
          condition: true,
          returns: { orderBy: { id: 'desc' } },
          nonReturnables: { orderBy: { id: 'desc' } },
        },
        orderBy: { id: 'desc' },
      })
      // Compute returnedQty & nonReturnableQty; remaining = qty - returned - nonReturnable.
      // Drop items fully resolved (remaining <= 0).
      const out: ReturnableItem[] = []
      for (const it of rows) {
        const returnedQty = it.returns.reduce((s, r) => s + r.quantity, 0)
        const nonReturnableQty = (it.nonReturnables || []).reduce((s, n) => s + n.quantity, 0)
        const remainingQty = it.quantity - returnedQty - nonReturnableQty
        if (remainingQty <= 0) continue
        out.push({
          id: it.id,
          recorderId: it.recorderId,
          productId: it.productId,
          warehouseId: it.warehouseId,
          quantity: it.quantity,
          unit: it.unit,
          isReturnable: it.isReturnable,
          returnDeadline: it.returnDeadline ? it.returnDeadline.toISOString() : null,
          notes: it.notes,
          conditionId: it.conditionId ?? null,
          condition: it.condition ? { id: it.condition.id, name: it.condition.name, description: it.condition.description } : null,
          createdAt: it.createdAt.toISOString(),
          updatedAt: it.updatedAt.toISOString(),
          returnedQty,
          nonReturnableQty,
          remainingQty,
          product: {
            id: it.product.id, enterpriseId: it.product.enterpriseId, name: it.product.name,
            sku: it.product.sku, description: it.product.description, categoryId: it.product.categoryId,
            price: it.product.price, cost: it.product.cost, unit: it.product.unit,
            reorderLevel: it.product.reorderLevel, isActive: it.product.isActive,
            createdAt: it.product.createdAt.toISOString(), updatedAt: it.product.updatedAt.toISOString(),
          } as Product,
          recorder: {
            id: it.recorder.id, enterpriseId: it.recorder.enterpriseId, warehouseId: it.recorder.warehouseId,
            recorderCode: it.recorder.recorderCode, personName: it.recorder.personName,
            personPhone: it.recorder.personPhone, personEmail: it.recorder.personEmail,
            personAddress: it.recorder.personAddress, notes: it.recorder.notes, status: it.recorder.status,
            createdAt: it.recorder.createdAt.toISOString(), updatedAt: it.recorder.updatedAt.toISOString(),
          } as StockOutRecorder,
          returns: it.returns.map(r => ({
            id: r.id, stockOutItemId: r.stockOutItemId, returnRecorderId: r.returnRecorderId,
            quantity: r.quantity, unit: r.unit, notes: r.notes,
            returnedAt: r.returnedAt.toISOString(), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
          })) as ReturnRecord[],
          nonReturnables: (it.nonReturnables || []).map(n => ({
            id: n.id, stockOutItemId: n.stockOutItemId, nonReturnableRecorderId: n.nonReturnableRecorderId,
            quantity: n.quantity, unit: n.unit, reason: n.reason, reasonDetail: n.reasonDetail, notes: n.notes,
            decidedAt: n.decidedAt.toISOString(), createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString(),
          })) as NonReturnable[],
        })
      }
      return out
    },

    /** Find one stock-out item by id, with product + recorder + returns[] (for source-record dialog). */
    findItemById: async (ctx: AuthContext, stockOutItemId: number): Promise<ReturnableItem | null> => {
      const it = await orm.stockOutItem.findUnique({
        where: { id: stockOutItemId },
        include: {
          product: true,
          recorder: { include: { items: { include: { product: true, condition: true } } } },
          condition: true,
          returns: { orderBy: { id: 'desc' } },
          nonReturnables: { orderBy: { id: 'desc' } },
        },
      })
      if (!it) return null
      if (ctx.role !== 'super_admin' && it.recorder.enterpriseId !== ctx.enterpriseId) return null
      const returnedQty = it.returns.reduce((s, r) => s + r.quantity, 0)
      const nonReturnableQty = (it.nonReturnables || []).reduce((s, n) => s + n.quantity, 0)
      return {
        id: it.id, recorderId: it.recorderId, productId: it.productId, warehouseId: it.warehouseId,
        quantity: it.quantity, unit: it.unit, isReturnable: it.isReturnable,
        returnDeadline: it.returnDeadline ? it.returnDeadline.toISOString() : null,
        notes: it.notes,
        conditionId: it.conditionId ?? null,
        condition: it.condition ? { id: it.condition.id, name: it.condition.name, description: it.condition.description } : null,
        createdAt: it.createdAt.toISOString(), updatedAt: it.updatedAt.toISOString(),
        returnedQty, nonReturnableQty, remainingQty: it.quantity - returnedQty - nonReturnableQty,
        product: {
          id: it.product.id, enterpriseId: it.product.enterpriseId, name: it.product.name,
          sku: it.product.sku, description: it.product.description, categoryId: it.product.categoryId,
          price: it.product.price, cost: it.product.cost, unit: it.product.unit,
          reorderLevel: it.product.reorderLevel, isActive: it.product.isActive,
          createdAt: it.product.createdAt.toISOString(), updatedAt: it.product.updatedAt.toISOString(),
        } as Product,
        recorder: {
          id: it.recorder.id, enterpriseId: it.recorder.enterpriseId, warehouseId: it.recorder.warehouseId,
          recorderCode: it.recorder.recorderCode, personName: it.recorder.personName,
          personPhone: it.recorder.personPhone, personEmail: it.recorder.personEmail,
          personAddress: it.recorder.personAddress, notes: it.recorder.notes, status: it.recorder.status,
          createdAt: it.recorder.createdAt.toISOString(), updatedAt: it.recorder.updatedAt.toISOString(),
          items: (it.recorder as any).items ? (it.recorder as any).items.map((si: any) => ({
            id: si.id, recorderId: si.recorderId, productId: si.productId, warehouseId: si.warehouseId,
            quantity: si.quantity, unit: si.unit, isReturnable: si.isReturnable,
            returnDeadline: si.returnDeadline ? si.returnDeadline.toISOString() : null, notes: si.notes,
            conditionId: si.conditionId ?? null,
            condition: si.condition ? { id: si.condition.id, name: si.condition.name, description: si.condition.description } : null,
            createdAt: si.createdAt.toISOString(), updatedAt: si.updatedAt.toISOString(),
            product: si.product ? { id: si.product.id, name: si.product.name, sku: si.product.sku, unit: si.product.unit } as any : undefined,
          })) : [],
        } as StockOutRecorder,
        returns: it.returns.map(r => ({
          id: r.id, stockOutItemId: r.stockOutItemId, returnRecorderId: r.returnRecorderId,
          quantity: r.quantity, unit: r.unit, notes: r.notes,
          returnedAt: r.returnedAt.toISOString(), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
        })) as ReturnRecord[],
        nonReturnables: (it.nonReturnables || []).map(n => ({
          id: n.id, stockOutItemId: n.stockOutItemId, nonReturnableRecorderId: n.nonReturnableRecorderId,
          quantity: n.quantity, unit: n.unit, reason: n.reason, reasonDetail: n.reasonDetail, notes: n.notes,
          decidedAt: n.decidedAt.toISOString(), createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString(),
        })) as NonReturnable[],
      }
    },

    /**
     * Process a single return: create a Return record, increment stock (via Lot source='adjustment'),
     * and update the StockOutRecorder status ('partial_return' if any item still has remaining > 0,
     * 'returned' if ALL items are now fully returned).
     */
    processReturn: async (
      ctx: AuthContext,
      d: { stockOutItemId: number; quantity: number; notes?: string; returnRecorderId?: number },
    ): Promise<ReturnRecord> => {
      if (!d.stockOutItemId) throw new Error('Validation: stockOutItemId is required')
      if (!d.quantity || d.quantity <= 0) throw new Error('Validation: quantity must be positive')
      const it = await orm.stockOutItem.findUnique({
        where: { id: d.stockOutItemId },
        include: { recorder: true, product: true, returns: true, nonReturnables: true },
      })
      if (!it) throw new Error('StockOutItem not found')
      if (ctx.role !== 'super_admin' && it.recorder.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const returnedQty = it.returns.reduce((s, r) => s + r.quantity, 0)
      const nonReturnableQty = (it.nonReturnables || []).reduce((s, n) => s + n.quantity, 0)
      const remaining = it.quantity - returnedQty - nonReturnableQty
      if (remaining <= 0) throw new Error('Validation: this item is fully resolved (returned + non-returnable)')
      if (d.quantity > remaining) throw new Error(`Validation: only ${remaining} remaining to return`)

      const result = await orm.$transaction(async (tx) => {
        // Create the Return record (optionally linked to a ReturnRecorder for group returns)
        const ret = await tx.return.create({
          data: {
            stockOutItemId: d.stockOutItemId,
            returnRecorderId: d.returnRecorderId ?? null,
            quantity: d.quantity,
            unit: it.unit,
            notes: d.notes || '',
          },
        })
        // Increment stock (this is a stock-in via return path)
        const existing = await tx.stock.findUnique({
          where: { productId_warehouseId: { productId: it.productId, warehouseId: it.warehouseId } },
        })
        if (existing) {
          await tx.stock.update({ where: { id: existing.id }, data: { quantity: { increment: d.quantity } } })
        } else {
          await tx.stock.create({ data: { productId: it.productId, warehouseId: it.warehouseId, quantity: d.quantity } })
        }
        // Create a Lot with source='adjustment' to record the return as a stock-in batch
        await createLot(tx, ctx, {
          productId: it.productId,
          warehouseId: it.warehouseId,
          enterpriseId: it.recorder.enterpriseId,
          quantity: d.quantity,
          unit: it.unit,
          costPerUnit: it.product.cost,
          supplierName: it.recorder.personName || null,
          source: 'adjustment',
          sourceRef: `RETURN-${it.recorder.recorderCode}-${it.id}-${ret.id}`,
          notes: `Return of stock-out item #${it.id} from recorder ${it.recorder.recorderCode}${d.notes ? ` — ${d.notes}` : ''}`,
          conditionId: it.conditionId ?? null,
        })
        // Update StockOutRecorder status: 'returned' if all items fully returned, else 'partial_return'
        // Use select (not include) to avoid materializing full Return relation objects
        const allItems = await tx.stockOutItem.findMany({
          where: { recorderId: it.recorderId },
          select: { id: true, quantity: true, returns: { select: { quantity: true } } },
        })
        const allReturned = allItems.every(i => {
          const rq = i.returns.reduce((s, r) => s + r.quantity, 0)
          return rq >= i.quantity
        })
        const anyReturned = allItems.some(i => {
          const rq = i.returns.reduce((s, r) => s + r.quantity, 0)
          return rq > 0
        })
        const newStatus = allReturned ? 'returned' : (anyReturned ? 'partial_return' : 'pending')
        await tx.stockOutRecorder.update({
          where: { id: it.recorderId },
          data: { status: newStatus },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: it.recorder.enterpriseId,
            action: 'return.process', entity: 'Return', entityId: ret.id,
            details: `Returned ${d.quantity} ${it.unit} of ${it.product.name} (stock-out item #${it.id}, recorder ${it.recorder.recorderCode}). Stock increased, lot created. Recorder status: ${newStatus}.`,
          },
        })
        return ret
      })
      return {
        id: result.id, stockOutItemId: result.stockOutItemId, returnRecorderId: result.returnRecorderId,
        quantity: result.quantity, unit: result.unit, notes: result.notes,
        returnedAt: result.returnedAt.toISOString(), createdAt: result.createdAt.toISOString(), updatedAt: result.updatedAt.toISOString(),
      } as ReturnRecord
    },

    /**
     * Process a group return: creates a NEW ReturnRecorder record (with person info — mirrors
     * the StockInRecorder flow), then processes each stock-out item return linked to it.
     * Stops on first error (e.g. insufficient remaining). The ReturnRecorder persists even if
     * some items fail, so the user has a first-class record of the group return attempt.
     */
    processGroupReturn: async (
      ctx: AuthContext,
      opts: {
        personName: string
        personPhone?: string
        personEmail?: string
        personAddress?: string
        notes?: string
        items: { stockOutItemId: number; quantity: number; notes?: string }[]
      },
    ): Promise<{ recorder: ReturnRecorder; processed: number; lastError: string | null }> => {
      if (!Array.isArray(opts.items) || opts.items.length === 0) throw new Error('Validation: no items to return')
      // Derive enterpriseId from the first item's recorder (works for super_admin too)
      const firstItem = await orm.stockOutItem.findUnique({
        where: { id: opts.items[0].stockOutItemId },
        include: { recorder: true },
      })
      if (!firstItem) throw new Error('StockOutItem not found')
      const enterpriseId = firstItem.recorder.enterpriseId
      // 1. Create the ReturnRecorder record (RET-YYYY-NNNN)
      const recorder = await orm.$transaction(async (tx) => {
        const year = new Date().getFullYear()
        const fullPrefix = `RET-${year}-`
        const count = await tx.returnRecorder.count({ where: { recorderCode: { startsWith: fullPrefix } } })
        const recorderCode = `${fullPrefix}${String(count + 1).padStart(4, '0')}`
        return tx.returnRecorder.create({
          data: {
            enterpriseId,
            recorderCode,
            personUserId: (opts as any).personUserId ?? null,
            personName: opts.personName || '',
            personPhone: opts.personPhone || '',
            personEmail: opts.personEmail || '',
            personAddress: opts.personAddress || '',
            notes: opts.notes || '',
            status: 'completed',
            itemCount: 0,
            totalQty: 0,
          },
        })
      })
      // 2. Process each return, linking to the new ReturnRecorder
      const processed: ReturnRecord[] = []
      let lastError: string | null = null
      for (const it of opts.items) {
        try {
          const r = await db.returns.processReturn(ctx, { ...it, returnRecorderId: recorder.id })
          processed.push(r)
        } catch (e: any) {
          lastError = e.message || String(e)
          break
        }
      }
      // 3. Update the recorder with final counts + status
      const updated = await orm.returnRecorder.update({
        where: { id: recorder.id },
        data: {
          itemCount: processed.length,
          totalQty: processed.reduce((s, r) => s + r.quantity, 0),
          status: processed.length === opts.items.length ? 'completed' : (processed.length > 0 ? 'partial' : 'failed'),
        },
      })
      await orm.auditLog.create({
        data: {
          userId: ctx.userId, enterpriseId,
          action: 'return.group', entity: 'ReturnRecorder', entityId: recorder.id,
          details: `Created group return ${recorder.recorderCode} for ${opts.personName || '(no person)'}: ${processed.length}/${opts.items.length} item(s) processed, total qty ${processed.reduce((s, r) => s + r.quantity, 0)}${lastError ? `. Stopped: ${lastError}` : ''}`,
        },
      })
      return {
        recorder: {
          id: updated.id, enterpriseId: updated.enterpriseId, recorderCode: updated.recorderCode,
          personName: updated.personName, personPhone: updated.personPhone, personEmail: updated.personEmail,
          personAddress: updated.personAddress, notes: updated.notes, status: updated.status,
          itemCount: updated.itemCount, totalQty: updated.totalQty,
          createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString(),
        } as ReturnRecorder,
        processed: processed.length,
        lastError,
      }
    },

    /** List all ReturnRecorder records for the user's accessible enterprise (newest first). */
    findRecorders: async (ctx: AuthContext): Promise<ReturnRecorder[]> => {
      const where: any = {}
      if (ctx.role !== 'super_admin' && ctx.enterpriseId) where.enterpriseId = ctx.enterpriseId
      const rows = await orm.returnRecorder.findMany({
        where,
        include: { returns: { include: { stockOutItem: { include: { product: true, condition: true } } } }, personUser: { select: { id: true, username: true, fullName: true, role: true } } },
        orderBy: { id: 'desc' },
      })
      return rows.map(r => ({
        id: r.id, enterpriseId: r.enterpriseId, recorderCode: r.recorderCode,
        personName: r.personName, personPhone: r.personPhone, personEmail: r.personEmail,
        personAddress: r.personAddress, personUserId: (r as any).personUserId ?? null, personUser: (r as any).personUser ?? null,
        notes: r.notes, status: r.status,
        itemCount: r.itemCount, totalQty: r.totalQty,
        createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
        returns: r.returns.map(rt => ({
          id: rt.id, stockOutItemId: rt.stockOutItemId, returnRecorderId: rt.returnRecorderId,
          quantity: rt.quantity, unit: rt.unit, notes: rt.notes,
          returnedAt: rt.returnedAt.toISOString(), createdAt: rt.createdAt.toISOString(), updatedAt: rt.updatedAt.toISOString(),
          stockOutItem: rt.stockOutItem ? {
            id: rt.stockOutItem.id, recorderId: rt.stockOutItem.recorderId, productId: rt.stockOutItem.productId,
            warehouseId: rt.stockOutItem.warehouseId, quantity: rt.stockOutItem.quantity, unit: rt.stockOutItem.unit,
            isReturnable: rt.stockOutItem.isReturnable,
            returnDeadline: rt.stockOutItem.returnDeadline ? rt.stockOutItem.returnDeadline.toISOString() : null,
            notes: rt.stockOutItem.notes,
            conditionId: rt.stockOutItem.conditionId ?? null,
            condition: (rt.stockOutItem as any).condition ? { id: (rt.stockOutItem as any).condition.id, name: (rt.stockOutItem as any).condition.name, description: (rt.stockOutItem as any).condition.description } : null,
            createdAt: rt.stockOutItem.createdAt.toISOString(), updatedAt: rt.stockOutItem.updatedAt.toISOString(),
            product: rt.stockOutItem.product ? {
              id: rt.stockOutItem.product.id, name: rt.stockOutItem.product.name, sku: rt.stockOutItem.product.sku, unit: rt.stockOutItem.product.unit,
            } as any : undefined,
          } as any : undefined,
        })),
      })) as ReturnRecorder[]
    },
  },

  // ── Non-Returnables (mark "should-be-returned" items as non-returnable, with a reason).
  //    Mirrors the Returns domain exactly so the UX is parallel. The Non-Returnable decision
  //    does NOT restock inventory — it just records that N units of a flagged stock-out item
  //    cannot be returned, with a reason chosen from NON_RETURNABLE_REASONS.
  //    The data source for the "items to mark" list is db.returns.findReturnable(tab='flagged')
  //    — that function already returns nonReturnableQty + remainingQty for each flagged item.
  nonReturnables: {
    /**
     * Process a single "mark as non-returnable" decision:
     *  - validates that the stock-out item exists, is in the user's enterprise, and has enough remaining
     *  - creates a NonReturnable record (no stock change)
     *  - optionally links to a NonReturnableRecorder for group decisions
     */
    processNonReturnable: async (
      ctx: AuthContext,
      d: {
        stockOutItemId: number
        quantity: number
        reason: string
        reasonDetail?: string
        notes?: string
        nonReturnableRecorderId?: number
      },
    ): Promise<NonReturnable> => {
      if (!d.stockOutItemId) throw new Error('Validation: stockOutItemId is required')
      if (!d.quantity || d.quantity <= 0) throw new Error('Validation: quantity must be positive')
      if (!d.reason) throw new Error('Validation: reason is required')
      const it = await orm.stockOutItem.findUnique({
        where: { id: d.stockOutItemId },
        include: { recorder: true, product: true, returns: true, nonReturnables: true },
      })
      if (!it) throw new Error('StockOutItem not found')
      if (ctx.role !== 'super_admin' && it.recorder.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
      const returnedQty = it.returns.reduce((s, r) => s + r.quantity, 0)
      const nonReturnableQty = (it.nonReturnables || []).reduce((s, n) => s + n.quantity, 0)
      const remaining = it.quantity - returnedQty - nonReturnableQty
      if (remaining <= 0) throw new Error('Validation: this item is fully resolved (returned + non-returnable)')
      if (d.quantity > remaining) throw new Error(`Validation: only ${remaining} remaining to mark non-returnable`)

      const result = await orm.$transaction(async (tx) => {
        const nr = await tx.nonReturnable.create({
          data: {
            stockOutItemId: d.stockOutItemId,
            nonReturnableRecorderId: d.nonReturnableRecorderId ?? null,
            quantity: d.quantity,
            unit: it.unit,
            reason: d.reason,
            reasonDetail: d.reasonDetail || '',
            notes: d.notes || '',
          },
        })
        await tx.auditLog.create({
          data: {
            userId: ctx.userId, enterpriseId: it.recorder.enterpriseId,
            action: 'non_returnable.process', entity: 'NonReturnable', entityId: nr.id,
            details: `Marked ${d.quantity} ${it.unit} of ${it.product.name} (stock-out item #${it.id}, recorder ${it.recorder.recorderCode}) as non-returnable. Reason: ${d.reason}${d.reasonDetail ? ` — ${d.reasonDetail}` : ''}.${d.notes ? ` Notes: ${d.notes}.` : ''}`,
          },
        })
        return nr
      })
      return {
        id: result.id, stockOutItemId: result.stockOutItemId, nonReturnableRecorderId: result.nonReturnableRecorderId,
        quantity: result.quantity, unit: result.unit, reason: result.reason, reasonDetail: result.reasonDetail, notes: result.notes,
        decidedAt: result.decidedAt.toISOString(), createdAt: result.createdAt.toISOString(), updatedAt: result.updatedAt.toISOString(),
      } as NonReturnable
    },

    /**
     * Process a group "mark as non-returnable" decision: creates a NEW NonReturnableRecorder
     * record (NR-YYYY-NNNN) — mirrors processGroupReturn — then processes each stock-out item
     * linked to it. Stops on first error. The recorder persists even if some items fail.
     */
    processGroupNonReturnable: async (
      ctx: AuthContext,
      opts: {
        personName: string
        personPhone?: string
        personEmail?: string
        personAddress?: string
        notes?: string
        items: { stockOutItemId: number; quantity: number; reason: string; reasonDetail?: string; notes?: string }[]
      },
    ): Promise<{ recorder: NonReturnableRecorder; processed: number; lastError: string | null }> => {
      if (!Array.isArray(opts.items) || opts.items.length === 0) throw new Error('Validation: no items to mark')
      const firstItem = await orm.stockOutItem.findUnique({
        where: { id: opts.items[0].stockOutItemId },
        include: { recorder: true },
      })
      if (!firstItem) throw new Error('StockOutItem not found')
      const enterpriseId = firstItem.recorder.enterpriseId
      // 1. Create the NonReturnableRecorder record (NR-YYYY-NNNN)
      const recorder = await orm.$transaction(async (tx) => {
        const year = new Date().getFullYear()
        const fullPrefix = `NR-${year}-`
        const count = await tx.nonReturnableRecorder.count({ where: { recorderCode: { startsWith: fullPrefix } } })
        const recorderCode = `${fullPrefix}${String(count + 1).padStart(4, '0')}`
        return tx.nonReturnableRecorder.create({
          data: {
            enterpriseId,
            recorderCode,
            personUserId: (opts as any).personUserId ?? null,
            personName: opts.personName || '',
            personPhone: opts.personPhone || '',
            personEmail: opts.personEmail || '',
            personAddress: opts.personAddress || '',
            notes: opts.notes || '',
            status: 'completed',
            itemCount: 0,
            totalQty: 0,
          },
        })
      })
      // 2. Process each decision, linking to the new recorder
      const processed: NonReturnable[] = []
      let lastError: string | null = null
      for (const it of opts.items) {
        try {
          const r = await db.nonReturnables.processNonReturnable(ctx, { ...it, nonReturnableRecorderId: recorder.id })
          processed.push(r)
        } catch (e: any) {
          lastError = e.message || String(e)
          break
        }
      }
      // 3. Update the recorder with final counts + status
      const updated = await orm.nonReturnableRecorder.update({
        where: { id: recorder.id },
        data: {
          itemCount: processed.length,
          totalQty: processed.reduce((s, r) => s + r.quantity, 0),
          status: processed.length === opts.items.length ? 'completed' : (processed.length > 0 ? 'partial' : 'failed'),
        },
      })
      await orm.auditLog.create({
        data: {
          userId: ctx.userId, enterpriseId,
          action: 'non_returnable.group', entity: 'NonReturnableRecorder', entityId: recorder.id,
          details: `Created group non-returnable decision ${recorder.recorderCode} for ${opts.personName || '(no person)'}: ${processed.length}/${opts.items.length} item(s) processed, total qty ${processed.reduce((s, r) => s + r.quantity, 0)}${lastError ? `. Stopped: ${lastError}` : ''}`,
        },
      })
      return {
        recorder: {
          id: updated.id, enterpriseId: updated.enterpriseId, recorderCode: updated.recorderCode,
          personName: updated.personName, personPhone: updated.personPhone, personEmail: updated.personEmail,
          personAddress: updated.personAddress, notes: updated.notes, status: updated.status,
          itemCount: updated.itemCount, totalQty: updated.totalQty,
          createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString(),
        } as NonReturnableRecorder,
        processed: processed.length,
        lastError,
      }
    },

    /** List all NonReturnableRecorder records for the user's accessible enterprise (newest first). */
    findRecorders: async (ctx: AuthContext): Promise<NonReturnableRecorder[]> => {
      const where: any = {}
      if (ctx.role !== 'super_admin' && ctx.enterpriseId) where.enterpriseId = ctx.enterpriseId
      const rows = await orm.nonReturnableRecorder.findMany({
        where,
        include: { nonReturnables: { include: { stockOutItem: { include: { product: true, condition: true } } } }, personUser: { select: { id: true, username: true, fullName: true, role: true } } },
        orderBy: { id: 'desc' },
      })
      return rows.map(r => ({
        id: r.id, enterpriseId: r.enterpriseId, recorderCode: r.recorderCode,
        personName: r.personName, personPhone: r.personPhone, personEmail: r.personEmail,
        personAddress: r.personAddress, personUserId: (r as any).personUserId ?? null, personUser: (r as any).personUser ?? null,
        notes: r.notes, status: r.status,
        itemCount: r.itemCount, totalQty: r.totalQty,
        createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
        nonReturnables: r.nonReturnables.map(nr => ({
          id: nr.id, stockOutItemId: nr.stockOutItemId, nonReturnableRecorderId: nr.nonReturnableRecorderId,
          quantity: nr.quantity, unit: nr.unit, reason: nr.reason, reasonDetail: nr.reasonDetail, notes: nr.notes,
          decidedAt: nr.decidedAt.toISOString(), createdAt: nr.createdAt.toISOString(), updatedAt: nr.updatedAt.toISOString(),
          stockOutItem: nr.stockOutItem ? {
            id: nr.stockOutItem.id, productId: nr.stockOutItem.productId, warehouseId: nr.stockOutItem.warehouseId,
            quantity: nr.stockOutItem.quantity, unit: nr.stockOutItem.unit,
            conditionId: nr.stockOutItem.conditionId ?? null,
            condition: (nr.stockOutItem as any).condition ? { id: (nr.stockOutItem as any).condition.id, name: (nr.stockOutItem as any).condition.name, description: (nr.stockOutItem as any).condition.description } : null,
            product: nr.stockOutItem.product ? {
              id: nr.stockOutItem.product.id, name: nr.stockOutItem.product.name, sku: nr.stockOutItem.product.sku, unit: nr.stockOutItem.product.unit,
            } as any : undefined,
          } as any : undefined,
        })),
      })) as NonReturnableRecorder[]
    },
  },
}

// ─── Register Item (single) ────────────────────────────────

/** Register a single product + initial stock + Lot (source='register_item') in one tx */
export async function registerItem(
  ctx: AuthContext,
  params: {
    enterpriseId: number
    name: string
    sku: string
    description?: string
    categoryId?: number | null
    price?: number
    cost?: number
    unit?: string
    reorderLevel?: number
    isActive?: boolean
    warehouseId: number
    initialStock?: number
    costPerUnit?: number
    supplierName?: string | null
    notes?: string | null
    conditionId?: number | null
  },
): Promise<{ product: Product; stock: Stock | null }> {
  if (ctx.role === 'warehouse_admin') throw new Error('FORBIDDEN')
  if (ctx.role !== 'super_admin' && params.enterpriseId !== ctx.enterpriseId) throw new Error('FORBIDDEN')
  const wh = await orm.warehouse.findUnique({ where: { id: params.warehouseId } })
  if (!wh) throw new Error(`Warehouse #${params.warehouseId} not found`)
  if (!canAccessWarehouse(ctx, wh.enterpriseId, wh.branchId, wh.id)) throw new Error('FORBIDDEN')
  const initialStock = params.initialStock ?? 0

  const result = await orm.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        enterpriseId: params.enterpriseId,
        name: params.name,
        sku: params.sku,
        description: params.description || '',
        categoryId: params.categoryId ?? null,
        price: params.price ?? 0,
        cost: params.cost ?? 0,
        unit: params.unit || 'piece',
        reorderLevel: params.reorderLevel ?? 10,
        isActive: params.isActive ?? true,
      },
    })
    let s: { id: number; productId: number; warehouseId: number; quantity: number; createdAt: Date; updatedAt: Date } | null = null
    if (initialStock > 0) {
      s = await tx.stock.create({
        data: { productId: p.id, warehouseId: params.warehouseId, quantity: initialStock },
      })
      await createLot(tx, ctx, {
        productId: p.id,
        warehouseId: params.warehouseId,
        enterpriseId: params.enterpriseId,
        quantity: initialStock,
        unit: params.unit || p.unit,
        costPerUnit: params.costPerUnit ?? p.cost,
        supplierName: params.supplierName ?? null,
        source: 'register_item',
        sourceRef: `REGISTER-${p.id}`,
        notes: params.notes ?? null,
        conditionId: params.conditionId ?? null,
      })
    }
    await tx.auditLog.create({
      data: {
        userId: ctx.userId, enterpriseId: params.enterpriseId,
        action: 'register_item', entity: 'Product', entityId: p.id,
        details: `Registered product ${p.name} (${p.sku}) with initial stock ${initialStock} in warehouse #${params.warehouseId}`,
      },
    })
    return { product: p, stock: s }
  })
  return { product: ser(result.product) as Product, stock: result.stock ? ser(result.stock) as Stock : null }
}

// ─── Register Items (bulk — Change 3) ──────────────────────

interface RegisterItemInput {
  name: string
  sku: string
  description?: string
  categoryId?: number | null
  price?: number
  cost?: number
  unit?: string
  reorderLevel?: number
  isActive?: boolean
  quantity: number  // initial stock for this product in the warehouse
  costPerUnit?: number
  supplierName?: string | null
  notes?: string | null
  conditionId?: number | null
}

/**
 * Optional top-level supplier/person info for a bulk registration batch.
 * Mirrors the StockInRecorder / StockOutRecorder "person" header — the whole
 * batch is attributed to ONE supplier/person name. `personName` is applied to
 * every Lot's `supplierName` (overriding per-item supplierName when the item
 * does not specify its own). Contact details are folded into the Lot notes.
 */
interface RegisterSupplierInfo {
  personName?: string | null
  personPhone?: string | null
  personEmail?: string | null
  personAddress?: string | null
  notes?: string | null
}

/** Bulk-register products + initial stock + Lots in ONE transaction (Change 3) */
export async function registerItems(
  ctx: AuthContext,
  warehouseId: number,
  items: RegisterItemInput[],
  supplierInfo?: RegisterSupplierInfo,
): Promise<{ products: Product[]; lotsCreated: number }> {
  if (ctx.role === 'warehouse_admin') throw new Error('FORBIDDEN')
  if (items.length === 0) throw new Error('Validation: no items to register')
  const wh = await orm.warehouse.findUnique({ where: { id: warehouseId } })
  if (!wh) throw new Error(`Warehouse #${warehouseId} not found`)
  if (!canAccessWarehouse(ctx, wh.enterpriseId, wh.branchId, wh.id)) throw new Error('FORBIDDEN')
  const enterpriseId = wh.enterpriseId

  // Build a single contact-notes string from the top-level supplier info so
  // every Lot in this batch carries the supplier's contact details.
  const contactBits: string[] = []
  if (supplierInfo?.personPhone) contactBits.push(`Phone: ${supplierInfo.personPhone}`)
  if (supplierInfo?.personEmail) contactBits.push(`Email: ${supplierInfo.personEmail}`)
  if (supplierInfo?.personAddress) contactBits.push(`Address: ${supplierInfo.personAddress}`)
  const contactNotes = contactBits.join(' · ')

  const result = await orm.$transaction(async (tx) => {
    const created: Product[] = []
    let lotsCreated = 0
    for (const item of items) {
      const p = await tx.product.create({
        data: {
          enterpriseId,
          name: item.name,
          sku: item.sku,
          description: item.description || '',
          categoryId: item.categoryId ?? null,
          price: item.price ?? 0,
          cost: item.cost ?? 0,
          unit: item.unit || 'piece',
          reorderLevel: item.reorderLevel ?? 10,
          isActive: item.isActive ?? true,
        },
      })
      if (item.quantity > 0) {
        // Top-level supplier name wins unless the item specifies its own.
        const lotSupplierName = item.supplierName || supplierInfo?.personName || null
        const lotNotesParts: string[] = []
        if (item.notes) lotNotesParts.push(item.notes)
        if (contactNotes) lotNotesParts.push(contactNotes)
        if (supplierInfo?.notes) lotNotesParts.push(supplierInfo.notes)
        await tx.stock.create({
          data: { productId: p.id, warehouseId, quantity: item.quantity },
        })
        await createLot(tx, ctx, {
          productId: p.id,
          warehouseId,
          enterpriseId,
          quantity: item.quantity,
          unit: item.unit || p.unit,
          costPerUnit: item.costPerUnit ?? p.cost,
          supplierName: lotSupplierName,
          source: 'register_item',
          sourceRef: `REGISTER-${p.id}`,
          notes: lotNotesParts.length ? lotNotesParts.join(' | ') : null,
          conditionId: item.conditionId ?? null,
        })
        lotsCreated++
      }
      created.push(ser(p) as unknown as Product)
    }
    await tx.auditLog.create({
      data: {
        userId: ctx.userId, enterpriseId,
        action: 'register_items', entity: 'Product', entityId: null,
        details: `Bulk-registered ${items.length} product(s) in warehouse #${warehouseId}${supplierInfo?.personName ? ` from ${supplierInfo.personName}` : ''}; ${lotsCreated} lot(s) created`,
      },
    })
    return { products: created, lotsCreated }
  })
  return { products: ser(result.products) as Product[], lotsCreated: result.lotsCreated }
}

// Re-export scoping helpers for use in API routes
export { canAccessEnterprise, canAccessBranch, canAccessWarehouse, canManageUser }
