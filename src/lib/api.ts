/**
 * API Helper — typed fetch wrapper with auth context headers
 */

import { useAuthStore } from './auth-store'

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || ''

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = useAuthStore.getState().getAuthHeaders()
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `API Error ${res.status}`)
  }
  return res.json()
}

/** Parse AuthContext from request headers (server-side).
 *
 *  Two sources are consulted, in this order:
 *   1. The custom `x-user-id` / `x-user-role` / `x-enterprise-id` / `x-branch-id`
 *      / `x-warehouse-id` request headers — these are appended by the client-side
 *      `apiFetch` wrapper (see src/lib/api.ts above) and work for all `fetch()` calls.
 *   2. The `ims-session` HTTP-only cookie (set by POST /api/auth) — this is the
 *      ONLY way to authenticate requests that the browser issues directly without
 *      going through `fetch()`, e.g. `<img src="/api/attachments/.../download">`
 *      image previews or `<a href="...">` download links. The browser cannot
 *      attach custom headers to such requests, so the cookie must be consulted.
 *
 *  Headers take precedence over the cookie when both are present, because the
 *  headers are always populated by `apiFetch` for explicit API calls (which is
 *  the more recent + intentional source). The cookie is only consulted when the
 *  `x-user-id` header is missing or empty.
 */
const SESSION_COOKIE_NAME = 'ims-session'

function parseSessionCookie(headers: Headers): {
  userId: number; role: 'super_admin' | 'enterprise_admin' | 'branch_admin' | 'warehouse_admin'
  enterpriseId: number | null; branchId: number | null; warehouseId: number | null
} | null {
  // The Cookie header looks like: "ims-session={...url-encoded-json...}; other=val"
  const cookieHeader = headers.get('cookie') || ''
  if (!cookieHeader) return null
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const i = c.indexOf('=')
      const k = c.slice(0, i).trim()
      const v = i >= 0 ? c.slice(i + 1).trim() : ''
      return [k, v]
    })
  )
  const raw = cookies[SESSION_COOKIE_NAME]
  if (!raw) return null
  let user: any
  try { user = JSON.parse(decodeURIComponent(raw)) } catch { return null }
  if (!user || typeof user !== 'object') return null
  const role = (user.role || 'warehouse_admin') as 'super_admin' | 'enterprise_admin' | 'branch_admin' | 'warehouse_admin'
  const parseId = (v: any): number | null => {
    if (v === null || v === undefined || v === '' || v === 'null') return null
    const n = parseInt(String(v), 10)
    return Number.isNaN(n) ? null : n
  }
  return {
    userId: parseId(user.id) ?? 0,
    role,
    enterpriseId: parseId(user.enterpriseId),
    branchId: parseId(user.branchId),
    warehouseId: parseId(user.warehouseId),
  }
}

export function getAuthContextFromHeaders(headers: Headers) {
  const headerUserId = parseInt(headers.get('x-user-id') || '0', 10)
  // When the x-user-id header is present (i.e. this is a `fetch()` call from the
  // client with explicit auth headers), use the headers verbatim — that path is
  // always the most up-to-date because the client Zustand store populates it
  // directly from the logged-in user object.
  if (headerUserId > 0) {
    return {
      userId: headerUserId,
      role: (headers.get('x-user-role') || 'warehouse_admin') as 'super_admin' | 'enterprise_admin' | 'branch_admin' | 'warehouse_admin',
      enterpriseId: headers.get('x-enterprise-id') && headers.get('x-enterprise-id') !== 'null' ? parseInt(headers.get('x-enterprise-id')!, 10) : null,
      branchId: headers.get('x-branch-id') && headers.get('x-branch-id') !== 'null' ? parseInt(headers.get('x-branch-id')!, 10) : null,
      warehouseId: headers.get('x-warehouse-id') && headers.get('x-warehouse-id') !== 'null' ? parseInt(headers.get('x-warehouse-id')!, 10) : null,
    }
  }
  // No explicit headers — this is a browser-issued request (e.g. <img src>).
  // Fall back to the ims-session cookie so image previews + download links work.
  const fromCookie = parseSessionCookie(headers)
  if (fromCookie) return fromCookie
  // Last resort: anonymous warehouse_admin context (preserves prior behavior
  // for any caller that genuinely has no auth — they'll just be denied by the
  // tenant-isolation checks in db.ts).
  return {
    userId: 0,
    role: 'warehouse_admin' as const,
    enterpriseId: null,
    branchId: null,
    warehouseId: null,
  }
}
