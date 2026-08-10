# IMS Rebuild Worklog

This worklog tracks the rebuild of the Multi-Tenant Enterprise IMS per the SESSION_HANDOFF.md contract.

## Task 0 — Setup (Main)
- Inspected current project state: Next.js 16 boilerplate with Prisma + shadcn/ui installed
- Extracted original tar to /tmp/ims_extract for reference (pre-rebuild IMS with mysql2/JSON persistence, batches)
- Installed bcryptjs for password hashing
- Confirmed all dependencies present: next-themes, recharts, zustand, z-ai-web-dev-sdk, @tanstack/react-query

## Reference files (in /tmp/ims_extract)
- src/app/page.tsx (1264 lines) — original SPA UI (pre-rebuild, has Batches page, no Lots, no two-tab Products)
- src/lib/db.ts (1244 lines) — original domain layer (mysql2/JSON, has batches, no lots)
- src/lib/i18n.ts (367 lines), rbac.ts (231 lines), auth-store.ts (60 lines), api.ts (38 lines) — reusable as-is

