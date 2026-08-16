# Task 6 — Permission Manager UI Agent

## Task
Add two UI features to `/home/z/my-project/src/app/page.tsx`:

1. **Permission Manager page** (for all non-super_admin users with `permissions:view`):
   - "My Permissions" — grid of permission groups with check/X icons + amber "D" badge for delegatable
   - "Delegatable Permissions" summary card
   - "Manage Subordinates" section (only for users with `permissions:manage` AND not warehouse_admin) with an Edit Permissions dialog (Use + Delegate switches per ability; Delegate disabled if granter can't delegate that ability)

2. **Enterprise super_admin management** — enhance the Enterprises page card with:
   - Inline active toggle (Switch) gated by `enterprises:toggle_active`
   - Clickable limits badge that opens an edit dialog (gated by `enterprises:set_limits`)
   - "Create Admin" button + dialog (gated by `enterprises:manage_admin`)
   - "Reset Admin Password" button + dialog (gated by `enterprises:reset_admin`)
   - "Permission Manager" link button

## API endpoints used (already implemented by previous agents)
- `GET /api/permissions` → `{ isSuperAdmin, permissions[], delegatable[], catalog[], groups[], raw[] }`
- `GET /api/permissions/subordinates` → `[{ id, username, fullName, role, ..., permissions[], permCount, delegateCount }]`
- `POST /api/permissions/grant` `{ targetUserId, ability, canUse?, canDelegate? }`
- `POST /api/permissions/revoke` `{ targetUserId, ability }`
- `POST /api/enterprises/[id]/create-admin` `{ username, fullName, email?, password? }`
- `POST /api/enterprises/[id]/reset-admin` `{ newPassword? }`
- `PUT /api/enterprises/[id]` `{ maxBranches?, maxWarehouses?, maxUsers?, isActive?, ... }`

## Key implementation decisions

### Permission type cast (`as any`)
`src/lib/rbac.ts`'s `Permission` union type doesn't include the new DB-backed abilities
(`permissions:view`, `permissions:manage`, `enterprises:set_limits`, etc.). To call
`hasPermission(role!, 'permissions:manage')` without TS errors, I cast the literal as
`as any`. The function itself works fine at runtime — it checks `useAuthStore.getState().permissions.has(perm)`
which is a `Set<string>` and accepts any string.

### useEffect for permission page load
Added a separate useEffect (not in loadData) because:
- The data is only needed when on the permissions page (lazy load)
- It tolerates 403 from /subordinates (warehouse_admin gets 403 — that's fine, just stays [])

### Granter's delegation check
For the Permission Editor dialog, the granter's ability to delegate each perm is read from
`permData.delegatable` (their own /api/permissions response). If they can't delegate, the
Delegate Switch is `disabled` and wrapped in a Tooltip "You cannot delegate this permission".
The Use switch is always editable.

### State preservation on toggle
When toggling canUse:
- If turning ON → grant with `canUse: true, canDelegate: <existing>`
- If turning OFF but canDelegate is on → grant with `canUse: false, canDelegate: true` (preserve)
- If turning OFF and canDelegate is off → revoke (delete the row entirely)

Same logic mirrored for toggling canDelegate.

### Refresh after grant/revoke
After each grant/revoke call, I re-fetch /api/permissions/subordinates to refresh the
`subordinates` state array AND update the `permEditDlg.target` object so the dialog
reflects the new state immediately.

## Files modified
- `/home/z/my-project/src/app/page.tsx` (+329 lines, 5281 → 5610)
  - Added 7 state vars after `dlgEdit` (line 863)
  - Added useEffect for permissions page data load (line 1475)
  - Added Permission Manager page render before `return null` (line 3654)
  - Replaced Enterprises page card with enhanced version (line 1744)
  - Added 4 new Dialogs after the attLink dialog (line 5407)

## Lint status
`bun run lint` exits 0 (only a BABEL note about file size >500KB, not an error).
Dev server compiles cleanly (verified in dev.log).

## What I did NOT touch
- Any backend file (no API route changes)
- Any other component file (no new components created)
- Any existing dialog (all 11 existing Dialogs untouched)
- The `loadData` function (kept the 17-endpoint fetch as-is, added separate useEffect for permission page)
