/**
 * Demo data seeder — plain SQLite (no Prisma).
 *
 * Ported from prisma/seed.ts; uses the Prisma-compatible SQLite shim and the
 * domain layer so Lots/FIFO/stock behave identically. Runs automatically at
 * app startup (src/instrumentation.ts) ONLY when the User table is empty —
 * i.e. first deploy / fresh database (deployment-guide §12 first-run setup).
 * Manual run: `node scripts/seed.js`.
 */

import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { db, registerItem, type AuthContext } from './db'
import { seedAllExistingUsers } from './permissions'

const SUPER_CTX: AuthContext = {
  userId: 1,
  role: 'super_admin',
  enterpriseId: null,
  branchId: null,
  warehouseId: null,
}

export async function seedDemoData(): Promise<void> {
  console.log('[seed] Seeding IMS database…')

  // ─── Wipe existing data ────────────────────────────────
  const wipe = sqlite_wipe()
  void wipe

  // ─── Enterprises ───────────────────────────────────────
  const acme = await prisma.enterprise.create({
    data: {
      name: 'Acme Corp', code: 'ACME',
      contactEmail: 'admin@acme.com', contactPhone: '+1-555-0100',
      address: '100 Business Ave, New York, NY',
      isActive: true, maxBranches: 10, maxWarehouses: 50, maxUsers: 100,
    },
  })
  const beta = await prisma.enterprise.create({
    data: {
      name: 'Beta Industries', code: 'BETA',
      contactEmail: 'admin@beta.com', contactPhone: '+1-555-0200',
      address: '200 Industrial Blvd, Chicago, IL',
      isActive: true, maxBranches: 10, maxWarehouses: 50, maxUsers: 100,
    },
  })
  const gamma = await prisma.enterprise.create({
    data: {
      name: 'Gamma Trading', code: 'GAMM',
      contactEmail: 'admin@gamma.com', contactPhone: '+1-555-0300',
      address: '300 Trade St, Los Angeles, CA',
      isActive: true, maxBranches: 10, maxWarehouses: 50, maxUsers: 100,
    },
  })

  // ─── Branches ──────────────────────────────────────────
  const acmeHQ = await prisma.branch.create({
    data: { enterpriseId: acme.id, name: 'Acme HQ', code: 'ACME-HQ', location: 'New York, NY', managerName: 'Alice Johnson', managerEmail: 'alice@acme.com', isActive: true },
  })
  const acmeNorth = await prisma.branch.create({
    data: { enterpriseId: acme.id, name: 'Acme North', code: 'ACME-N', location: 'Boston, MA', managerName: 'Bob Smith', managerEmail: 'bob@acme.com', isActive: true },
  })
  const betaMain = await prisma.branch.create({
    data: { enterpriseId: beta.id, name: 'Beta Main', code: 'BETA-M', location: 'Chicago, IL', managerName: 'Carol Lee', managerEmail: 'carol@beta.com', isActive: true },
  })
  const betaSouth = await prisma.branch.create({
    data: { enterpriseId: beta.id, name: 'Beta South', code: 'BETA-S', location: 'Houston, TX', managerName: 'Dave Kim', managerEmail: 'dave@beta.com', isActive: true },
  })
  const gammaCentral = await prisma.branch.create({
    data: { enterpriseId: gamma.id, name: 'Gamma Central', code: 'GAMM-C', location: 'Los Angeles, CA', managerName: 'Eve Park', managerEmail: 'eve@gamma.com', isActive: true },
  })

  // ─── Warehouses ────────────────────────────────────────
  const acmeHQWh1 = await prisma.warehouse.create({
    data: { enterpriseId: acme.id, branchId: acmeHQ.id, name: 'Acme HQ Main WH', code: 'ACME-HQ-W1', location: 'NYC Industrial Park', capacity: 10000, managerName: 'Frank Green', isActive: true },
  })
  const acmeHQWh2 = await prisma.warehouse.create({
    data: { enterpriseId: acme.id, branchId: acmeHQ.id, name: 'Acme HQ Overflow', code: 'ACME-HQ-W2', location: 'NYC Secondary Lot', capacity: 5000, managerName: 'Frank Green', isActive: true },
  })
  const acmeNorthWh = await prisma.warehouse.create({
    data: { enterpriseId: acme.id, branchId: acmeNorth.id, name: 'Acme North WH', code: 'ACME-N-W1', location: 'Boston Port', capacity: 8000, managerName: 'Grace Lee', isActive: true },
  })
  const betaMainWh1 = await prisma.warehouse.create({
    data: { enterpriseId: beta.id, branchId: betaMain.id, name: 'Beta Main WH 1', code: 'BETA-M-W1', location: 'Chicago Downtown', capacity: 12000, managerName: 'Henry Clark', isActive: true },
  })
  const betaMainWh2 = await prisma.warehouse.create({
    data: { enterpriseId: beta.id, branchId: betaMain.id, name: 'Beta Main WH 2', code: 'BETA-M-W2', location: 'Chicago Suburb', capacity: 6000, managerName: 'Henry Clark', isActive: true },
  })
  const betaSouthWh = await prisma.warehouse.create({
    data: { enterpriseId: beta.id, branchId: betaSouth.id, name: 'Beta South WH', code: 'BETA-S-W1', location: 'Houston Industrial', capacity: 9000, managerName: 'Ivy Wang', isActive: true },
  })
  const gammaWh = await prisma.warehouse.create({
    data: { enterpriseId: gamma.id, branchId: gammaCentral.id, name: 'Gamma Central WH', code: 'GAMM-C-W1', location: 'LA Industrial', capacity: 11000, managerName: 'Eve Park', isActive: true },
  })

  // ─── Users (12 total, all password = admin123) ─────────
  const passwordHash = await bcrypt.hash('admin123', 10)
  const superadmin = await prisma.user.create({
    data: { username: 'superadmin', email: 'super@ims.com', fullName: 'Super Administrator', role: 'super_admin', isActive: true, passwordHash, enterpriseId: null, branchId: null, warehouseId: null },
  })
  SUPER_CTX.userId = superadmin.id

  await prisma.user.create({
    data: { username: 'acme_admin', email: 'admin@acme.com', fullName: 'Acme Enterprise Admin', role: 'enterprise_admin', isActive: true, passwordHash, enterpriseId: acme.id, branchId: null, warehouseId: null },
  })
  await prisma.user.create({
    data: { username: 'beta_admin', email: 'admin@beta.com', fullName: 'Beta Enterprise Admin', role: 'enterprise_admin', isActive: true, passwordHash, enterpriseId: beta.id, branchId: null, warehouseId: null },
  })
  await prisma.user.create({
    data: { username: 'gamma_admin', email: 'admin@gamma.com', fullName: 'Gamma Enterprise Admin', role: 'enterprise_admin', isActive: true, passwordHash, enterpriseId: gamma.id, branchId: null, warehouseId: null },
  })

  await prisma.user.create({
    data: { username: 'acme_hq_admin', email: 'alice@acme.com', fullName: 'Alice Johnson (HQ)', role: 'branch_admin', isActive: true, passwordHash, enterpriseId: acme.id, branchId: acmeHQ.id, warehouseId: null },
  })
  await prisma.user.create({
    data: { username: 'acme_north_admin', email: 'bob@acme.com', fullName: 'Bob Smith (North)', role: 'branch_admin', isActive: true, passwordHash, enterpriseId: acme.id, branchId: acmeNorth.id, warehouseId: null },
  })
  await prisma.user.create({
    data: { username: 'beta_main_admin', email: 'carol@beta.com', fullName: 'Carol Lee (Main)', role: 'branch_admin', isActive: true, passwordHash, enterpriseId: beta.id, branchId: betaMain.id, warehouseId: null },
  })
  await prisma.user.create({
    data: { username: 'beta_south_admin', email: 'dave@beta.com', fullName: 'Dave Kim (South)', role: 'branch_admin', isActive: true, passwordHash, enterpriseId: beta.id, branchId: betaSouth.id, warehouseId: null },
  })
  await prisma.user.create({
    data: { username: 'gamma_central_admin', email: 'eve@gamma.com', fullName: 'Eve Park (Central)', role: 'branch_admin', isActive: true, passwordHash, enterpriseId: gamma.id, branchId: gammaCentral.id, warehouseId: null },
  })

  await prisma.user.create({
    data: { username: 'acme_wh1_admin', email: 'frank@acme.com', fullName: 'Frank Green (Acme WH1)', role: 'warehouse_admin', isActive: true, passwordHash, enterpriseId: acme.id, branchId: acmeHQ.id, warehouseId: acmeHQWh1.id },
  })
  await prisma.user.create({
    data: { username: 'beta_wh1_admin', email: 'henry@beta.com', fullName: 'Henry Clark (Beta WH1)', role: 'warehouse_admin', isActive: true, passwordHash, enterpriseId: beta.id, branchId: betaMain.id, warehouseId: betaMainWh1.id },
  })

  // Employee (bottom of hierarchy — lives inside a warehouse)
  const wh1Employee = await prisma.user.create({
    data: { username: 'acme_wh1_user', email: 'employee@acme.com', fullName: 'Warehouse Employee', role: 'user', isActive: true, passwordHash, enterpriseId: acme.id, branchId: acmeHQ.id, warehouseId: acmeHQWh1.id },
  })

  // ─── Categories (5 per enterprise) ─────────────────────
  const catNames = ['Electronics', 'Furniture', 'Office Supplies', 'Food & Beverage', 'Raw Materials']
  const catMap = new Map<string, number>()
  for (const ent of [acme, beta, gamma]) {
    for (const cn of catNames) {
      const c = await prisma.category.create({
        data: { enterpriseId: ent.id, name: cn, description: `${cn} for ${ent.name}` },
      })
      catMap.set(`${ent.id}-${cn}`, (c as { id: number }).id)
    }
  }

  // ─── Suppliers (5 per enterprise) ──────────────────────
  const supplierNames = ['TechCorp Supplies', 'Global Materials', 'Premier Logistics', 'Quality Vendors', 'Fast Distributors']
  const supplierMap = new Map<string, number>()
  for (const ent of [acme, beta, gamma]) {
    for (let i = 0; i < supplierNames.length; i++) {
      const s = await prisma.supplier.create({
        data: {
          enterpriseId: ent.id,
          name: `${supplierNames[i]} (${ent.code})`,
          contactPerson: `Contact ${i + 1}`,
          email: `contact${i + 1}@${ent.code.toLowerCase()}.com`,
          phone: `+1-555-${1000 + i}`,
          address: `${1000 + i} Commerce St`,
        },
      })
      supplierMap.set(`${ent.id}-${i}`, (s as { id: number }).id)
    }
  }

  // ─── Products (7 total — via db.registerItem so Lots get created) ─
  const acmeProducts = [
    { name: 'Laptop Pro 15"', sku: 'ACME-ELEC-001', categoryId: catMap.get(`${acme.id}-Electronics`)!, price: 1299.99, cost: 850, unit: 'piece', reorderLevel: 10, qty: 25, warehouseId: acmeHQWh1.id },
    { name: 'Wireless Keyboard', sku: 'ACME-ELEC-002', categoryId: catMap.get(`${acme.id}-Electronics`)!, price: 79.99, cost: 25, unit: 'piece', reorderLevel: 50, qty: 150, warehouseId: acmeHQWh1.id },
    { name: 'Office Desk', sku: 'ACME-FURN-001', categoryId: catMap.get(`${acme.id}-Furniture`)!, price: 449.99, cost: 200, unit: 'piece', reorderLevel: 8, qty: 5, warehouseId: acmeHQWh1.id },
    { name: 'Network Switch 24-port', sku: 'ACME-ELEC-003', categoryId: catMap.get(`${acme.id}-Electronics`)!, price: 299.99, cost: 140, unit: 'piece', reorderLevel: 3, qty: 2, warehouseId: acmeHQWh1.id },
    { name: 'Steel Shelving Unit', sku: 'ACME-FURN-002', categoryId: catMap.get(`${acme.id}-Furniture`)!, price: 189.99, cost: 80, unit: 'piece', reorderLevel: 5, qty: 12, warehouseId: acmeHQWh2.id },
  ]
  const betaProducts = [
    { name: 'Cloud License Pro', sku: 'BETA-SW-001', categoryId: catMap.get(`${beta.id}-Office Supplies`)!, price: 599.99, cost: 200, unit: 'piece', reorderLevel: 0, qty: 50, warehouseId: betaMainWh1.id },
  ]

  for (const p of acmeProducts) {
    await registerItem(SUPER_CTX, {
      enterpriseId: acme.id,
      name: p.name, sku: p.sku,
      description: `${p.name} for Acme Corp`,
      categoryId: p.categoryId,
      price: p.price, cost: p.cost, unit: p.unit, reorderLevel: p.reorderLevel,
      warehouseId: p.warehouseId,
      initialStock: p.qty,
      costPerUnit: p.cost,
      supplierName: 'TechCorp Supplies (ACME)',
      notes: 'Initial stock from registration',
    })
  }
  for (const p of betaProducts) {
    await registerItem(SUPER_CTX, {
      enterpriseId: beta.id,
      name: p.name, sku: p.sku,
      description: `${p.name} for Beta Industries`,
      categoryId: p.categoryId,
      price: p.price, cost: p.cost, unit: p.unit, reorderLevel: p.reorderLevel,
      warehouseId: p.warehouseId,
      initialStock: p.qty,
      costPerUnit: p.cost,
      supplierName: 'TechCorp Supplies (BETA)',
      notes: 'Initial stock from registration',
    })
  }
  await registerItem(SUPER_CTX, {
    enterpriseId: gamma.id,
    name: 'Circuit Board A', sku: 'GAMM-RAW-001',
    description: 'Circuit Board A for Gamma Trading',
    categoryId: catMap.get(`${gamma.id}-Raw Materials`)!,
    price: 45.50, cost: 18, unit: 'piece', reorderLevel: 100,
    warehouseId: gammaWh.id,
    initialStock: 500,
    costPerUnit: 18,
    supplierName: 'Quality Vendors (GAMM)',
    notes: 'Initial stock from registration',
  })

  // ─── Stock In Recorders (linked to real users — "from whom") ──
  const laptop = await prisma.product.findUnique({ where: { sku: 'ACME-ELEC-001' } })
  const keyboard = await prisma.product.findUnique({ where: { sku: 'ACME-ELEC-002' } })
  const switch24 = await prisma.product.findUnique({ where: { sku: 'ACME-ELEC-003' } })
  const cloudLicense = await prisma.product.findUnique({ where: { sku: 'BETA-SW-001' } })

  const sin1 = await db.stockIn.create(SUPER_CTX, {
    enterpriseId: acme.id, warehouseId: acmeHQWh1.id,
    personUserId: wh1Employee.id,
    personName: 'Warehouse Employee', personPhone: '+1-555-0101', personEmail: 'employee@acme.com',
    personAddress: '123 Acme Way, NY', notes: 'Q4 electronics restock', status: 'submitted',
  } as any)
  if (laptop) await db.stockIn.addItem(SUPER_CTX, sin1.id, { productId: laptop.id, warehouseId: acmeHQWh1.id, quantity: 10, unit: 'piece', costPerUnit: 850, notes: 'Laptops - Grade A' })
  if (keyboard) await db.stockIn.addItem(SUPER_CTX, sin1.id, { productId: keyboard.id, warehouseId: acmeHQWh1.id, quantity: 50, unit: 'piece', costPerUnit: 25, notes: 'Keyboards - Bulk' })
  if (switch24) await db.stockIn.addItem(SUPER_CTX, sin1.id, { productId: switch24.id, warehouseId: acmeHQWh1.id, quantity: 5, unit: 'piece', costPerUnit: 140, notes: 'Switches' })

  const sin2 = await db.stockIn.create(SUPER_CTX, {
    enterpriseId: beta.id, warehouseId: betaMainWh1.id,
    personName: 'Sarah Chen', personPhone: '+1-555-0202', personEmail: 'sarah@globalmat.com',
    personAddress: '456 Commerce St, Chicago', notes: 'Software license restock', status: 'pending',
  } as any)
  if (cloudLicense) await db.stockIn.addItem(SUPER_CTX, sin2.id, { productId: cloudLicense.id, warehouseId: betaMainWh1.id, quantity: 20, unit: 'piece', costPerUnit: 200, notes: 'Annual licenses' })

  // ─── Stock Out Recorders (linked to a real user — "for whom") ──
  const sout1 = await db.stockOut.create(SUPER_CTX, {
    enterpriseId: acme.id, warehouseId: acmeHQWh1.id,
    personUserId: wh1Employee.id,
    personName: 'Warehouse Employee', personPhone: '+1-555-9001', personEmail: 'employee@acme.com',
    personAddress: '123 Acme Way, NY', notes: 'Employee equipment issue', status: 'returned',
  } as any)
  if (laptop) await db.stockOut.addItem(SUPER_CTX, sout1.id, { productId: laptop.id, warehouseId: acmeHQWh1.id, quantity: 5, unit: 'piece', isReturnable: true, returnDeadline: '2026-03-01', notes: 'Rental units' })
  if (keyboard) await db.stockOut.addItem(SUPER_CTX, sout1.id, { productId: keyboard.id, warehouseId: acmeHQWh1.id, quantity: 20, unit: 'piece', isReturnable: false, returnDeadline: null, notes: 'Consumable' })

  const sout2 = await db.stockOut.create(SUPER_CTX, {
    enterpriseId: acme.id, warehouseId: acmeHQWh1.id,
    personName: 'StartupXYZ', personPhone: '+1-555-9002', personEmail: 'procurement@startupxyz.io',
    personAddress: '101 Innovation Way, SF', notes: 'New office setup', status: 'pending',
  } as any)
  if (switch24) await db.stockOut.addItem(SUPER_CTX, sout2.id, { productId: switch24.id, warehouseId: acmeHQWh1.id, quantity: 2, unit: 'piece', isReturnable: false, returnDeadline: null, notes: 'Office network' })

  // ─── Orders (3, mixed) ─────────────────────────────────
  const acmeSupplier1Id = supplierMap.get(`${acme.id}-0`)!
  const acmeSupplier2Id = supplierMap.get(`${acme.id}-1`)!
  await db.orders.create(SUPER_CTX, {
    enterpriseId: acme.id, type: 'purchase', supplierId: acmeSupplier1Id, warehouseId: acmeHQWh1.id,
    totalAmount: 12750, notes: 'Q4 restock order',
  } as any)
  await db.orders.create(SUPER_CTX, {
    enterpriseId: acme.id, type: 'purchase', supplierId: acmeSupplier2Id, warehouseId: acmeHQWh1.id,
    totalAmount: 0, notes: 'Awaiting approval',
  } as any)
  await db.orders.create(SUPER_CTX, {
    enterpriseId: acme.id, type: 'sales', supplierId: null, warehouseId: acmeHQWh1.id,
    totalAmount: 6499.95, notes: 'Corporate client order',
  } as any)

  // ─── Features (5 per enterprise) ───────────────────────
  const featureNames = ['inventory_tracking', 'multi_warehouse', 'ai_assistant', 'lot_tracking', 'advanced_reports']
  for (const ent of [acme, beta, gamma]) {
    for (const fname of featureNames) {
      await prisma.feature.create({
        data: { enterpriseId: ent.id, feature: fname, enabled: true },
      })
    }
  }

  // ─── Default permission grants for every user ─────────
  await seedAllExistingUsers()

  // ─── Audit trail ───────────────────────────────────────
  await prisma.auditLog.create({
    data: { userId: superadmin.id, enterpriseId: null, action: 'seed.run', entity: 'System', entityId: null, details: 'Seed completed — 3 enterprises, 5 branches, 7 warehouses, 12 users, 7 products, 2 stock-in recorders, 2 stock-out recorders, 3 orders' },
  })

  const counts = {
    enterprises: await prisma.enterprise.count(),
    branches: await prisma.branch.count(),
    warehouses: await prisma.warehouse.count(),
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    lots: await prisma.lot.count(),
  }
  console.log('[seed] complete:', JSON.stringify(counts))
}

/** Wipe all data (order matters — children first). Kept as a helper for reset flows. */
function sqlite_wipe(): void {
  const tables = [
    'AuditLog', 'NonReturnable', 'NonReturnableRecorder', 'Return', 'ReturnRecorder',
    'StockOutItem', 'StockOutRecorder', 'StockInItem', 'StockInRecorder',
    'OrderItem', 'Order', 'Stock', 'Lot', 'AttachmentMeta', 'Attachment',
    'Product', 'Supplier', 'Category', 'Condition', 'UserPermission', 'User',
    'Warehouse', 'Branch', 'Feature', 'Enterprise',
  ]
  for (const t of tables) {
    try { (prisma as any)[t.charAt(0).toLowerCase() + t.slice(1)].deleteMany({}) } catch { /* table may not exist yet */ }
  }
}

/** True when the database has no users yet (fresh deploy → seed it). */
export async function isDatabaseEmpty(): Promise<boolean> {
  try {
    const count = await prisma.user.count()
    return count === 0
  } catch {
    return true
  }
}
