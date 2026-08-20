### Session Continuation — 2026-01-19 (3rd attempt)

---
Task ID: 1 — Add 'user' role + branch/warehouse limits to prisma schema + push to DB
- Added `maxWarehouses Int @default(20)` and `maxUsers Int @default(50)` to Branch model
- Added `maxUsers Int @default(20)` to Warehouse model
- Updated User model comment to include 'user' role
- Ran `bun run db:push` — DB synced

Stage Summary: Schema now supports limits on Branch and Warehouse models

---
Task ID: 2 — Update rbac.ts — add 'user' role to hierarchy, labels, manageable roles
- Added 'user' to RoleLevel type union
- Added 'user' to ROLE_HIERARCHY array
- Added 'User' to ROLE_LABELS, ROLE_DESCRIPTIONS, MANAGEABLE_ROLES
- warehouse_admin can now manage 'user' role
- Stage Summary: 5-level role hierarchy: super_admin → enterprise_admin → branch_admin → warehouse_admin → user

---
Task ID: 3 — Update permissions.ts — new permission strings, user role defaults, subordinate management
- Added new permissions: branches:set_limits, branches:toggle_active, branches:manage_admin, branches:reset_admin, warehouses:set_limits, warehouses:toggle_active, warehouses:manage_admin, warehouses:reset_admin, users:toggle_active, users:manage_admin, users:reset_admin
- Updated PERMISSION_GROUPS to include new permission strings
- Added 'user' role to ROLE_ORDER (level 4)
- Added ROLE_DEFAULTS for 'user' role (basic employee permissions)
- Updated enterprise_admin and branch_admin defaults to include new permission strings
- Updated warehouse_admin defaults to include users:view, users:create, users:edit, permissions:view, permissions:manage with delegatable
- Updated canManageTarget to allow warehouse_admin to manage 'user' role within warehouse scope
- Updated getSubordinateUsers to include 'user' role for all admin levels
- Stage Summary: Complete permission catalog with 80+ permissions

---
Task ID: 4 — Create API routes for branches and warehouses
- Created `src/app/api/branches/[id]/create-admin/route.ts` — POST creates branch_admin for a branch
- Created `src/app/api/branches/[id]/reset-admin/route.ts` — POST resets branch admin password
- Created `src/app/api/warehouses/[id]/create-admin/route.ts` — POST creates warehouse_admin for a warehouse
- Created `src/app/api/warehouses/[id]/reset-admin/route.ts` — POST resets warehouse admin password
- All follow the same pattern as enterprise create-admin/reset-admin
- Stage Summary: 4 new API routes for admin management across all levels

---
Task ID: 5 — Update page.tsx — All frontend changes

**Demo account**: Added `{ u: 'acme_wh1_user', label: 'User', desc: 'Acme WH1', color: 'from-slate-500 to-slate-600' }` to login page
**Branches section**: Rewrote to match Enterprises pattern with: admin management (Create/Edit/Reset Admin), active status toggle, limits display (W:20 U:50), Permission Manager link
**Warehouses section**: Rewrote to match Enterprises pattern with: admin management (Create/Edit/Reset Admin), active status toggle, limits display (U:20), Permission Manager link
**Users section**: Added 'user' to color map, active status toggle, delete button, 'user' role badge color, 'pending' status color for user role
**Permission Manager**: Updated to allow warehouse_admin (not just excluding it) to manage subordinates
**Permission Editor**: Added `renderPermGroup` helper function (extracted from JSX to avoid const declarations in JSX expression)
**Bulk toggle buttons**: Added 'Use All' and 'Del. All' buttons per permission group
**Loading states**: Added `permLoading` state for Use and Delegate switches with spinner indicators
**New state variables**: brAdminDlg, brResetDlg, brEditAdminDlg, brLimitsDlg, whAdminDlg, whResetDlg, whEditAdminDlg, whLimitsDlg, permLoading
- Stage Summary: Complete frontend implementation

---
Task ID: 6 — Seed demo user account
- Created seed-user.ts script to create 'acme_wh1_user' with role 'user' under Acme HQ WH1 (id:50, branchId:36, enterpriseId:22)
- Password: admin123, seeded default permissions for user role
- Ran `bun run scripts/reseed-perms.ts` to reseed all users with new permission strings
- Stage Summary: Demo user account 'acme_wh1_user' (id:89) created and seeded
---
Task ID: 7 — Verification
- Lint passes with only a size warning (6082 lines)
- Dev server returns 200 on all page loads
- Agent Browser verified: login page shows all 5 demo accounts (S/E/B/W/U)
- Agent Browser verified: user can log in as 'Warehouse Employee'
- Dashboard renders with 'Current: Reorder:', stock data, etc.
