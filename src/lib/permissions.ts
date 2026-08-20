/**
 * Permission System — Database-backed per-user permissions with delegation control
 *
 * DESIGN:
 *   super_admin → implicitly has ALL abilities with canDelegate=true (no DB rows needed)
 *   All other roles → permissions stored in UserPermission table
 *
 * Each UserPermission row has:
 *   canUse       — the user CAN perform this ability
 *   canDelegate  — the user CAN grant this ability to subordinate admins
 *
 * DELEGATION RULE:
 *   An admin can grant an ability to a subordinate only if:
 *     1. The admin has canDelegate=true for that ability
 *     2. The target user is within the admin's tenant scope
 *     3. The target user's role is strictly lower in the hierarchy
 */

import { prisma } from './prisma'
import type { AuthContext } from './db'
import type { Role } from './db'

// ─── Permission Catalog ─────────────────────────────────────
// Every ability in the system. Used for:
//   - Seeding defaults when a new user is created
//   - Rendering the Permission Manager UI
//   - Validating grant requests

export const ALL_PERMISSIONS = [
  // Dashboard & Audit
  'dashboard:view',
  'audit:view',
  // Enterprises (super_admin only for create/edit/delete)
  'enterprises:view',
  'enterprises:create',
  'enterprises:edit',
  'enterprises:delete',
  'enterprises:set_limits',
  'enterprises:toggle_active',
  'enterprises:manage_admin',
  'enterprises:reset_admin',
  // Branches
  'branches:view',
  'branches:create',
  'branches:edit',
  'branches:delete',
  'branches:set_limits',
  'branches:toggle_active',
  'branches:manage_admin',
  'branches:reset_admin',
  // Warehouses
  'warehouses:view',
  'warehouses:create',
  'warehouses:edit',
  'warehouses:delete',
  'warehouses:set_limits',
  'warehouses:toggle_active',
  'warehouses:manage_admin',
  'warehouses:reset_admin',
  // Users
  'users:view',
  'users:create',
  'users:edit',
  'users:delete',
  'users:toggle_active',
  'users:manage_admin',
  'users:reset_admin',
  // Products
  'products:view',
  'products:create',
  'products:edit',
  'products:delete',
  // Categories
  'categories:view',
  'categories:create',
  'categories:edit',
  'categories:delete',
  // Conditions
  'conditions:view',
  'conditions:create',
  'conditions:edit',
  'conditions:delete',
  // Stock
  'stock:view',
  'stock:adjust',
  // Orders
  'orders:view',
  'orders:create',
  'orders:edit',
  'orders:approve',
  'orders:cancel',
  // Suppliers
  'suppliers:view',
  'suppliers:create',
  'suppliers:edit',
  'suppliers:delete',
  // Stock In
  'stock_in:view',
  'stock_in:create',
  'stock_in:edit',
  'stock_in:delete',
  // Stock Out
  'stock_out:view',
  'stock_out:create',
  'stock_out:edit',
  'stock_out:delete',
  // Returns
  'returns:view',
  'returns:create',
  'returns:edit',
  // Non-Returnables
  'non_returnables:view',
  'non_returnables:create',
  'non_returnables:edit',
  // Attachments
  'attachments:view',
  'attachments:create',
  'attachments:edit',
  'attachments:delete',
  // Lots
  'lots:view',
  // Analytics
  'analytics:view',
  // Features
  'features:view',
  'features:edit',
  // Permissions management (the Permission Manager page itself)
  'permissions:manage',
  'permissions:view',
] as const

export type Permission = typeof ALL_PERMISSIONS[number]

// ─── Permission Groups (for UI display) ─────────────────────

export const PERMISSION_GROUPS: { key: string; label: string; perms: string[] }[] = [
  { key: 'general', label: 'General', perms: ['dashboard:view', 'audit:view', 'analytics:view'] },
  { key: 'enterprises', label: 'Enterprises', perms: ['enterprises:view', 'enterprises:create', 'enterprises:edit', 'enterprises:delete', 'enterprises:set_limits', 'enterprises:toggle_active', 'enterprises:manage_admin', 'enterprises:reset_admin'] },
  { key: 'branches', label: 'Branches', perms: ['branches:view', 'branches:create', 'branches:edit', 'branches:delete', 'branches:set_limits', 'branches:toggle_active', 'branches:manage_admin', 'branches:reset_admin'] },
  { key: 'warehouses', label: 'Warehouses', perms: ['warehouses:view', 'warehouses:create', 'warehouses:edit', 'warehouses:delete', 'warehouses:set_limits', 'warehouses:toggle_active', 'warehouses:manage_admin', 'warehouses:reset_admin'] },
  { key: 'users', label: 'Users', perms: ['users:view', 'users:create', 'users:edit', 'users:delete', 'users:toggle_active', 'users:manage_admin', 'users:reset_admin'] },
  { key: 'products', label: 'Products', perms: ['products:view', 'products:create', 'products:edit', 'products:delete'] },
  { key: 'categories', label: 'Categories', perms: ['categories:view', 'categories:create', 'categories:edit', 'categories:delete'] },
  { key: 'conditions', label: 'Conditions', perms: ['conditions:view', 'conditions:create', 'conditions:edit', 'conditions:delete'] },
  { key: 'stock', label: 'Stock', perms: ['stock:view', 'stock:adjust'] },
  { key: 'orders', label: 'Orders', perms: ['orders:view', 'orders:create', 'orders:edit', 'orders:approve', 'orders:cancel'] },
  { key: 'suppliers', label: 'Suppliers', perms: ['suppliers:view', 'suppliers:create', 'suppliers:edit', 'suppliers:delete'] },
  { key: 'stock_in', label: 'Stock In', perms: ['stock_in:view', 'stock_in:create', 'stock_in:edit', 'stock_in:delete'] },
  { key: 'stock_out', label: 'Stock Out', perms: ['stock_out:view', 'stock_out:create', 'stock_out:edit', 'stock_out:delete'] },
  { key: 'returns', label: 'Returns', perms: ['returns:view', 'returns:create', 'returns:edit'] },
  { key: 'non_returnables', label: 'Non-Returnables', perms: ['non_returnables:view', 'non_returnables:create', 'non_returnables:edit'] },
  { key: 'attachments', label: 'Attachments', perms: ['attachments:view', 'attachments:create', 'attachments:edit', 'attachments:delete'] },
  { key: 'lots', label: 'Lots', perms: ['lots:view'] },
  { key: 'features', label: 'Features', perms: ['features:view', 'features:edit'] },
  { key: 'permissions', label: 'Permission Management', perms: ['permissions:view', 'permissions:manage'] },
]

// ─── Default permission seeds per role ──────────────────────
// When a new non-super_admin user is created, these are the default abilities
// they get (all with canDelegate=false unless the role is an admin that should
// be able to delegate). The granter can then expand/shrink via Permission Manager.

const ROLE_DEFAULTS: Record<string, { perms: string[]; delegatable: string[] }> = {
  enterprise_admin: {
    perms: [
      'dashboard:view', 'audit:view', 'analytics:view',
      'enterprises:view',
      'branches:view', 'branches:create', 'branches:edit', 'branches:delete', 'branches:set_limits', 'branches:toggle_active', 'branches:manage_admin', 'branches:reset_admin',
      'warehouses:view', 'warehouses:create', 'warehouses:edit', 'warehouses:delete', 'warehouses:set_limits', 'warehouses:toggle_active', 'warehouses:manage_admin', 'warehouses:reset_admin',
      'users:view', 'users:create', 'users:edit', 'users:delete', 'users:toggle_active', 'users:manage_admin', 'users:reset_admin',
      'products:view', 'products:create', 'products:edit', 'products:delete',
      'categories:view', 'categories:create', 'categories:edit', 'categories:delete',
      'conditions:view', 'conditions:create', 'conditions:edit', 'conditions:delete',
      'stock:view', 'stock:adjust',
      'orders:view', 'orders:create', 'orders:edit', 'orders:approve', 'orders:cancel',
      'suppliers:view', 'suppliers:create', 'suppliers:edit', 'suppliers:delete',
      'stock_in:view', 'stock_in:create', 'stock_in:edit', 'stock_in:delete',
      'stock_out:view', 'stock_out:create', 'stock_out:edit', 'stock_out:delete',
      'returns:view', 'returns:create', 'returns:edit',
      'non_returnables:view', 'non_returnables:create', 'non_returnables:edit',
      'attachments:view', 'attachments:create', 'attachments:edit', 'attachments:delete',
      'lots:view',
      'features:view',
      'permissions:view', 'permissions:manage',
    ],
    delegatable: [
      'dashboard:view', 'audit:view',
      'branches:view', 'branches:create', 'branches:edit', 'branches:delete', 'branches:set_limits', 'branches:toggle_active', 'branches:manage_admin', 'branches:reset_admin',
      'warehouses:view', 'warehouses:create', 'warehouses:edit', 'warehouses:delete', 'warehouses:set_limits', 'warehouses:toggle_active', 'warehouses:manage_admin', 'warehouses:reset_admin',
      'users:view', 'users:create', 'users:edit', 'users:delete', 'users:toggle_active', 'users:manage_admin', 'users:reset_admin',
      'products:view', 'products:create', 'products:edit', 'products:delete',
      'categories:view', 'categories:create', 'categories:edit',
      'conditions:view', 'conditions:create', 'conditions:edit',
      'stock:view', 'stock:adjust',
      'orders:view', 'orders:create', 'orders:edit', 'orders:approve',
      'suppliers:view', 'suppliers:create', 'suppliers:edit',
      'stock_in:view', 'stock_in:create', 'stock_in:edit',
      'stock_out:view', 'stock_out:create', 'stock_out:edit',
      'returns:view', 'returns:create',
      'non_returnables:view', 'non_returnables:create',
      'attachments:view', 'attachments:create', 'attachments:edit',
      'permissions:view', 'permissions:manage',
    ],
  },
  branch_admin: {
    perms: [
      'dashboard:view',
      'enterprises:view', 'branches:view',
      'warehouses:view', 'warehouses:create', 'warehouses:edit', 'warehouses:set_limits', 'warehouses:toggle_active', 'warehouses:manage_admin', 'warehouses:reset_admin',
      'users:view', 'users:create', 'users:edit', 'users:toggle_active', 'users:manage_admin', 'users:reset_admin',
      'products:view', 'products:create', 'products:edit',
      'categories:view',
      'conditions:view',
      'stock:view', 'stock:adjust',
      'orders:view', 'orders:create', 'orders:edit', 'orders:approve',
      'suppliers:view',
      'stock_in:view', 'stock_in:create', 'stock_in:edit',
      'stock_out:view', 'stock_out:create', 'stock_out:edit',
      'returns:view', 'returns:create',
      'non_returnables:view', 'non_returnables:create',
      'attachments:view', 'attachments:create', 'attachments:edit',
      'lots:view',
      'permissions:view', 'permissions:manage',
    ],
    delegatable: [
      'dashboard:view',
      'warehouses:view', 'warehouses:manage_admin', 'warehouses:reset_admin',
      'users:view', 'users:create', 'users:edit',
      'products:view', 'products:create', 'products:edit',
      'stock:view', 'stock:adjust',
      'orders:view', 'orders:create', 'orders:edit',
      'stock_in:view', 'stock_in:create', 'stock_in:edit',
      'stock_out:view', 'stock_out:create', 'stock_out:edit',
      'returns:view', 'returns:create',
      'non_returnables:view', 'non_returnables:create',
      'attachments:view', 'attachments:create',
      'permissions:view', 'permissions:manage',
    ],
  },
  warehouse_admin: {
    perms: [
      'dashboard:view',
      'enterprises:view', 'branches:view', 'warehouses:view',
      'products:view',
      'categories:view',
      'conditions:view',
      'stock:view', 'stock:adjust',
      'orders:view', 'orders:create', 'orders:edit',
      'suppliers:view',
      'stock_in:view', 'stock_in:create', 'stock_in:edit',
      'stock_out:view', 'stock_out:create', 'stock_out:edit',
      'returns:view', 'returns:create',
      'non_returnables:view', 'non_returnables:create',
      'attachments:view', 'attachments:create', 'attachments:edit',
      'lots:view',
      'users:view', 'users:create', 'users:edit',
      'permissions:view', 'permissions:manage',
    ],
    delegatable: [
      'dashboard:view',
      'warehouses:view',
      'products:view',
      'stock:view', 'stock:adjust',
      'orders:view', 'orders:create', 'orders:edit',
      'stock_in:view', 'stock_in:create', 'stock_in:edit',
      'stock_out:view', 'stock_out:create', 'stock_out:edit',
      'returns:view', 'returns:create',
      'non_returnables:view', 'non_returnables:create',
      'attachments:view', 'attachments:create',
      'users:view', 'users:create', 'users:edit',
      'permissions:view', 'permissions:manage',
    ],
  },
  user: {
    perms: [
      'dashboard:view',
      'enterprises:view', 'branches:view', 'warehouses:view',
      'products:view',
      'categories:view',
      'conditions:view',
      'stock:view', 'stock:adjust',
      'orders:view', 'orders:create', 'orders:edit',
      'suppliers:view',
      'stock_in:view', 'stock_in:create',
      'stock_out:view', 'stock_out:create',
      'returns:view', 'returns:create',
      'non_returnables:view',
      'attachments:view', 'attachments:create',
      'lots:view',
    ],
    delegatable: [],
  },
}

// ─── Role hierarchy ─────────────────────────────────────────

const ROLE_ORDER: Record<string, number> = {
  super_admin: 0, enterprise_admin: 1, branch_admin: 2, warehouse_admin: 3, user: 4,
}

export function roleLevel(role: string): number {
  return ROLE_ORDER[role] ?? 99
}

/** Is actorRole strictly above targetRole in the hierarchy? */
export function isAbove(actorRole: string, targetRole: string): boolean {
  return roleLevel(actorRole) < roleLevel(targetRole)
}

// ─── Permission Resolution ──────────────────────────────────

export interface ResolvedPermissions {
  /** Abilities the user can USE (canUse=true) */
  permissions: Set<string>
  /** Abilities the user can DELEGATE to subordinates (canDelegate=true) */
  delegatable: Set<string>
  /** True if super_admin (implicit all-permissions) */
  isSuperAdmin: boolean
}

/** Resolve all permissions for a user from the DB.
 *  super_admin gets ALL permissions implicitly with canDelegate=true. */
export async function resolvePermissions(userId: number, role: string): Promise<ResolvedPermissions> {
  if (role === 'super_admin') {
    return {
      permissions: new Set(ALL_PERMISSIONS as readonly string[]),
      delegatable: new Set(ALL_PERMISSIONS as readonly string[]),
      isSuperAdmin: true,
    }
  }
  const rows = await prisma.userPermission.findMany({ where: { userId } })
  const permissions = new Set<string>()
  const delegatable = new Set<string>()
  for (const r of rows) {
    if (r.canUse) permissions.add(r.ability)
    if (r.canDelegate) delegatable.add(r.ability)
  }
  return { permissions, delegatable, isSuperAdmin: false }
}

/** Check if a user has a specific permission (canUse). */
export async function hasPermission(userId: number, role: string, ability: string): Promise<boolean> {
  if (role === 'super_admin') return true
  const row = await prisma.userPermission.findUnique({
    where: { userId_ability: { userId, ability } },
  })
  return !!row?.canUse
}

/** Check if a user can delegate a specific permission (canDelegate). */
export async function canDelegate(userId: number, role: string, ability: string): Promise<boolean> {
  if (role === 'super_admin') return true
  const row = await prisma.userPermission.findUnique({
    where: { userId_ability: { userId, ability } },
  })
  return !!row?.canDelegate
}

// ─── Permission Enforcement (for API routes) ───────────────

/** Throw FORBIDDEN if the user doesn't have the required permission.
 *  This is the main gatekeeper for ALL API endpoints. */
export async function requirePermission(ctx: AuthContext, ability: string): Promise<void> {
  const ok = await hasPermission(ctx.userId, ctx.role, ability)
  if (!ok) {
    throw new Error(`FORBIDDEN: Missing permission "${ability}"`)
  }
}

/** Convenience: throw if user can't delegate the given ability. */
export async function requireDelegation(ctx: AuthContext, ability: string): Promise<void> {
  const ok = await canDelegate(ctx.userId, ctx.role, ability)
  if (!ok) {
    throw new Error(`FORBIDDEN: Cannot delegate "${ability}"`)
  }
}

// ─── Delegation Logic ───────────────────────────────────────

/** Can a granter manage the target user (grant/revoke permissions)?
 *  - super_admin → can manage anyone except another super_admin
 *  - enterprise_admin → can manage branch_admin/warehouse_admin in same enterprise
 *  - branch_admin → can manage warehouse_admin in same branch
 *  - warehouse_admin → cannot manage anyone */
export async function canManageTarget(
  granter: AuthContext,
  targetId: number,
): Promise<boolean> {
  if (granter.role === 'user') return false
  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target) return false
  if (target.role === 'super_admin') return false
  if (granter.role === 'super_admin') return true
  if (!isAbove(granter.role, target.role)) return false
  // Tenant scope check
  if (granter.role === 'enterprise_admin') {
    return target.enterpriseId === granter.enterpriseId
  }
  if (granter.role === 'branch_admin') {
    return target.branchId === granter.branchId && target.enterpriseId === granter.enterpriseId
  }
  if (granter.role === 'warehouse_admin') {
    return target.warehouseId === granter.warehouseId && target.branchId === granter.branchId && target.enterpriseId === granter.enterpriseId
  }
  return false
}

/** Grant a permission to a target user.
 *  Validates: granter can delegate, target is in scope, target role is lower. */
export async function grantPermission(
  granter: AuthContext,
  targetId: number,
  ability: string,
  opts: { canUse?: boolean; canDelegate?: boolean },
): Promise<void> {
  // Validate the ability is a known permission
  if (!(ALL_PERMISSIONS as readonly string[]).includes(ability)) {
    throw new Error(`Validation: Unknown permission "${ability}"`)
  }
  // Validate granter can delegate this ability
  await requireDelegation(granter, ability)
  // Validate granter can manage the target
  const canManage = await canManageTarget(granter, targetId)
  if (!canManage) {
    throw new Error('FORBIDDEN: Cannot manage permissions for this user')
  }
  const canUse = opts.canUse ?? true
  const canDelegateFlag = opts.canDelegate ?? false
  // If granting canDelegate=true, the granter must also have canDelegate=true (already checked above)
  await prisma.userPermission.upsert({
    where: { userId_ability: { userId: targetId, ability } },
    create: {
      userId: targetId, ability, canUse, canDelegate: canDelegateFlag,
      grantedById: granter.userId || null,
    },
    update: { canUse, canDelegate: canDelegateFlag, grantedById: granter.userId || null },
  })
  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: granter.userId,
      enterpriseId: granter.enterpriseId,
      action: 'permission.grant',
      entity: 'UserPermission',
      entityId: targetId,
      details: `Granted ${ability} to user #${targetId} (canUse=${canUse}, canDelegate=${canDelegateFlag})`,
    },
  })
}

/** Revoke a permission from a target user. */
export async function revokePermission(
  granter: AuthContext,
  targetId: number,
  ability: string,
): Promise<void> {
  const canManage = await canManageTarget(granter, targetId)
  if (!canManage) {
    throw new Error('FORBIDDEN: Cannot manage permissions for this user')
  }
  await prisma.userPermission.deleteMany({
    where: { userId: targetId, ability },
  })
  await prisma.auditLog.create({
    data: {
      userId: granter.userId,
      enterpriseId: granter.enterpriseId,
      action: 'permission.revoke',
      entity: 'UserPermission',
      entityId: targetId,
      details: `Revoked ${ability} from user #${targetId}`,
    },
  })
}

// ─── Seeding ────────────────────────────────────────────────

/** Seed default permissions for a newly created user based on their role.
 *  super_admin is skipped (implicit permissions). */
export async function seedDefaultPermissions(
  userId: number,
  role: string,
  grantedById?: number,
): Promise<void> {
  if (role === 'super_admin') return
  const defaults = ROLE_DEFAULTS[role]
  if (!defaults) return
  const rows = [
    ...defaults.perms.map(ability => ({ userId, ability, canUse: true, canDelegate: false, grantedById: grantedById ?? null })),
    ...defaults.delegatable.map(ability => ({ userId, ability, canUse: true, canDelegate: true, grantedById: grantedById ?? null })),
  ]
  // Dedupe: if an ability appears in both perms and delegatable, keep canDelegate=true
  const seen = new Map<string, { userId: number; ability: string; canUse: boolean; canDelegate: boolean; grantedById: number | null }>()
  for (const r of rows) {
    const existing = seen.get(r.ability)
    if (existing) {
      existing.canUse = existing.canUse || r.canUse
      existing.canDelegate = existing.canDelegate || r.canDelegate
    } else {
      seen.set(r.ability, { ...r })
    }
  }
  // SQLite doesn't support skipDuplicates, so delete existing rows first then create
  await prisma.userPermission.deleteMany({ where: { userId } })
  await prisma.userPermission.createMany({
    data: Array.from(seen.values()),
  })
}

/** Seed default permissions for ALL existing users who don't have any yet.
 *  Used for migration when the permission system is first introduced. */
export async function seedAllExistingUsers(): Promise<{ seeded: number; skipped: number }> {
  const users = await prisma.user.findMany()
  let seeded = 0, skipped = 0
  for (const u of users) {
    if (u.role === 'super_admin') { skipped++; continue }
    const existing = await prisma.userPermission.count({ where: { userId: u.id } })
    if (existing > 0) { skipped++; continue }
    await seedDefaultPermissions(u.id, u.role)
    seeded++
  }
  return { seeded, skipped }
}

// ─── Subordinate listing (for Permission Manager UI) ───────

/** List users whose permissions the granter can manage. */
export async function getSubordinateUsers(granter: AuthContext): Promise<{
  id: number; username: string; fullName: string; role: string
  enterpriseId: number | null; branchId: number | null; warehouseId: number | null
}[]> {
  if (granter.role === 'user') return []
  if (granter.role === 'super_admin') {
    return prisma.user.findMany({
      where: { role: { not: 'super_admin' } },
      select: { id: true, username: true, fullName: true, role: true, enterpriseId: true, branchId: true, warehouseId: true },
      orderBy: { id: 'asc' },
    })
  }
  if (granter.role === 'enterprise_admin') {
    return prisma.user.findMany({
      where: {
        enterpriseId: granter.enterpriseId,
        role: { in: ['branch_admin', 'warehouse_admin', 'user'] },
      },
      select: { id: true, username: true, fullName: true, role: true, enterpriseId: true, branchId: true, warehouseId: true },
      orderBy: { id: 'asc' },
    })
  }
  if (granter.role === 'branch_admin') {
    return prisma.user.findMany({
      where: {
        branchId: granter.branchId,
        enterpriseId: granter.enterpriseId,
        role: { in: ['warehouse_admin', 'user'] },
      },
      select: { id: true, username: true, fullName: true, role: true, enterpriseId: true, branchId: true, warehouseId: true },
      orderBy: { id: 'asc' },
    })
  }
  if (granter.role === 'warehouse_admin') {
    return prisma.user.findMany({
      where: {
        warehouseId: granter.warehouseId,
        branchId: granter.branchId,
        enterpriseId: granter.enterpriseId,
        role: 'user',
      },
      select: { id: true, username: true, fullName: true, role: true, enterpriseId: true, branchId: true, warehouseId: true },
      orderBy: { id: 'asc' },
    })
  }
  return []
}
