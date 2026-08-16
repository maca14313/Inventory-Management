/**
 * Role-Based Access Control (RBAC) — Strict Hierarchy Enforcement
 *
 * HIERARCHY (top → bottom):
 *   super_admin      → Manages ALL enterprises. Grants access. Creates enterprise_admins.
 *   enterprise_admin → Manages ONLY their enterprise. Creates branch_admins & warehouse_admins within it.
 *   branch_admin     → Manages ONLY their branch. Creates warehouse_admins within it.
 *   warehouse_admin  → Manages ONLY their warehouse. Stock adjustments, order views.
 *
 * KEY RULES:
 *   1. Each role can ONLY manage roles BELOW them in the hierarchy
 *   2. Each role is SCOPED to their tenant (enterprise/branch/warehouse)
 *   3. Data access is filtered by tenant — you NEVER see cross-tenant data
 *   4. Enterprise Admin cannot see other enterprises, even read-only
 *   5. Branch Admin cannot see other branches in the same enterprise
 *   6. Warehouse Admin cannot see other warehouses in the same branch
 */

// ─── Role Definition ─────────────────────────────────────────

export type RoleLevel = 'super_admin' | 'enterprise_admin' | 'branch_admin' | 'warehouse_admin'

export const ROLE_HIERARCHY: RoleLevel[] = [
  'super_admin', 'enterprise_admin', 'branch_admin', 'warehouse_admin'
]

export const ROLE_LABELS: Record<RoleLevel, string> = {
  super_admin: 'Super Admin',
  enterprise_admin: 'Enterprise Admin',
  branch_admin: 'Branch Admin',
  warehouse_admin: 'Warehouse Admin',
}

export const ROLE_DESCRIPTIONS: Record<RoleLevel, string> = {
  super_admin: 'Full system access. Manages all enterprises, creates enterprise admins, toggles features.',
  enterprise_admin: 'Scoped to one enterprise. Manages branches, warehouses, users, and all inventory within it.',
  branch_admin: 'Scoped to one branch. Manages warehouses and warehouse admins within it.',
  warehouse_admin: 'Scoped to one warehouse. Manages stock and views orders for that warehouse only.',
}

/** What roles can each role CREATE/MANAGE? */
export const MANAGEABLE_ROLES: Record<RoleLevel, RoleLevel[]> = {
  super_admin: ['enterprise_admin', 'branch_admin', 'warehouse_admin'],
  enterprise_admin: ['branch_admin', 'warehouse_admin'],
  branch_admin: ['warehouse_admin'],
  warehouse_admin: [],
}

// ─── Permissions ─────────────────────────────────────────────

export type Permission =
  // Enterprise-level
  | 'enterprises:view' | 'enterprises:create' | 'enterprises:edit' | 'enterprises:delete' | 'enterprises:set_abilities' | 'enterprises:set_features'
  // Branch-level
  | 'branches:view' | 'branches:create' | 'branches:edit' | 'branches:delete'
  // Warehouse-level
  | 'warehouses:view' | 'warehouses:create' | 'warehouses:edit' | 'warehouses:delete'
  // User-level
  | 'users:view' | 'users:create' | 'users:edit' | 'users:delete' | 'users:assign_roles'
  // Product-level
  | 'products:view' | 'products:create' | 'products:edit' | 'products:delete'
  // Category-level
  | 'categories:view' | 'categories:create' | 'categories:edit' | 'categories:delete'
  // Stock-level
  | 'stock:view' | 'stock:adjust'
  // Order-level
  | 'orders:view' | 'orders:create' | 'orders:edit' | 'orders:approve' | 'orders:cancel'
  // Supplier-level
  | 'suppliers:view' | 'suppliers:create' | 'suppliers:edit' | 'suppliers:delete'
  // Audit
  | 'audit:view'
  // Dashboard
  | 'dashboard:view'

// ─── Permission Groups (for UI display) ──────────────────────

export const PERMISSION_GROUPS = {
  enterprises: { label: 'Enterprises', perms: ['enterprises:view','enterprises:create','enterprises:edit','enterprises:delete','enterprises:set_abilities','enterprises:set_features'] as Permission[] },
  branches: { label: 'Branches', perms: ['branches:view','branches:create','branches:edit','branches:delete'] as Permission[] },
  warehouses: { label: 'Warehouses', perms: ['warehouses:view','warehouses:create','warehouses:edit','warehouses:delete'] as Permission[] },
  users: { label: 'Users', perms: ['users:view','users:create','users:edit','users:delete','users:assign_roles'] as Permission[] },
  products: { label: 'Products', perms: ['products:view','products:create','products:edit','products:delete'] as Permission[] },
  categories: { label: 'Categories', perms: ['categories:view','categories:create','categories:edit','categories:delete'] as Permission[] },
  stock: { label: 'Stock', perms: ['stock:view','stock:adjust'] as Permission[] },
  orders: { label: 'Orders', perms: ['orders:view','orders:create','orders:edit','orders:approve','orders:cancel'] as Permission[] },
  suppliers: { label: 'Suppliers', perms: ['suppliers:view','suppliers:create','suppliers:edit','suppliers:delete'] as Permission[] },
} as const

// ─── Role → Permissions Mapping ──────────────────────────────

const ALL_PERMS: Permission[] = Object.values(PERMISSION_GROUPS).flatMap(g => g.perms).concat(['audit:view', 'dashboard:view'])

const ROLE_PERMISSIONS: Record<RoleLevel, Permission[]> = {
  super_admin: ALL_PERMS,

  enterprise_admin: [
    'dashboard:view', 'audit:view',
    'enterprises:view', 'enterprises:edit', 'enterprises:set_abilities',
    'branches:view', 'branches:create', 'branches:edit', 'branches:delete',
    'warehouses:view', 'warehouses:create', 'warehouses:edit', 'warehouses:delete',
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:assign_roles',
    'products:view', 'products:create', 'products:edit', 'products:delete',
    'categories:view', 'categories:create', 'categories:edit', 'categories:delete',
    'stock:view', 'stock:adjust',
    'orders:view', 'orders:create', 'orders:edit', 'orders:approve', 'orders:cancel',
    'suppliers:view', 'suppliers:create', 'suppliers:edit', 'suppliers:delete',
  ],

  branch_admin: [
    'dashboard:view',
    'enterprises:view',
    'branches:view', 'branches:edit',
    'warehouses:view', 'warehouses:create', 'warehouses:edit',
    'users:view', 'users:create', 'users:edit',
    'products:view', 'products:create', 'products:edit',
    'categories:view',
    'stock:view', 'stock:adjust',
    'orders:view', 'orders:create', 'orders:edit', 'orders:approve',
    'suppliers:view',
  ],

  warehouse_admin: [
    'dashboard:view',
    'enterprises:view',
    'branches:view',
    'warehouses:view', 'warehouses:edit',
    'products:view',
    'categories:view',
    'stock:view', 'stock:adjust',
    'orders:view', 'orders:create', 'orders:edit',
    'suppliers:view',
  ],
}

// ─── Enterprise Abilities (toggleable per enterprise by super_admin) ────

export type EnterpriseAbility =
  | 'can_create_branches' | 'can_create_warehouses'
  | 'can_create_products' | 'can_create_orders'
  | 'can_manage_suppliers' | 'can_manage_categories'
  | 'can_approve_orders' | 'can_adjust_stock'
  | 'can_invite_users'

export const ALL_ABILITIES: EnterpriseAbility[] = [
  'can_create_branches', 'can_create_warehouses',
  'can_create_products', 'can_create_orders',
  'can_manage_suppliers', 'can_manage_categories',
  'can_approve_orders', 'can_adjust_stock',
  'can_invite_users',
]

export const ABILITY_LABELS: Record<EnterpriseAbility, string> = {
  can_create_branches: 'Create Branches',
  can_create_warehouses: 'Create Warehouses',
  can_create_products: 'Create Products',
  can_create_orders: 'Create Orders',
  can_manage_suppliers: 'Manage Suppliers',
  can_manage_categories: 'Manage Categories',
  can_approve_orders: 'Approve Orders',
  can_adjust_stock: 'Adjust Stock',
  can_invite_users: 'Invite Users',
}

// ─── Check Functions ─────────────────────────────────────────

import { useAuthStore } from './auth-store'

/** Check if a role has a permission.
 *
 *  This function checks DB-backed permissions first (loaded into the auth store
 *  from /api/permissions after login). If the store has permissions loaded,
 *  those take precedence over the static ROLE_PERMISSIONS map. This means
 *  the UI reflects the actual per-user permissions granted by the admin,
 *  not just the role-based defaults.
 *
 *  For super_admin, always returns true (implicit all-permissions).
 *  If the store hasn't loaded permissions yet (e.g. during SSR or before
 *  the /api/permissions fetch completes), falls back to the static map. */
export function hasPermission(role: RoleLevel, perm: Permission): boolean {
  if (role === 'super_admin') return true
  // Check DB-backed permissions from the auth store (client-side only)
  const storePerms = useAuthStore.getState().permissions
  if (storePerms && storePerms.size > 0) {
    return storePerms.has(perm)
  }
  // Fallback to static role-based map (used during initial load / SSR)
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false
}

/** Check if the current user can DELEGATE a permission to subordinates.
 *  Based on DB-backed delegatable permissions in the auth store. */
export function canDelegatePerm(perm: Permission): boolean {
  const store = useAuthStore.getState()
  if (store.role === 'super_admin') return true
  return store.delegatable?.has(perm) ?? false
}

export function getPermissions(role: RoleLevel): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

export function getRoleLevel(role: RoleLevel): number {
  return ROLE_HIERARCHY.indexOf(role)
}

/** Can actorRole manage (create/edit/delete) targetRole? */
export function canManageRole(actorRole: RoleLevel, targetRole: RoleLevel): boolean {
  return MANAGEABLE_ROLES[actorRole]?.includes(targetRole) ?? false
}

/** Is actorRole strictly above targetRole in hierarchy? */
export function isAbove(actorRole: RoleLevel, targetRole: RoleLevel): boolean {
  return getRoleLevel(actorRole) < getRoleLevel(targetRole)
}

// ─── Navigation Items Per Role ───────────────────────────────

export interface NavItem {
  key: string
  label: string
  icon: string
  href: string
  permission?: Permission
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', href: '/dashboard', permission: 'dashboard:view' },
  { key: 'enterprises', label: 'Enterprises', icon: 'Building2', href: '/enterprises', permission: 'enterprises:view' },
  { key: 'branches', label: 'Branches', icon: 'GitBranch', href: '/branches', permission: 'branches:view' },
  { key: 'warehouses', label: 'Warehouses', icon: 'Warehouse', href: '/warehouses', permission: 'warehouses:view' },
  { key: 'users', label: 'Users', icon: 'Users', href: '/users', permission: 'users:view' },
  { key: 'products', label: 'Products', icon: 'Package', href: '/products', permission: 'products:view' },
  { key: 'categories', label: 'Categories', icon: 'Tag', href: '/categories', permission: 'categories:view' },
  { key: 'conditions', label: 'Conditions', icon: 'ClipboardCheck', href: '/conditions', permission: 'categories:view' },
  { key: 'stock', label: 'Stock', icon: 'Box', href: '/stock', permission: 'stock:view' },
  { key: 'orders', label: 'Orders', icon: 'ShoppingCart', href: '/orders', permission: 'orders:view' },
  { key: 'suppliers', label: 'Suppliers', icon: 'Truck', href: '/suppliers', permission: 'suppliers:view' },
  { key: 'permissions', label: 'Permission Manager', icon: 'ShieldCheck', href: '/permissions', permission: 'permissions:view' },
  { key: 'audit', label: 'Audit Log', icon: 'Shield', href: '/audit', permission: 'audit:view' },
]

export function getNavItemsForRole(role: RoleLevel): NavItem[] {
  return ALL_NAV_ITEMS.filter(item => {
    if (!item.permission) return true
    return hasPermission(role, item.permission)
  })
}

// ─── AuthUser Type ───────────────────────────────────────────

export interface AuthUser {
  id: number
  name: string
  email: string
  role: RoleLevel
  enterpriseId: number | null
  branchId: number | null
  warehouseId: number | null
  isActive: boolean
  abilities?: EnterpriseAbility[]
}
