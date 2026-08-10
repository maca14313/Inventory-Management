# Session Handoff — Enterprise IMS Rebuild & Changes

> **Purpose:** Full record of everything added/fixed/changed in this chat session, so the next chat can pick up exactly where this one left off.

---

## 1. Project Background

**App:** Multi-Tenant Enterprise Inventory Management System (IMS)
**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui + Prisma ORM (SQLite) + Recharts
**Architecture:** 4-tier RBAC (super_admin → enterprise_admin → branch_admin → warehouse_admin), multi-tenant (Enterprise → Branch → Warehouse hierarchy), single-page app at `/`

**Critical event this session:** The workspace was reset to the default Next.js boilerplate mid-conversation. The original IMS code (~3000 lines across ~40 files) was lost. Only `/home/z/my-project/worklog.md` (the narrative log) survived. The user attempted to re-upload the original tar twice, but **the uploads never landed on disk** — `/home/z/my-project/upload/` remained empty. A full rebuild from the worklog was started.

---

## 2. What Was Done Before The Reset (Tasks 1–8, from worklog)

These were completed on the original codebase before it was lost. They must be re-applied on any rebuild.

### Task 1 — Prisma Migration + AI Assistant + Analytics
- Migrated from in-memory/JSON to Prisma + SQLite
- Designed full Prisma schema: Enterprise, Branch, Warehouse, User, Category, Supplier, Product, Stock, Batch+BatchEntry, StockOutRecorder+StockOutItem, Order+OrderItem, AuditLog, Feature
- Used `Int @id @default(autoincrement())` to preserve numeric-ID contract the frontend expects
- Wrote `src/lib/prisma.ts` (PrismaClient singleton) and `src/lib/db.ts` (~1000-line domain layer preserving a stable `db` interface all API routes consume)
- All tenant scoping in `db.ts` (super_admin sees all; enterprise_admin by enterpriseId; branch_admin by branch's warehouses; warehouse_admin by warehouseId)
- Stock-in/batch-entry/stock-out use `prisma.$transaction` for atomicity + audit logging
- Added AI Inventory Assistant (chatbot using z-ai-web-dev-sdk LLM)
- Added rich analytics dashboard with Recharts (stock by warehouse, by category, top products, recent activity)

### Task 2 — RBAC + i18n + Layout
- Full RBAC permission matrix in `src/lib/rbac.ts` (4 roles × ~40 permissions)
- 5-locale i18n in `src/lib/i18n.ts` (EN, AM=Amharic, OM=Oromo, AR=Arabic, FR=French)
- Cookie-based session auth in `src/lib/auth-store.ts` (`getAuthContextFromHeaders`, `makeSessionCookie`, `clearSessionCookie`)
- Client-side `apiFetch` + `makeCrud` helpers in `src/lib/api.ts`

### Task 4-b — Next.js 16 Async Params Fix (BUG-A + BUG-B)
- **BUG-A:** All 8 `[id]/route.ts` files (products, categories, suppliers, orders, enterprises, branches, warehouses, users) were using the old sync `params: { id: string }` signature, causing HTTP 500 "Argument `id` is missing" on every Edit/Delete. Fixed all to Next.js 16 async pattern: `params: Promise<{ id: string }>` + `const { id } = await params`.
- **BUG-B:** `/api/batches/[id]/route.ts` was missing entirely → 404 on "Close Batch". Created the route with GET/PUT/DELETE.

### Task 5 — Products & Stock Page Conversion + Verification
- Converted Products page from card grid → responsive table (8 cols: Product, Category, Price, Cost, In Stock, Reorder, Status, Actions)
- Converted Stock page from card grid → responsive table (6 cols: Product, Warehouse, Quantity, Value, Status, Actions)
- Added search boxes + pagination + "N records" count on both
- `safePage = min(currentPage, totalPages)` so deleting/searching can't strand user on out-of-range page
- Hid Products table Cost + Reorder columns on mobile (`hidden sm:table-cell`)
- Browser-verified all 7 pages functional end-to-end

### Task 1-b — Stock In Recorder Backend (mirrors Stock Out)
- Added `StockInRecorder` + `StockInItem` Prisma models
- `db.stockIn` domain layer: `findMany`, `findById`, `create`, `update`, `remove`, `addItem`, `removeItem` — all atomic `prisma.$transaction` with stock increment/decrement + audit logs + tenant scoping + negative-stock guards
- 4 API routes: `/api/stock-in`, `/api/stock-in/[id]`, `/api/stock-in/[id]/item`, `/api/stock-in/[id]/item/[itemId]`
- Auto-generated `recorderCode` = `SIN-YYYY-NNN`
- Prisma client hot-reload fix: added `PRISMA_CLIENT_VERSION` stamp to `src/lib/prisma.ts` so the dev server picks up regenerated PrismaClient after `db:push`

### Task 6 — Stock In Recorder Frontend + Mobile Fixes
- Built Stock In page section mirroring Stock Out: emerald/teal theme, filters (date range/status/supplier search), paginated recorder list with expandable cards, items table, Submit-pending button, Add-Items section with Pick mode + Table mode, Print receipt
- Added 'stockIn' nav item (ArrowDownToLine icon, `stock:view` permission)
- Added `dlgType: 'stockInRecorder'` create/edit dialog (warehouse + supplier name/phone/email/address + notes)
- Mobile-first fixes: changed dense tables from `overflow-hidden` (clipped) to `overflow-x-auto` (scrolls); added `flex-wrap gap-2` to all page headers; added `flex-wrap` to language-switcher buttons

### Task 7 — UX Redundancy Cleanup (Stock Page Header)
**User discussion challenged redundancy. Removed:**
- "Register Item" button from Stock page header (it's a catalog operation, belongs on Products page only)
- Page-level "Stock In" button from Stock page header (every stock row has its own Stock In button with full context — the page-level one opened the same dialog with empty fields)

**Kept:**
- Products page header "Register Item" (its proper home)
- Stock page row-level "Stock In" button (full product+warehouse context pre-filled)
- Products page row-level green ↑ Stock In icon (later removed in Task 8)

Added a small helper subtitle under Stock page title: *"Use the row-level Stock In button below, or open the Stock In page in the sidebar for multi-item receipts."*

### Task 8 — UX Redundancy Cleanup (Products Page Row Icon)
**User challenged the green ↑ Stock In icon on every Products page row. Removed it** by the same single-responsibility logic — Products page is catalog CRUD only, stock-in is a stock operation.

**Result:** Products page row actions = Edit + Delete only (pure catalog CRUD). All stock-in consolidated to:
1. Stock page → row "Stock In" button (quick single-item, existing row)
2. Stock In nav page → "New Receipt" (multi-item receipt with supplier attribution)

---

## 3. The Three NEW Changes Requested (Current Task)

The user requested these three coordinated changes. **All three are baked into the rebuilt backend (schema + db.ts + API routes). The frontend is not yet rebuilt.**

### Change 1: Remove the Batches page entirely
**Rationale (from discussion):** The old `Batch`/`BatchEntry` models were a near-duplicate of `StockInRecorder`/`StockInItem` — same purpose, same line-item fields, same stock-increment behavior. Worse, `Batch.remove` had a broken delete that left orphaned stock-in. And the name "Batch" promised lot-tracking capability (expiry dates, FEFO picking, recalls) that the implementation never delivered.

**Done in rebuild:**
- NO `Batch` or `BatchEntry` models in schema
- NO `db.batches` in domain layer
- NO `/api/batches` routes
- NO "Batches" nav item or page section in frontend (frontend not yet built, but the contract is clear)

### Change 2: Real lot-tracking
**User's exact requirement:** *"every stock-in should be considered as a new batch of that item, even when registering the product if it has the initial amount not 0, there should be an icon in the row of an item in stock to see its batches with pagination"*

**Done in rebuild:**
- New `Lot` model in schema with fields: `lotNumber` (unique, auto-generated `LOT-YYYY-NNNN`), `quantity` (original received), `remainingQty` (current remaining, FIFO-decremented on stock-out), `unit`, `costPerUnit`, `supplierName`, `source` (`stock_in` | `register_item` | `adjustment`), `sourceRef`, `notes`, `receivedDate`, `closedAt`
- **Every stock-in path creates a Lot:**
  - `db.stock.stockIn()` (quick stock-in from Stock page row) → creates Lot with source `adjustment`
  - `db.stockIn.addItem()` (multi-item receipt) → creates Lot with source `stock_in`, sourceRef `${recorderCode}-${itemId}`
  - `db.registerItem()` (single product registration with initial stock) → creates Lot with source `register_item`
  - `db.registerItems()` (bulk product registration, new Products tab) → creates Lot per item with quantity > 0
  - `db.stock.adjust()` (manual override) → if increasing, creates Lot for the difference
- **FIFO lot deduction on stock-out:** `deductLotsFIFO()` helper in db.ts — on every `stockOut.addItem`, decrements `remainingQty` from oldest open lot first, sets `closedAt` when lot hits 0
- **Lot reversal on stock-in delete:** `db.stockIn.removeItem` and `db.stockIn.remove` reverse the lot (delete if untouched, reduce quantity if partially consumed)
- New `db.lots` domain methods: `findByProductWarehouse(ctx, productId, warehouseId)`, `findByProduct(ctx, productId)`, `findMany(ctx, filters)`
- New `/api/lots` route (GET with `?productId=X&warehouseId=Y` query params)
- **Frontend (NOT yet built):** Stock page row needs a "View Lots" icon (Layers icon) that opens a paginated dialog showing all lots for that product×warehouse, with columns: Lot Number, Quantity, Remaining, Cost/Unit, Supplier, Source, Received Date, Status (Open/Closed)

### Change 3: Multi-item product recorder + Products page two tabs
**User's exact requirement:** *"i want the multi-item recorder (mirrors Stock Out) for registering new products, in the products page make them in two tabs one that shows the list and other for adding new product"*

**Done in rebuild:**
- `db.registerItems(ctx, warehouseId, items[])` domain method — bulk-creates products + initial stock + Lots in one transaction
- New `/api/products/register` POST route
- **Frontend (NOT yet built):** Products page needs two tabs:
  - **Tab 1 "List":** the existing products table (with Task 8 cleanup — Edit + Delete only, no Stock In icon)
  - **Tab 2 "New Products":** multi-item recorder mirroring the Stock Out UX — select a warehouse, add multiple product rows (name, SKU, category, unit, price, cost, reorder level, initial quantity), submit all at once. Each product with quantity > 0 gets a Lot automatically.

---

## 4. Rebuild Status (As Of End Of This Session)

The workspace was reset to default Next.js boilerplate. A full rebuild from the worklog was started. **The backend is essentially complete; the frontend is not yet rebuilt.**

### ✅ Complete (written this session, verified)
| File | Lines | Description |
|---|---|---|
| `prisma/schema.prisma` | 396 | Full multi-tenant schema with `Lot` model, NO `Batch` model. 16 models: Enterprise, Branch, Warehouse, User, Category, Supplier, Product, Stock, Lot, Order, OrderItem, StockInRecorder, StockInItem, StockOutRecorder, StockOutItem, AuditLog, Feature |
| `src/lib/db.ts` | 1106 | Complete domain layer. `db.{enterprises, branches, warehouses, users, categories, suppliers, products, stock, lots, stockIn, stockOut, orders, audit, features, dashboard, analytics, registerItem, registerItems}`. Real lot-tracking wired into every stock-in path. FIFO deduction on stock-out. |
| `src/lib/prisma.ts` | 22 | PrismaClient singleton with `PRISMA_CLIENT_VERSION` hot-reload fix |
| `src/lib/rbac.ts` | 79 | 4-tier RBAC permission matrix |
| `src/lib/auth-store.ts` | 52 | Cookie-based session auth, `getAuthContextFromHeaders`, `makeSessionCookie`, `clearSessionCookie` |
| `src/lib/api.ts` | 40 | Client-side `apiFetch` + `makeCrud` |
| `src/lib/i18n.ts` | 185 | 5-locale i18n (EN, AM, OM, AR, FR) |
| **35 API route files** | — | auth, dashboard, analytics, enterprises(+[id]), branches(+[id]), warehouses(+[id]), users(+[id]), products(+[id]+register), categories(+[id]), suppliers(+[id]), stock, **lots**, stock-in(+[id]+item+item/[itemId]), stock-out(+[id]+item+item/[itemId]), orders(+[id]), audit, features(+[id]), ai-assistant. All use Next.js 16 async params. |

### ⏳ Needs Verification
| File | Status |
|---|---|
| `prisma/seed.ts` | The backend subagent was asked to create this but the call returned an error before confirmation. **Check if it exists; if not, create it.** Should seed 3 enterprises, 5 branches, 6 warehouses, 11 users (superadmin/admin123 + role-based users per enterprise), 5 categories, 5 suppliers, 7 products, 10 stock rows, 2 StockInRecorders (with items → creates Lots), 2 StockOutRecorders (with items → FIFO lot deduction), 3 orders, audit logs, 5 features. |

### ❌ Not Yet Done
| File | Status |
|---|---|
| `src/app/page.tsx` | **Still default 30-line boilerplate.** This is the big remaining piece — the full single-page IMS UI. |
| `src/app/layout.tsx` | Needs to set up fonts, metadata, Toaster, theme provider |

### Frontend Requirements for `src/app/page.tsx` (the rebuild contract)

The frontend must be a single-page app (`'use client'`) with these sections, gated by RBAC permissions:

**Login screen** (when not authenticated): username/password form, 4 quick-login buttons (Super Admin, Enterprise Admin, Branch Admin, Warehouse Admin), 5 language-switcher buttons.

**Sidebar nav** (when authenticated): Dashboard, Enterprises, Branches, Warehouses, Users, Products, Categories, Stock, Orders, Suppliers, Audit Log, Stock In, Stock Out, Features. Dark mode toggle, language switcher, logout.

**Page sections** (all must be built):
1. **Dashboard** — stat cards (Total Products, Stock Value, Low Stock, Orders, Stock In, Stock Out, Total Lots, Open Lots) + 4 Recharts charts (stock by warehouse bar, stock by category pie, top products, recent activity feed)
2. **Enterprises** — table + CRUD dialog (super_admin only)
3. **Branches** — table + CRUD dialog
4. **Warehouses** — table + CRUD dialog
5. **Users** — table + CRUD dialog (with role dropdown, enterprise/branch/warehouse assignment, password field)
6. **Products** — **TWO TABS** (shadcn Tabs component):
   - Tab 1 "List": table with columns Product/Category/Price/Cost/In Stock/Reorder/Status/Actions(Edit+Delete only — Task 8 cleanup, NO Stock In icon). Search + pagination.
   - Tab 2 "New Products": multi-item recorder — warehouse select, add multiple product rows (name, SKU, category, unit, price, cost, reorder, initial qty), submit all via POST /api/products/register
7. **Categories** — table + CRUD dialog
8. **Stock** — table with columns Product/Warehouse/Quantity/Value/Status/Actions. **Each row has a "View Lots" icon (Layers) that opens a paginated dialog showing all Lots for that product×warehouse** (Lot Number, Quantity, Remaining, Cost/Unit, Supplier, Source, Received Date, Status). Search + pagination. Header has helper subtitle (Task 7 cleanup, NO Register Item or page-level Stock In button).
9. **Orders** — table + CRUD dialog with order items
10. **Suppliers** — table + CRUD dialog
11. **Stock In** — multi-item recorder page (emerald theme): filters, paginated recorder list with expandable cards, items table, Add-Items section (Pick mode + Table mode), Submit pending, Print receipt
12. **Stock Out** — multi-item recorder page (orange theme): same structure as Stock In
13. **Audit Log** — table (read-only) with user + action + entity + details + timestamp
14. **Features** — feature flag toggle list
15. **AI Assistant** — floating chat widget (bottom-right) using /api/ai-assistant, can ask questions about inventory

**Shared components:** Dialog (for CRUD forms), Pager (pagination), CustomDatePicker, SectionHeader, IconLabel. All shadcn/ui components are in `src/components/ui/`.

**API contract:** Frontend uses `apiFetch('/api/...')` and `makeCrud('/api/...')` from `src/lib/api.ts`. All requests use relative paths, `credentials: 'include'`.

---

## 5. Key Technical Decisions To Preserve

1. **Numeric IDs:** All models use `Int @id @default(autoincrement())` — the frontend expects numeric IDs everywhere.
2. **Stable `db` interface:** API routes call `db.products.findMany(ctx)` etc. — they never call Prisma directly. This isolates tenant scoping in one place.
3. **Next.js 16 async params:** ALL `[id]/route.ts` files must use `params: Promise<{ id: string }>` + `const { id } = await params`. The old sync signature causes HTTP 500.
4. **Prisma client hot-reload:** `src/lib/prisma.ts` has a `PRISMA_CLIENT_VERSION` stamp. After schema changes + `db:push`, bump the version string so the dev server picks up the regenerated PrismaClient.
5. **z-ai-web-dev-sdk is backend-only:** Used in `/api/ai-assistant/route.ts`. Never import in client components.
6. **Error mapping in routes:** `FORBIDDEN` → 403, `Not found` / findById-null → 404, other errors → 500.
7. **Lot lifecycle:** `remainingQty` starts at `quantity`, FIFO-decremented on stock-out, `closedAt` set when it hits 0. Lot reversal on stock-in delete: delete if `remainingQty === quantity` (untouched), else reduce both by the item quantity.
8. **No `Batch` model:** Removed entirely. All lot-tracking is via the `Lot` model. Do NOT re-add `Batch`.
9. **Products page = catalog CRUD only:** Row actions are Edit + Delete (no Stock In icon — Task 8). All stock-in goes through Stock page row button or Stock In nav page.
10. **Stock page header = no action buttons:** Just title + helper subtitle + search (Task 7). Row-level Stock In + View Lots icons are the entry points.

---

## 6. How To Pick Up In A New Chat

1. **Read this file first** — it's the full context.
2. **Read `/home/z/my-project/worklog.md`** — has the detailed narrative of Tasks 1-8.
3. **Check current state:**
   - `ls /home/z/my-project/src/app/api/` — should show 35 route files
   - `wc -l /home/z/my-project/src/lib/db.ts` — should be ~1106 lines
   - `wc -l /home/z/my-project/src/app/page.tsx` — if 30, frontend still needs building
4. **If frontend not built:** Build `src/app/page.tsx` per the contract in section 4 above. It's a large single-file SPA (~1600 lines when done). Use shadcn/ui components from `src/components/ui/`.
5. **Verify seed exists:** `ls /home/z/my-project/prisma/seed.ts`. If missing, create it per section 4.
6. **Run `bun run db:push`** to ensure schema is synced.
7. **Run the seed** to populate demo data.
8. **Start dev server:** `cd /home/z/my-project && bun run dev` (runs on port 3000, logs to dev.log).
9. **Browser-verify** with Agent Browser: login as superadmin/admin123, check each page works, verify Lots dialog on Stock page, verify Products two-tab, verify no Batches page exists.
10. **Package as tar** and deliver to user: `tar -cf /home/z/my-project/ims-complete.tar -C /home/z/my-project src prisma package.json bun.lock tsconfig.json next.config.ts tailwind.config.ts postcss.config.mjs components.json eslint.config.mjs .env Caddyfile` (exclude node_modules, .next, db/custom.db).

---

## 7. Demo Login Credentials (From Seed)

| Username | Password | Role | Scope |
|---|---|---|---|
| superadmin | admin123 | super_admin | All |
| (enterprise_admin users) | admin123 | enterprise_admin | Per enterprise |
| (branch_admin users) | admin123 | branch_admin | Per branch |
| (warehouse_admin users) | admin123 | warehouse_admin | Per warehouse |

The seed should create these users with bcrypt-hashed passwords (`bcrypt.hash('admin123', 10)`).

---

**End of handoff. The next chat can pick up from "Check current state" in section 6.**
