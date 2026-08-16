/**
 * Auth Store — Zustand-powered client-side auth state
 * Manages current user session and provides AuthContext for API calls
 */

import { create } from 'zustand'
import type { RoleLevel } from './rbac'

export interface AuthState {
  userId: number | null
  username: string
  fullName: string
  email: string
  role: RoleLevel | null
  enterpriseId: number | null
  branchId: number | null
  warehouseId: number | null
  isActive: boolean
  mustResetPassword: boolean
  isLoggedIn: boolean
  /** DB-backed permissions the user can USE (loaded from /api/permissions) */
  permissions: Set<string>
  /** DB-backed permissions the user can DELEGATE to subordinates */
  delegatable: Set<string>
}

export interface AuthActions {
  login: (user: {
    id: number; username: string; fullName: string; email: string
    role: RoleLevel; enterpriseId: number | null; branchId: number | null
    warehouseId: number | null; isActive: boolean; mustResetPassword: boolean
  }) => void
  setPermissions: (permissions: string[], delegatable: string[]) => void
  logout: () => void
  getAuthHeaders: () => Record<string, string>
}

const initialState: AuthState = {
  userId: null, username: '', fullName: '', email: '',
  role: null, enterpriseId: null, branchId: null, warehouseId: null,
  isActive: false, mustResetPassword: false, isLoggedIn: false,
  permissions: new Set<string>(),
  delegatable: new Set<string>(),
}

export const useAuthStore = create<AuthState & AuthActions>()((set, get) => ({
  ...initialState,

  login: (user) => set({
    userId: user.id, username: user.username, fullName: user.fullName,
    email: user.email, role: user.role, enterpriseId: user.enterpriseId,
    branchId: user.branchId, warehouseId: user.warehouseId,
    isActive: user.isActive, mustResetPassword: user.mustResetPassword, isLoggedIn: true,
  }),

  setPermissions: (permissions, delegatable) => set({
    permissions: new Set(permissions),
    delegatable: new Set(delegatable),
  }),

  logout: () => set(initialState),

  getAuthHeaders: () => {
    const s = get()
    return {
      'x-user-id': String(s.userId || ''),
      'x-user-role': s.role || '',
      'x-enterprise-id': String(s.enterpriseId || ''),
      'x-branch-id': String(s.branchId || ''),
      'x-warehouse-id': String(s.warehouseId || ''),
    }
  },
}))
