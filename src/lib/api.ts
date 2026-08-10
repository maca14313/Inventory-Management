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

/** Parse AuthContext from request headers (server-side) */
export function getAuthContextFromHeaders(headers: Headers) {
  return {
    userId: parseInt(headers.get('x-user-id') || '0', 10),
    role: (headers.get('x-user-role') || 'warehouse_admin') as 'super_admin' | 'enterprise_admin' | 'branch_admin' | 'warehouse_admin',
    enterpriseId: headers.get('x-enterprise-id') && headers.get('x-enterprise-id') !== 'null' ? parseInt(headers.get('x-enterprise-id')!, 10) : null,
    branchId: headers.get('x-branch-id') && headers.get('x-branch-id') !== 'null' ? parseInt(headers.get('x-branch-id')!, 10) : null,
    warehouseId: headers.get('x-warehouse-id') && headers.get('x-warehouse-id') !== 'null' ? parseInt(headers.get('x-warehouse-id')!, 10) : null,
  }
}
