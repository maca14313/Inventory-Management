'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  LayoutDashboard, Package, Warehouse as WHIcon, Users, ShoppingCart, Tag,
  Plus, Trash2, Pencil, Search, AlertTriangle, TrendingUp,
  Box, Truck, Building2, GitBranch, Shield, Globe, LogOut, Loader2,
  Key, Lock, ToggleLeft, ToggleRight, Menu, X, ChevronDown, ChevronRight,
  ClipboardList, ArrowUpFromLine, RotateCcw, Calendar, Check, Eye, LayoutGrid, List,
  Sun, Moon, Phone, Mail, MapPin, FileText, Hash, ChevronLeft, Sparkles, ChevronRight as ChevronRightIcon, SkipBack, SkipForward, Printer, Filter, CalendarDays,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { t, type Locale, locales } from '@/lib/i18n'
import {
  type RoleLevel, type Permission, type EnterpriseAbility,
  ROLE_HIERARCHY, ROLE_LABELS, ROLE_DESCRIPTIONS,
  ALL_ABILITIES, ABILITY_LABELS,
  PERMISSION_GROUPS, MANAGEABLE_ROLES,
  hasPermission, canManageRole, getPermissions, getNavItemsForRole,
} from '@/lib/rbac'
import { useAuthStore } from '@/lib/auth-store'
import { apiFetch } from '@/lib/api'
import { MEASUREMENTS } from '@/lib/db'

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || ''
const SORTED_MEASUREMENTS = [...MEASUREMENTS].sort((a, b) => a.localeCompare(b))

const ICONS: Record<string, React.ComponentType<any>> = {
  LayoutDashboard, Package, Warehouse: WHIcon, Users, ShoppingCart, Tag,
  Box, Truck, Building2, GitBranch, Shield, Globe, ClipboardList, ArrowUpFromLine,
}

interface Enterprise { id: number; name: string; code: string; contactEmail: string; contactPhone: string; address: string; isActive: boolean; maxBranches: number; maxWarehouses: number; maxUsers: number }
interface Branch { id: number; enterpriseId: number; name: string; code: string; location: string; managerName: string; managerEmail: string; isActive: boolean }
interface Warehouse { id: number; enterpriseId: number; branchId: number; name: string; code: string; location: string; capacity: number; managerName: string; isActive: boolean }
interface User { id: number; enterpriseId: number | null; branchId: number | null; warehouseId: number | null; username: string; email: string; fullName: string; role: RoleLevel; isActive: boolean }
interface Category { id: number; enterpriseId: number; name: string; description: string }
interface Supplier { id: number; enterpriseId: number; name: string; contactPerson: string; email: string; phone: string; address: string }
interface Product { id: number; enterpriseId: number; name: string; sku: string; description: string; categoryId: number | null; price: number; cost: number; unit: string; reorderLevel: number; isActive: boolean }
interface StockItem { id: number; productId: number; warehouseId: number; quantity: number }
interface Order { id: number; enterpriseId: number; type: 'purchase' | 'sales'; supplierId: number | null; warehouseId: number | null; status: string; totalAmount: number; notes: string; createdBy: number | null }
interface AuditEntry { id: number; userId: number | null; enterpriseId: number | null; action: string; entity: string; entityId: number | null; details: string; createdAt: string }
interface Feature { id: number; enterpriseId: number; feature: string; enabled: boolean }
interface BatchEntry { id: number; batchId: number; productId: number; warehouseId: number; quantity: number; unit: string; costPerUnit: number; notes: string }
interface Batch { id: number; enterpriseId: number; warehouseId: number; batchCode: string; supplierId: number | null; personName: string; personPhone: string; personEmail: string; notes: string; status: string; entries: BatchEntry[] }
interface StockOutItem { id: number; recorderId: number; productId: number; warehouseId: number; quantity: number; unit: string; isReturnable: boolean; returnDeadline: string | null; notes: string }
interface StockOutRecorder { id: number; enterpriseId: number; warehouseId: number; recorderCode: string; personName: string; personPhone: string; personEmail: string; personAddress: string; notes: string; status: string; items: StockOutItem[] }
interface DashboardStats { enterpriseCount: number; branchCount: number; warehouseCount: number; userCount: number; productCount: number; orderCount: number; pendingOrderCount: number; totalStockValue: number; lowStockProducts: { id: number; name: string; sku: string; reorderLevel: number; totalQty: number }[] }

// Custom Alphabetical Month-Year Date Picker
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
function CustomDatePicker({ value, onChange, compact }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const parsed = value ? new Date(value + 'T00:00:00') : null

  const years = Array.from({ length: 10 }, (_, i) => today.getFullYear() - 2 + i)
  // Months sorted alphabetically
  const alphaMonths = MONTHS.map((m, i) => ({ name: m, index: i })).sort((a, b) => a.name.localeCompare(b.name))

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const selectDate = (d: number) => {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    onChange(iso)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 rounded-lg border border-input bg-background text-foreground hover:bg-accent transition ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'}`}>
        <Calendar className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-muted-foreground shrink-0`} />
        {parsed ? parsed.toLocaleDateString() : <span className="text-muted-foreground">Pick a date</span>}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-64 rounded-xl border bg-popover p-3 shadow-xl">
          <div className="flex gap-2 mb-3">
            <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-48">
                {alphaMonths.map(m => <SelectItem key={m.index} value={String(m.index)}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(d => {
              const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
              const isSelected = value === iso
              return <button key={d} onClick={() => selectDate(d)}
                className={`h-7 w-7 rounded-md text-xs font-medium transition ${isSelected ? 'bg-blue-600 text-white' : 'hover:bg-accent text-foreground'}`}>{d}</button>
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helper: icon-prefixed label
function IconLabel({ icon: Icon, children }: { icon: React.ComponentType<any>; children: React.ReactNode }) {
  return <Label className="text-xs font-medium flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-muted-foreground" />{children}</Label>
}

// ─── Helper: section header
function SectionHeader({ icon: Icon, children }: { icon: React.ComponentType<any>; children: React.ReactNode }) {
  return <div className="flex items-center gap-2 pb-1"><Icon className="w-4 h-4 text-blue-500" /><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{children}</span></div>
}

// ─── Pagination helper
function Pager({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-[11px] text-muted-foreground">Page {page} of {totalPages}</span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(1)} className="h-7 w-7 p-0"><SkipBack className="w-3 h-3" /></Button>
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="h-7 w-7 p-0"><ChevronLeft className="w-3 h-3" /></Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="h-7 w-7 p-0"><ChevronRight className="w-3 h-3" /></Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} className="h-7 w-7 p-0"><SkipForward className="w-3 h-3" /></Button>
      </div>
    </div>
  )
}

export default function IMSApp() {
  const auth = useAuthStore()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [locale, setLocale] = useState<Locale>('en')
  const [page, setPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loginUser, setLoginUser] = useState('superadmin')
  const [loginPass, setLoginPass] = useState('admin123')
  const [loginLoading, setLoginLoading] = useState(false)

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stockData, setStockData] = useState<StockItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [auditData, setAuditData] = useState<AuditEntry[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [batchData, setBatchData] = useState<Batch[]>([])
  const [stockOutData, setStockOutData] = useState<StockOutRecorder[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(false)

  const [dlgOpen, setDlgOpen] = useState(false)
  const [dlgType, setDlgType] = useState('')
  const [dlgData, setDlgData] = useState<any>({})
  const [dlgEdit, setDlgEdit] = useState<any>(null)
  const [stockOutMode, setStockOutMode] = useState<'pic' | 'table'>('pic')
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null)
  const [expandedOut, setExpandedOut] = useState<number | null>(null)
  const [expandingOutId, setExpandingOutId] = useState<number | null>(null)

  // Stock Out Pick mode: search + per-product inputs
  const [stockOutSearch, setStockOutSearch] = useState('')
  const [stockOutPickInputs, setStockOutPickInputs] = useState<Record<string, { qty: number; unit: string; isReturnable: boolean; returnDeadline: string }>>({})
  // Stock Out Table mode: per-product row inputs (keyed by productId)
  const [stockOutTableRowInputs, setStockOutTableRowInputs] = useState<Record<string, { qty: number; unit: string; isReturnable: boolean; returnDeadline: string }>>({})
  // Pagination
  const [stockOutItemPage, setStockOutItemPage] = useState(1)
  const [stockOutProductPage, setStockOutProductPage] = useState(1)
  const STOCK_OUT_ITEMS_PER_PAGE = 10
  const STOCK_OUT_PRODUCTS_PER_PAGE = 8
  // Loading states for buttons
  const [submittingRecorder, setSubmittingRecorder] = useState<number | null>(null)
  const [addingItem, setAddingItem] = useState(false)
  const [dlgSubmitting, setDlgSubmitting] = useState(false)
  // Pick mode: pagination inside select dropdown
  const [stockOutPickSelectPage, setStockOutPickSelectPage] = useState(1)
  const STOCK_OUT_PICK_SELECT_PER_PAGE = 20
  // Stock Out recorder list filters & pagination
  const [stockOutRecPage, setStockOutRecPage] = useState(1)
  const STOCK_OUT_REC_PER_PAGE = 5
  const [stockOutFilterDateFrom, setStockOutFilterDateFrom] = useState('')
  const [stockOutFilterDateTo, setStockOutFilterDateTo] = useState('')
  const [stockOutFilterStatus, setStockOutFilterStatus] = useState('')
  const [stockOutFilterPerson, setStockOutFilterPerson] = useState('')
  // Pending items per recorder (local array before API submission)
  const [pendingStockOutItems, setPendingStockOutItems] = useState<Record<number, { tempId: number; productId: number; warehouseId: number; quantity: number; unit: string; isReturnable: boolean; returnDeadline: string | null; notes: string }[]>>({})
  let _pendingTempId = 0
  const getNextTempId = () => --_pendingTempId
  const getPendingItems = (recorderId: number) => pendingStockOutItems[recorderId] || []
  const addPendingItem = (recorderId: number, item: Omit<typeof pendingStockOutItems extends Record<number, (infer T)[]> ? T : never, 'tempId'>) => {
    setPendingStockOutItems(prev => {
      const existing = (prev[recorderId] || [])
      const dupIdx = existing.findIndex(i => i.productId === item.productId && i.unit === item.unit && i.warehouseId === item.warehouseId)
      if (dupIdx >= 0) {
        // Sum up quantity for same product+unit+warehouse
        const updated = [...existing]
        updated[dupIdx] = { ...updated[dupIdx], quantity: updated[dupIdx].quantity + item.quantity }
        return { ...prev, [recorderId]: updated }
      }
      return { ...prev, [recorderId]: [...existing, { ...item, tempId: Date.now() + Math.random() }] }
    })
  }
  const removePendingItem = (recorderId: number, tempId: number) => {
    setPendingStockOutItems(prev => ({
      ...prev,
      [recorderId]: (prev[recorderId] || []).filter(i => i.tempId !== tempId)
    }))
  }
  const clearPendingItems = (recorderId: number) => {
    setPendingStockOutItems(prev => ({ ...prev, [recorderId]: [] }))
  }
  // Submit all pending items for a recorder to the API
  const submitPendingItems = async (recorderId: number, enterpriseId: number) => {
    const items = pendingStockOutItems[recorderId] || []
    if (items.length === 0) { toast({ title: 'No items to submit', variant: 'destructive' }); return }
    setSubmittingRecorder(recorderId)
    let submittedCount = 0
    let lastError = ''
    try {
      for (const item of items) {
        try {
          await apiFetch(`/stock-out/${recorderId}/item`, {
            method: 'POST',
            body: JSON.stringify({ productId: item.productId, warehouseId: item.warehouseId, quantity: item.quantity, unit: item.unit, isReturnable: item.isReturnable, returnDeadline: item.returnDeadline || null, notes: item.notes || '', enterpriseId })
          })
          submittedCount++
        } catch (e: any) {
          lastError = e.message
          break // Stop on first error - stock may be insufficient for remaining items
        }
      }
      if (submittedCount > 0) {
        toast({ title: `${submittedCount} item(s) added successfully${lastError ? `. Stopped: ${lastError}` : ''}` })
        clearPendingItems(recorderId)
      } else {
        toast({ title: lastError || 'Failed to add items', variant: 'destructive' })
      }
      await loadData(false) // ALWAYS refresh to reflect partial or full changes
    } catch (e: any) { toast({ title: e.message, variant: 'destructive' }); await loadData(false) }
    setSubmittingRecorder(null)
  }
  // Table mode: get/set per-product row input
  const getRowInput = (productId: number) => stockOutTableRowInputs[String(productId)] || { qty: 1, unit: 'pcs', isReturnable: false, returnDeadline: '' }
  const updateRowInput = (productId: number, updates: Partial<{ qty: number; unit: string; isReturnable: boolean; returnDeadline: string }>) => {
    setStockOutTableRowInputs(prev => ({ ...prev, [String(productId)]: { ...((prev[String(productId)]) || { qty: 1, unit: 'pcs', isReturnable: false, returnDeadline: '' }), ...updates } }))
  }
  // Helper: get available stock for a product in a warehouse
  const getAvailableStock = (productId: number, warehouseId: number): number => {
    const s = stockData.find(s => s.productId === productId && s.warehouseId === warehouseId)
    return s ? s.quantity : 0
  }

  const role = auth.role
  const eid = auth.enterpriseId

  const handleLogin = useCallback(async () => {
    setLoginLoading(true)
    try {
      const res = await fetch(`${BASE}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loginUser, password: loginPass }) })
      const data = await res.json()
      if (!res.ok) { toast({ title: data.error || 'Login failed', variant: 'destructive' }); setLoginLoading(false); return }
      auth.login(data); setPage('dashboard'); toast({ title: `Welcome, ${data.fullName}` })
    } catch (e: any) { toast({ title: e.message, variant: 'destructive' }) }
    setLoginLoading(false)
  }, [loginUser, loginPass, auth])

  const loadData = useCallback(async (showGlobalLoading = false) => {
    if (!auth.isLoggedIn) return
    if (showGlobalLoading) setLoading(true)
    try {
      const h = { 'Content-Type': 'application/json', ...auth.getAuthHeaders() }
      const fArr = (url: string) => fetch(`${BASE}/api${url}`, { headers: h }).then(async r => { if (!r.ok) { const err = await r.json().catch(() => ({})); console.error(`API ${url} error:`, err); return [] } return r.json() }).catch((e) => { console.error(`API ${url} fetch error:`, e); return [] })
      const fObj = (url: string, fallback: any = null) => fetch(`${BASE}/api${url}`, { headers: h }).then(async r => { if (!r.ok) { const err = await r.json().catch(() => ({})); console.error(`API ${url} error:`, err); return fallback } return r.json() }).catch((e) => { console.error(`API ${url} fetch error:`, e); return fallback })
      const defaultStats: DashboardStats = { enterpriseCount: 0, branchCount: 0, warehouseCount: 0, userCount: 0, productCount: 0, orderCount: 0, pendingOrderCount: 0, totalStockValue: 0, lowStockProducts: [] }
      const [s, e, b, w, u, c, sup, p, st, o, a, feat, bat, so] = await Promise.all([
        fObj('/dashboard', defaultStats), fArr('/enterprises'), fArr('/branches'), fArr('/warehouses'), fArr('/users'),
        fArr('/categories'), fArr('/suppliers'), fArr('/products'), fArr('/stock'), fArr('/orders'),
        fArr('/audit'), fArr('/features'), fArr('/batches'), fArr('/stock-out'),
      ])
      // Ensure stats is always a proper object with all required fields
      const safeStats: DashboardStats = s && typeof s === 'object' && !Array.isArray(s) ? { ...defaultStats, ...s } : defaultStats
      setStats(safeStats); setEnterprises(Array.isArray(e) ? e : []); setBranches(Array.isArray(b) ? b : []); setWarehouses(Array.isArray(w) ? w : [])
      setAllUsers(Array.isArray(u) ? u : []); setCategories(Array.isArray(c) ? c : []); setSuppliers(Array.isArray(sup) ? sup : []); setProducts(Array.isArray(p) ? p : [])
      setStockData(Array.isArray(st) ? st : []); setOrders(Array.isArray(o) ? o : []); setAuditData(Array.isArray(a) ? a : []); setFeatures(Array.isArray(feat) ? feat : [])
      setBatchData(Array.isArray(bat) ? bat : []); setStockOutData(Array.isArray(so) ? so : [])
    } catch (e: any) { console.error('loadData error:', e) }
    if (showGlobalLoading) setLoading(false)
  }, [auth.isLoggedIn, auth.userId, auth.role, auth.enterpriseId, auth.branchId, auth.warehouseId])

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (auth.isLoggedIn) loadData(true) }, [auth.isLoggedIn, auth.userId])

  const [crudLoading, setCrudLoading] = useState<Set<string>>(new Set())
  const crudKey = (action: string, ep: string) => `${action}:${ep}`
  const isCrudLoading = (action: string, ep: string) => crudLoading.has(crudKey(action, ep))
  const crud = {
    create: async (ep: string, d: any) => { const k = crudKey('create', ep); setCrudLoading(prev => new Set(prev).add(k)); try { await apiFetch(ep, { method: 'POST', body: JSON.stringify(d) }); toast({ title: 'Created successfully' }); await loadData() } catch (e: any) { toast({ title: e.message, variant: 'destructive' }) } finally { setCrudLoading(prev => { const n = new Set(prev); n.delete(k); return n }) } },
    createSilent: async (ep: string, d: any) => { const k = crudKey('create', ep); setCrudLoading(prev => new Set(prev).add(k)); try { await apiFetch(ep, { method: 'POST', body: JSON.stringify(d) }); await loadData() } catch (e: any) { toast({ title: e.message, variant: 'destructive' }); await loadData() } finally { setCrudLoading(prev => { const n = new Set(prev); n.delete(k); return n }) } },
    update: async (ep: string, d: any) => { const k = crudKey('update', ep); setCrudLoading(prev => new Set(prev).add(k)); try { await apiFetch(ep, { method: 'PUT', body: JSON.stringify(d) }); toast({ title: 'Updated successfully' }); await loadData() } catch (e: any) { toast({ title: e.message, variant: 'destructive' }); await loadData() } finally { setCrudLoading(prev => { const n = new Set(prev); n.delete(k); return n }) } },
    remove: async (ep: string) => { const k = crudKey('remove', ep); setCrudLoading(prev => new Set(prev).add(k)); try { await apiFetch(ep, { method: 'DELETE' }); toast({ title: 'Deleted' }); await loadData() } catch (e: any) { toast({ title: e.message, variant: 'destructive' }); await loadData() } finally { setCrudLoading(prev => { const n = new Set(prev); n.delete(k); return n }) } },
  }

  const openCreate = (type: string) => { setDlgType(type); setDlgEdit(null); setDlgData({}); setDlgOpen(true) }
  const openEdit = (type: string, item: any) => { setDlgType(type); setDlgEdit(item); setDlgData({ ...item }); setDlgOpen(true) }

  const fmt = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(n)
  const fmtN = (n: number) => new Intl.NumberFormat(locale).format(n)
  const statusColor = (status: string) => {
    const m: Record<string, string> = {
      received: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
      approved: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
      pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
      shipped: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
      draft: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
      confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
      open: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
      closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
      partial_return: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
      returned: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    }
    return m[status] || 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400'
  }
  const statusBadge = (status: string) => <Badge className={`${statusColor(status)} border-0 text-[11px] font-semibold`}>{status.replace(/_/g, ' ')}</Badge>

  const navItems = getNavItemsForRole(role!).concat([
    { key: 'batches', label: 'Batches', icon: 'ClipboardList', href: '/batches', permission: 'stock:view' as Permission },
    { key: 'stockOut', label: 'Stock Out', icon: 'ArrowUpFromLine', href: '/stock-out', permission: 'orders:view' as Permission },
    { key: 'features', label: 'Features', icon: 'ToggleLeft', href: '/features', permission: 'enterprises:set_features' as Permission },
  ]).filter((v, i, a) => a.findIndex(x => x.key === v.key) === i)

  // ─── LOGIN ──────────────────────────────────────────────
  if (!auth.isLoggedIn) {
    const dir = locales.find(l => l.code === locale)?.dir || 'ltr'
    if (!mounted) return <div suppressHydrationWarning className="min-h-screen bg-background" />
    return (
      <div dir={dir} suppressHydrationWarning className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0">
          <CardHeader className="text-center pb-3">
            <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25"><Box className="w-8 h-8 text-white" /></div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{t(locale, 'loginTitle')}</CardTitle>
            <CardDescription className="text-muted-foreground">{t(locale, 'loginSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1"><Label className="text-sm font-medium">Username</Label><Input value={loginUser} onChange={e => setLoginUser(e.target.value)} className="h-10" /></div>
            <div className="space-y-1"><Label className="text-sm font-medium">{t(locale, 'labelPassword')}</Label><Input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="h-10" /></div>
            <Button onClick={handleLogin} disabled={loginLoading} className="w-full h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25">{loginLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Key className="w-4 h-4 mr-2" />}{t(locale, 'loginButton')}</Button>
            <Separator />
            <div className="space-y-2"><Label className="text-muted-foreground text-xs font-medium">Demo Accounts (password: admin123)</Label>
              <div className="grid grid-cols-1 gap-1.5">{[
                { u: 'superadmin', label: 'Super Admin', desc: 'Full system', color: 'from-purple-500 to-pink-500' },
                { u: 'acmeadmin', label: 'Enterprise Admin', desc: 'Acme Corp', color: 'from-blue-500 to-cyan-500' },
                { u: 'northadmin', label: 'Branch Admin', desc: 'North Division', color: 'from-orange-500 to-amber-500' },
                { u: 'bostonwh', label: 'Warehouse Admin', desc: 'Boston WH', color: 'from-emerald-500 to-teal-500' },
              ].map(d => (
                <button key={d.u} onClick={() => { setLoginUser(d.u); setLoginPass('admin123') }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all text-sm flex items-center gap-3 ${loginUser === d.u ? 'bg-blue-50 border-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30' : 'bg-muted/30 border-transparent hover:bg-muted/60'}`}>
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${d.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{d.label.charAt(0)}</div>
                  <div><span className="font-semibold">{d.label}</span><span className="text-muted-foreground ml-1.5 text-xs">— {d.desc}</span></div>
                </button>
              ))}</div>
            </div>
            <div className="flex gap-2 justify-center pt-1">{locales.map(l => (
              <button key={l.code} onClick={() => setLocale(l.code)} className={`px-3 py-1 rounded-lg text-xs font-medium transition ${locale === l.code ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{l.name}</button>
            ))}</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const dir = locales.find(l => l.code === locale)?.dir || 'ltr'

  // ─── PAGE RENDERER ──────────────────────────────────────
  const renderPage = () => {
    if (loading) return <div className="space-y-4 py-8"><div className="flex items-center justify-center gap-3"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /><span className="text-muted-foreground text-sm">Loading data...</span></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Array.from({length:3}).map((_,i)=><div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />)}</div></div>

    // ─── DASHBOARD
    if (page === 'dashboard') return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{t(locale, 'navDashboard')}</h1><Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-0 font-medium">{ROLE_LABELS[role!]}</Badge></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {stats && [
            { key: 'enterpriseCount', label: t(locale, 'kpiEnterprises'), icon: Building2, gradient: 'from-purple-500 to-pink-500' },
            { key: 'branchCount', label: t(locale, 'kpiBranches'), icon: GitBranch, gradient: 'from-orange-500 to-amber-500' },
            { key: 'warehouseCount', label: t(locale, 'kpiWarehouses'), icon: WHIcon, gradient: 'from-cyan-500 to-teal-500' },
            { key: 'userCount', label: 'Users', icon: Users, gradient: 'from-green-500 to-emerald-500' },
            { key: 'productCount', label: t(locale, 'kpiProducts'), icon: Package, gradient: 'from-blue-500 to-indigo-500' },
            { key: 'orderCount', label: t(locale, 'navOrders'), icon: ShoppingCart, gradient: 'from-yellow-500 to-orange-500' },
            { key: 'pendingOrderCount', label: t(locale, 'kpiPendingOrders'), icon: AlertTriangle, gradient: 'from-red-500 to-pink-500' },
            { key: 'totalStockValue', label: t(locale, 'kpiStockValue'), icon: TrendingUp, gradient: 'from-emerald-500 to-green-500' },
          ].map(k => (
            <Card key={k.key} className="overflow-hidden border-0 shadow-sm"><CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${k.gradient} flex items-center justify-center shrink-0`}>
                  <k.icon className="w-4 h-4 text-white" />
                </div>
                <div><div className="text-lg sm:text-xl font-bold">{k.key === 'totalStockValue' ? fmt(stats[k.key as keyof DashboardStats] as number) : fmtN(stats[k.key as keyof DashboardStats] as number)}</div>
                  <div className="text-[11px] text-muted-foreground font-medium">{k.label}</div></div>
              </div></CardContent></Card>
          ))}
        </div>
        {stats && stats.lowStockProducts.length > 0 && (
          <Card className="border-red-200 dark:border-red-500/20 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-red-500 flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4" /> {t(locale, 'lowStockAlerts')}</CardTitle></CardHeader>
          <CardContent><div className="space-y-2">{stats.lowStockProducts.map(p => (
            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2 gap-1">
              <span className="font-medium">{p.name} <span className="text-muted-foreground font-normal">({p.sku})</span></span>
              <div className="flex items-center gap-3"><span className="text-muted-foreground">Current: <span className="text-red-600 dark:text-red-400 font-bold">{p.totalQty}</span></span><span className="text-muted-foreground">Reorder: {p.reorderLevel}</span></div>
            </div>))}</div></CardContent></Card>
        )}
      </div>
    )

    // ─── ENTERPRISES
    if (page === 'enterprises' && hasPermission(role!, 'enterprises:view')) return (
      <div className="space-y-5">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{t(locale, 'navEnterprises')}</h1>
          {hasPermission(role!, 'enterprises:create') && <Button onClick={() => openCreate('enterprise')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"><Plus className="w-4 h-4 mr-1.5" />{t(locale, 'newEnterprise')}</Button>}</div>
        <div className="grid gap-3">{enterprises.map(e => (
          <Card key={e.id} className="shadow-sm hover:shadow-md transition-shadow"><CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shrink-0">{e.name.charAt(0)}</div>
              <div><div className="font-semibold">{e.name}</div><div className="text-xs text-muted-foreground">{e.code} · {e.address}</div></div></div>
            <div className="flex items-center gap-2"><Badge className="bg-muted text-muted-foreground border-0 text-xs">B:{e.maxBranches} W:{e.maxWarehouses} U:{e.maxUsers}</Badge>
              {hasPermission(role!, 'enterprises:edit') && <Button size="sm" variant="ghost" onClick={() => openEdit('enterprise', e)}><Pencil className="w-3.5 h-3.5" /></Button>}
              {hasPermission(role!, 'enterprises:delete') && <Button size="sm" variant="ghost" onClick={() => crud.remove(`/enterprises/${e.id}`)} disabled={isCrudLoading('remove', `/enterprises/${e.id}`)} className="text-red-500">{isCrudLoading('remove', `/enterprises/${e.id}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</Button>}</div>
          </CardContent></Card>))}</div>
      </div>
    )

    // ─── BRANCHES
    if (page === 'branches' && hasPermission(role!, 'branches:view')) return (
      <div className="space-y-5">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{t(locale, 'navBranches')}</h1>
          {hasPermission(role!, 'branches:create') && <Button onClick={() => openCreate('branch')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"><Plus className="w-4 h-4 mr-1.5" />{t(locale, 'newBranch')}</Button>}</div>
        <div className="grid gap-3">{branches.map(b => (
          <Card key={b.id} className="shadow-sm hover:shadow-md transition-shadow"><CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold shrink-0">{b.name.charAt(0)}</div>
              <div><div className="font-semibold">{b.name}</div><div className="text-xs text-muted-foreground">{b.code} · {b.location} · {b.managerName}</div></div></div>
            <div className="flex gap-2">{hasPermission(role!, 'branches:edit') && <Button size="sm" variant="ghost" onClick={() => openEdit('branch', b)}><Pencil className="w-3.5 h-3.5" /></Button>}
              {hasPermission(role!, 'branches:delete') && <Button size="sm" variant="ghost" onClick={() => crud.remove(`/branches/${b.id}`)} disabled={isCrudLoading('remove', `/branches/${b.id}`)} className="text-red-500">{isCrudLoading('remove', `/branches/${b.id}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</Button>}</div>
          </CardContent></Card>))}</div>
      </div>
    )

    // ─── WAREHOUSES
    if (page === 'warehouses' && hasPermission(role!, 'warehouses:view')) return (
      <div className="space-y-5">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{t(locale, 'navWarehouses')}</h1>
          {hasPermission(role!, 'warehouses:create') && <Button onClick={() => openCreate('warehouse')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"><Plus className="w-4 h-4 mr-1.5" />{t(locale, 'newWarehouse')}</Button>}</div>
        <div className="grid gap-3">{warehouses.map(w => (
          <Card key={w.id} className="shadow-sm hover:shadow-md transition-shadow"><CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white font-bold shrink-0">{w.name.charAt(0)}</div>
              <div><div className="font-semibold">{w.name}</div><div className="text-xs text-muted-foreground">{w.code} · {w.location} · Cap: {fmtN(w.capacity)}</div></div></div>
            <div className="flex gap-2">{hasPermission(role!, 'warehouses:edit') && <Button size="sm" variant="ghost" onClick={() => openEdit('warehouse', w)}><Pencil className="w-3.5 h-3.5" /></Button>}
              {hasPermission(role!, 'warehouses:delete') && <Button size="sm" variant="ghost" onClick={() => crud.remove(`/warehouses/${w.id}`)} disabled={isCrudLoading('remove', `/warehouses/${w.id}`)} className="text-red-500">{isCrudLoading('remove', `/warehouses/${w.id}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</Button>}</div>
          </CardContent></Card>))}</div>
      </div>
    )

    // ─── USERS
    if (page === 'users' && hasPermission(role!, 'users:view')) return (
      <div className="space-y-5">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{t(locale, 'navUsers')}</h1>
          {hasPermission(role!, 'users:create') && <Button onClick={() => openCreate('user')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"><Plus className="w-4 h-4 mr-1.5" />{t(locale, 'newUser')}</Button>}</div>
        <div className="space-y-2">{allUsers.map(u => {
          const colors: Record<string, string> = { super_admin: 'from-purple-500 to-pink-500', enterprise_admin: 'from-blue-500 to-cyan-500', branch_admin: 'from-orange-500 to-amber-500', warehouse_admin: 'from-emerald-500 to-teal-500' }
          return (<Card key={u.id} className="shadow-sm"><CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[u.role] || 'from-slate-500 to-slate-600'} flex items-center justify-center text-white font-bold shrink-0`}>{u.fullName.charAt(0)}</div>
              <div><div className="font-semibold">{u.fullName}</div><div className="text-xs text-muted-foreground">{u.username} · {u.email}</div></div></div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${statusColor(u.role === 'super_admin' ? 'confirmed' : u.role === 'enterprise_admin' ? 'approved' : u.role === 'branch_admin' ? 'shipped' : 'received')} border-0 text-xs`}>{ROLE_LABELS[u.role]}</Badge>
              {hasPermission(role!, 'users:edit') && (role === 'super_admin' || canManageRole(role!, u.role)) && <Button size="sm" variant="ghost" onClick={() => openEdit('user', u)}><Pencil className="w-3.5 h-3.5" /></Button>}
            </div></CardContent></Card>)})}</div>
        <Card className="shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-2"><Lock className="w-4 h-4 text-blue-500" /> Role Hierarchy</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground"><p>Your role: <span className="text-blue-500 font-medium">{ROLE_LABELS[role!]}</span></p><p>Can create: <span className="text-foreground font-medium">{MANAGEABLE_ROLES[role!].map(r => ROLE_LABELS[r]).join(', ') || 'None'}</span></p></CardContent></Card>
      </div>
    )

    // ─── PRODUCTS
    if (page === 'products' && hasPermission(role!, 'products:view')) return (
      <div className="space-y-5">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{t(locale, 'navProducts')}</h1>
          <div className="flex gap-2">
            {hasPermission(role!, 'products:create') && <Button onClick={() => { setDlgType('registerItem'); setDlgEdit(null); setDlgData({}); setDlgOpen(true) }} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm"><Plus className="w-4 h-4 mr-1.5" />Register Item</Button>}
            {hasPermission(role!, 'stock:adjust') && <Button onClick={() => { setDlgType('stockIn'); setDlgEdit(null); setDlgData({}); setDlgOpen(true) }} className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm"><ArrowUpFromLine className="w-4 h-4 mr-1.5" />Stock In</Button>}
            {hasPermission(role!, 'products:create') && <Button onClick={() => openCreate('product')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"><Plus className="w-4 h-4 mr-1.5" />{t(locale, 'newProduct')}</Button>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{products.map(p => {
          const cat = categories.find(c => c.id === p.categoryId)
          const totalQty = stockData.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0)
          const isLow = totalQty <= p.reorderLevel
          return (<Card key={p.id} className="shadow-sm hover:shadow-md transition-shadow"><CardContent className="p-4">
            <div className="flex items-start justify-between mb-2"><div className="flex items-center gap-2"><div className={`w-9 h-9 rounded-xl ${isLow ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-blue-500 to-indigo-500'} flex items-center justify-center shrink-0`}><Package className="w-4 h-4 text-white" /></div>
              <div><div className="font-semibold text-sm">{p.name}</div><div className="text-[11px] text-muted-foreground font-mono">{p.sku}</div></div></div>
              <div className="flex gap-1">{hasPermission(role!, 'stock:adjust') && <Button size="sm" variant="ghost" onClick={() => { setDlgType('stockIn'); setDlgEdit({productId:p.id}); setDlgData({productId:p.id,quantity:''}); setDlgOpen(true) }} className="h-7 w-7 p-0 text-emerald-600"><ArrowUpFromLine className="w-3 h-3" /></Button>}
                {hasPermission(role!, 'products:edit') && <Button size="sm" variant="ghost" onClick={() => openEdit('product', p)} className="h-7 w-7 p-0"><Pencil className="w-3 h-3" /></Button>}
                {hasPermission(role!, 'products:delete') && <Button size="sm" variant="ghost" onClick={() => crud.remove(`/products/${p.id}`)} disabled={isCrudLoading('remove', `/products/${p.id}`)} className="text-red-500 h-7 w-7 p-0">{isCrudLoading('remove', `/products/${p.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}</Button>}</div></div>
            <div className="text-xs text-muted-foreground mb-2">{cat?.name || '—'}</div>
            <div className="flex items-center justify-between"><span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmt(p.price)}</span><span className="text-xs text-muted-foreground">Cost: {fmt(p.cost)}</span></div>
            <div className="flex items-center justify-between mt-1"><span className={`text-sm font-bold ${isLow ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{totalQty} {p.unit}</span>{isLow && <Badge className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-0 text-[10px]">Low Stock</Badge>}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Reorder: {p.reorderLevel}</div>
          </CardContent></Card>)})}</div>
      </div>
    )

    // ─── STOCK
    if (page === 'stock' && hasPermission(role!, 'stock:view')) return (
      <div className="space-y-5">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{t(locale, 'navStock')}</h1>
          <div className="flex gap-2">
            {hasPermission(role!, 'products:create') && <Button onClick={() => { setDlgType('registerItem'); setDlgEdit(null); setDlgData({}); setDlgOpen(true) }} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm"><Plus className="w-4 h-4 mr-1.5" />Register Item</Button>}
            {hasPermission(role!, 'stock:adjust') && <Button onClick={() => { setDlgType('stockIn'); setDlgEdit(null); setDlgData({}); setDlgOpen(true) }} className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm"><ArrowUpFromLine className="w-4 h-4 mr-1.5" />Stock In</Button>}
          </div></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{stockData.map(s => {
          const prod = products.find(p => p.id === s.productId); const wh = warehouses.find(w => w.id === s.warehouseId); const isLow = prod ? s.quantity <= prod.reorderLevel : false
          return (<Card key={s.id} className="shadow-sm"><CardContent className="p-4">
            <div className="flex items-center justify-between mb-2"><div className="font-semibold text-sm">{prod?.name || `Product #${s.productId}`}</div>
              {isLow ? <Badge className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-0 text-[11px]">Low</Badge> : <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-0 text-[11px]">OK</Badge>}</div>
            <div className="text-xs text-muted-foreground mb-2">{wh?.name || `WH #${s.warehouseId}`}</div>
            <div className="flex items-center justify-between"><span className="text-xl font-bold">{s.quantity}</span><span className="text-xs text-muted-foreground">Value: {prod ? fmt(s.quantity * prod.price) : '—'}</span></div>
            <div className="flex gap-2 mt-3">
              {hasPermission(role!, 'stock:adjust') && <Button size="sm" variant="outline" onClick={() => { setDlgType('stockIn'); setDlgEdit({productId:s.productId}); setDlgData({productId:s.productId,warehouseId:s.warehouseId,quantity:''}); setDlgOpen(true) }} className="flex-1 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"><ArrowUpFromLine className="w-3 h-3 mr-1" />Stock In</Button>}
              {hasPermission(role!, 'stock:adjust') && <Button size="sm" variant="outline" onClick={() => openEdit('stock', s)} className="flex-1 text-xs">Adjust</Button>}
            </div>
          </CardContent></Card>)})}</div>
      </div>
    )

    // ─── ORDERS
    if (page === 'orders' && hasPermission(role!, 'orders:view')) return (
      <div className="space-y-5">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{t(locale, 'navOrders')}</h1>
          {hasPermission(role!, 'orders:create') && <Button onClick={() => openCreate('order')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"><Plus className="w-4 h-4 mr-1.5" />{t(locale, 'newOrder')}</Button>}</div>
        <div className="grid gap-3">{orders.map(o => { const wh = warehouses.find(w => w.id === o.warehouseId)
          return (<Card key={o.id} className="shadow-sm"><CardContent className="p-4">
            <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-2"><span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">#{o.id}</span>{statusBadge(o.status)}
              <Badge className={`${o.type === 'purchase' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'} border-0 text-[11px]`}>{o.type}</Badge></div>
              <span className="text-sm font-bold">{fmt(o.totalAmount)}</span></div>
            <div className="text-xs text-muted-foreground">{wh?.name || '—'} · {o.notes}</div>
            {hasPermission(role!, 'orders:edit') && <Button size="sm" variant="ghost" onClick={() => openEdit('order', o)} className="mt-2 text-xs"><Pencil className="w-3 h-3 mr-1" />Edit</Button>}
          </CardContent></Card>)})}</div>
      </div>
    )

    // ─── SUPPLIERS
    if (page === 'suppliers' && hasPermission(role!, 'suppliers:view')) return (
      <div className="space-y-5">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{t(locale, 'navSuppliers')}</h1>
          {hasPermission(role!, 'suppliers:create') && <Button onClick={() => openCreate('supplier')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"><Plus className="w-4 h-4 mr-1.5" />{t(locale, 'newSupplier')}</Button>}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{suppliers.map(s => (
          <Card key={s.id} className="shadow-sm hover:shadow-md transition-shadow"><CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0"><Truck className="w-4 h-4 text-white" /></div>
              <div className="font-semibold">{s.name}</div></div>
            <div className="text-xs text-muted-foreground space-y-0.5"><div>{s.contactPerson}</div><div>{s.email} · {s.phone}</div></div>
            <div className="flex gap-2 mt-3">{hasPermission(role!, 'suppliers:edit') && <Button size="sm" variant="ghost" onClick={() => openEdit('supplier', s)}><Pencil className="w-3.5 h-3.5" /></Button>}
              {hasPermission(role!, 'suppliers:delete') && <Button size="sm" variant="ghost" onClick={() => crud.remove(`/suppliers/${s.id}`)} disabled={isCrudLoading('remove', `/suppliers/${s.id}`)} className="text-red-500">{isCrudLoading('remove', `/suppliers/${s.id}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</Button>}</div>
          </CardContent></Card>))}</div>
      </div>
    )

    // ─── CATEGORIES
    if (page === 'categories' && hasPermission(role!, 'categories:view')) return (
      <div className="space-y-5">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{t(locale, 'navCategories')}</h1>
          {hasPermission(role!, 'categories:create') && <Button onClick={() => openCreate('category')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"><Plus className="w-4 h-4 mr-1.5" />{t(locale, 'newCategory')}</Button>}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{categories.map(c => (
          <Card key={c.id} className="shadow-sm hover:shadow-md transition-shadow"><CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1"><Tag className="w-4 h-4 text-blue-500" /><div className="font-semibold text-sm">{c.name}</div></div>
            <div className="text-xs text-muted-foreground line-clamp-2">{c.description}</div>
            <div className="flex gap-2 mt-2">{hasPermission(role!, 'categories:edit') && <Button size="sm" variant="ghost" onClick={() => openEdit('category', c)} className="h-6 w-6 p-0"><Pencil className="w-3 h-3" /></Button>}
              {hasPermission(role!, 'categories:delete') && <Button size="sm" variant="ghost" onClick={() => crud.remove(`/categories/${c.id}`)} disabled={isCrudLoading('remove', `/categories/${c.id}`)} className="text-red-500 h-6 w-6 p-0">{isCrudLoading('remove', `/categories/${c.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}</Button>}</div>
          </CardContent></Card>))}</div>
      </div>
    )

    // ─── BATCHES (Register Items)
    if (page === 'batches') return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div><h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="w-6 h-6 text-blue-500" /> Inventory Batches</h1>
            <p className="text-sm text-muted-foreground mt-1">Register items into inventory. Each batch groups entries under one person. Entries immediately update stock.</p></div>
          <Button onClick={() => openCreate('batch')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"><Plus className="w-4 h-4 mr-1.5" />New Batch</Button></div>
        <div className="grid gap-3">{batchData.map(b => { const wh = warehouses.find(w => w.id === b.warehouseId); const isExp = expandedBatch === b.id
          return (<Card key={b.id} className="shadow-sm hover:shadow-md transition-shadow"><CardContent className="p-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedBatch(isExp ? null : b.id)}>
              <div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0 transition-transform ${isExp ? 'rotate-90' : 'rotate-0'}`}><ChevronRight className="w-4 h-4 text-white" /></div>
                <div><div className="font-semibold text-sm flex items-center gap-2">{b.batchCode} {statusBadge(b.status)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2"><span>{b.personName}</span><span>·</span><span>{wh?.name || '—'}</span><span>·</span><span>{b.entries.length} entries</span></div></div></div>
              <span className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleDateString()}</span></div>
            {isExp && (<div className="mt-4 space-y-3 border-t pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="w-3 h-3" />{b.personPhone || '—'}</div>
                <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="w-3 h-3" />{b.personEmail || '—'}</div>
                {b.notes && <div className="flex items-center gap-1.5 text-muted-foreground"><FileText className="w-3 h-3" />{b.notes}</div>}
              </div>
              {b.entries.length > 0 && <div className="space-y-2">{b.entries.map(e => { const prod = products.find(p => p.id === e.productId); const currentStock = stockData.filter(s => s.productId === e.productId).reduce((sum, s) => sum + s.quantity, 0)
                return (<div key={e.id} className="bg-muted/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><Package className="w-4 h-4 text-blue-500" /><div><div className="text-sm font-medium">{prod?.name || `Product #${e.productId}`}</div>{e.notes && <div className="text-[11px] text-muted-foreground">{e.notes}</div>}</div></div>
                  <div className="flex items-center gap-4 text-xs"><span className="font-bold text-base">{e.quantity}</span><span className="text-muted-foreground">{e.unit}</span><span className="text-muted-foreground">@ {fmt(e.costPerUnit)}/{e.unit}</span><span className="font-semibold">{fmt(e.quantity * e.costPerUnit)}</span><span className="text-emerald-600 dark:text-emerald-400">Stock: {currentStock}</span></div>
                </div>)})}</div>}
              {b.status === 'open' && <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setDlgType('batchEntry'); setDlgEdit(null); setDlgData({ batchId: b.id, warehouseId: b.warehouseId }); setDlgOpen(true) }} className="w-full sm:w-auto"><Plus className="w-3.5 h-3.5 mr-1.5" />Add Entry</Button>
                <Button size="sm" variant="outline" onClick={async () => { try { await crud.update(`/batches/${b.id}`, { status: 'closed' }); } catch(e: any) { toast({ title: e.message, variant: 'destructive' }) } }} className="w-full sm:w-auto text-amber-600 border-amber-200 hover:bg-amber-50">Close Batch</Button>
              </div>}
            </div>)}
          </CardContent></Card>)})}</div>
      </div>
    )

    // ─── STOCK OUT RECORDER
    if (page === 'stockOut') return (
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div><h1 className="text-lg font-bold flex items-center gap-1.5"><ArrowUpFromLine className="w-4 h-4 text-orange-500" />Stock Out</h1></div>
          <Button size="sm" onClick={() => openCreate('stockOut')} className="bg-gradient-to-r from-orange-500 to-red-500 text-white h-7 text-xs"><Plus className="w-3 h-3 mr-1" />New Recorder</Button>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-end gap-2 bg-muted/30 rounded-md p-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground mb-1.5" />
          <div className="space-y-0.5"><Label className="text-[10px] text-muted-foreground">Date From</Label><div className="w-32"><CustomDatePicker compact value={stockOutFilterDateFrom} onChange={v => { setStockOutFilterDateFrom(v); setStockOutRecPage(1) }} /></div></div>
          <div className="space-y-0.5"><Label className="text-[10px] text-muted-foreground">Date To</Label><div className="w-32"><CustomDatePicker compact value={stockOutFilterDateTo} onChange={v => { setStockOutFilterDateTo(v); setStockOutRecPage(1) }} /></div></div>
          <div className="space-y-0.5"><Label className="text-[10px] text-muted-foreground">Status</Label><Select value={stockOutFilterStatus || '_all'} onValueChange={v => { setStockOutFilterStatus(v === '_all' ? '' : v); setStockOutRecPage(1) }}><SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="_all">All</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="confirmed">Confirmed</SelectItem><SelectItem value="closed">Closed</SelectItem><SelectItem value="draft">Draft</SelectItem></SelectContent></Select></div>
          <div className="space-y-0.5"><Label className="text-[10px] text-muted-foreground">Person</Label><Input value={stockOutFilterPerson} onChange={e => { setStockOutFilterPerson(e.target.value); setStockOutRecPage(1) }} placeholder="Search name..." className="h-7 text-xs w-32" /></div>
          {(stockOutFilterDateFrom || stockOutFilterDateTo || stockOutFilterStatus || stockOutFilterPerson) && <Button size="sm" variant="ghost" onClick={() => { setStockOutFilterDateFrom(''); setStockOutFilterDateTo(''); setStockOutFilterStatus(''); setStockOutFilterPerson(''); setStockOutRecPage(1) }} className="h-7 text-xs text-muted-foreground"><X className="w-3 h-3 mr-0.5" />Clear</Button>}
        </div>

        {(() => {
          // Filter recorders
          let filtered = [...stockOutData].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          if (stockOutFilterDateFrom) filtered = filtered.filter(r => new Date(r.createdAt) >= new Date(stockOutFilterDateFrom + 'T00:00:00'))
          if (stockOutFilterDateTo) filtered = filtered.filter(r => new Date(r.createdAt) <= new Date(stockOutFilterDateTo + 'T23:59:59'))
          if (stockOutFilterStatus) filtered = filtered.filter(r => r.status === stockOutFilterStatus)
          if (stockOutFilterPerson) filtered = filtered.filter(r => (r.personName || '').toLowerCase().includes(stockOutFilterPerson.toLowerCase()))

          const recTotalPages = Math.ceil(filtered.length / STOCK_OUT_REC_PER_PAGE)
          const recPaged = filtered.slice((stockOutRecPage - 1) * STOCK_OUT_REC_PER_PAGE, stockOutRecPage * STOCK_OUT_REC_PER_PAGE)

          return (<>
            {recPaged.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">No recorders found</div>}
            {recPaged.map(r => { const isExp = expandedOut === r.id; const isExpanding = expandingOutId === r.id; const pendingItems = getPendingItems(r.id); const totalItems = r.items.length + pendingItems.length
              return (<Card key={r.id} className="shadow-sm"><CardContent className="p-2.5">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => { if (isExp) { setExpandedOut(null) } else { setExpandingOutId(r.id); setTimeout(() => { setExpandedOut(r.id); setExpandingOutId(null) }, 200) } }}>
                  <div className="flex items-center gap-1.5">{isExpanding ? <Loader2 className="w-3 h-3 animate-spin text-orange-500" /> : <ChevronRight className={`w-3.5 h-3.5 text-orange-500 transition-transform ${isExp ? 'rotate-90' : ''}`} />}
                    <div className="flex items-center gap-1.5 flex-wrap">{!isExp && r.personName ? <span className="text-xs font-semibold">{r.personName}</span> : <span className="text-xs font-semibold">{r.recorderCode}</span>}{statusBadge(r.status)}<span className="text-[10px] text-muted-foreground">{totalItems} item{totalItems !== 1 ? 's' : ''}{pendingItems.length > 0 && ` (${pendingItems.length} pend.)`}</span></div>
                    {!isExp && r.personName && <span className="text-[10px] text-muted-foreground ml-0.5">{r.recorderCode}</span>}{isExp && r.personName && <span className="text-xs font-medium text-foreground/80 ml-1">{r.personName}</span>}</div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                    {hasPermission(role!, 'orders:edit') && <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); openEdit('stockOut', r) }} className="h-5 w-5 p-0 text-muted-foreground"><Pencil className="w-2.5 h-2.5" /></Button>}
                    {hasPermission(role!, 'orders:edit') && <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); crud.remove(`/stock-out/${r.id}`) }} disabled={isCrudLoading('remove', `/stock-out/${r.id}`)} className="h-5 w-5 p-0 text-red-500">{isCrudLoading('remove', `/stock-out/${r.id}`) ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}</Button>}
                  </div>
                </div>
                {isExp && (<div className="mt-2 space-y-2 border-t pt-2">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                    {r.personPhone && <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{r.personPhone}</span>}
                    {r.personEmail && <span className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{r.personEmail}</span>}
                    {r.personAddress && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{r.personAddress}</span>}
                    {r.notes && <span className="flex items-center gap-0.5"><FileText className="w-2.5 h-2.5" />{r.notes}</span>}
                  </div>

                  {/* ── Items Table (saved + pending) with pagination ── */}
                  {(() => { const allItems = [...r.items.map(i => ({ ...i, _pending: false })), ...pendingItems.map(i => ({ ...i, id: i.tempId, _pending: true }))] as any[]
                    const totalPages = Math.ceil(allItems.length / STOCK_OUT_ITEMS_PER_PAGE); const paged = allItems.slice((stockOutItemPage - 1) * STOCK_OUT_ITEMS_PER_PAGE, stockOutItemPage * STOCK_OUT_ITEMS_PER_PAGE)
                    const totalQty = allItems.reduce((sum: number, i: any) => sum + i.quantity, 0)
                    return (<div id={`stockout-print-${r.id}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Items ({totalItems}) · Total Qty: {totalQty}</span>
                        <Button size="sm" variant="outline" onClick={() => { const w = window.open('', '_blank', 'width=800,height=600'); if (!w) return; w.document.write('<html><head><title>Stock Out - ' + r.recorderCode + '</title><style>body{font-family:system-ui,sans-serif;padding:24px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left;font-size:13px}th{background:#f1f5f9;font-weight:600}.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}.saved{background:#dcfce7;color:#166534}.pending{background:#fef3c7;color:#92400e}h2{font-size:18px;margin:0}p{color:#64748b;font-size:13px;margin:4px 0}.summary{margin-top:8px;font-size:13px;color:#334155;font-weight:600}</style></head><body>'); w.document.write('<h2>' + r.recorderCode + '</h2>'); w.document.write('<p>Date: ' + new Date(r.createdAt).toLocaleString() + '</p>'); w.document.write('<p>Person: ' + r.personName + (r.personPhone ? ' | Phone: ' + r.personPhone : '') + (r.personEmail ? ' | Email: ' + r.personEmail : '') + '</p>'); if (r.personAddress) w.document.write('<p>Address: ' + r.personAddress + '</p>'); if (r.notes) w.document.write('<p>Notes: ' + r.notes + '</p>'); w.document.write('<table><thead><tr><th>Product</th><th style="text-align:right">Qty</th><th>Unit</th><th>Returnable</th><th>Deadline</th><th>Status</th></tr></thead><tbody>'); allItems.forEach((item: any) => { const prod = products.find((p: any) => p.id === item.productId); w.document.write('<tr><td>' + (prod?.name || '#'+item.productId) + '</td><td style="text-align:right">' + item.quantity + '</td><td>' + item.unit + '</td><td>' + (item.isReturnable ? 'Yes' : 'No') + '</td><td>' + (item.returnDeadline || '—') + '</td><td><span class="badge ' + (item._pending ? 'pending' : 'saved') + '">' + (item._pending ? 'Pending' : 'Saved') + '</span></td></tr>') }); w.document.write('</tbody></table>'); w.document.write('<p class="summary">Total Items: ' + totalItems + ' · Total Qty: ' + totalQty + '</p>'); w.document.write('</body></html>'); w.document.close(); w.print() }} className="h-5 text-[10px] gap-0.5"><Printer className="w-2.5 h-2.5" />Print</Button>
                      </div>
                      {totalItems > 0 ? (<>
                        <div className="rounded-md border overflow-hidden"><Table><TableHeader><TableRow>
                          <TableHead className="h-6 text-[10px]">Product</TableHead><TableHead className="h-6 text-[10px] text-right w-14">Qty</TableHead><TableHead className="h-6 text-[10px] w-14">Unit</TableHead><TableHead className="h-6 text-[10px] text-center w-14">Ret</TableHead><TableHead className="h-6 text-[10px] w-20">Deadline</TableHead><TableHead className="h-6 text-[10px] text-center w-14">Status</TableHead><TableHead className="h-6 w-10"></TableHead>
                        </TableRow></TableHeader><TableBody>
                          {paged.map((item: any) => { const prod = products.find(p => p.id === item.productId)
                            return (<TableRow key={item.id} className={item._pending ? 'bg-amber-50/50 dark:bg-amber-500/5 border-dashed' : ''}>
                              <TableCell className="py-1 text-[11px] font-medium">{prod?.name || `#${item.productId}`}</TableCell>
                              <TableCell className="py-1 text-[11px] text-right font-mono">{item.quantity}</TableCell>
                              <TableCell className="py-1 text-[11px] text-muted-foreground">{item.unit}</TableCell>
                              <TableCell className="py-1 text-center">{item.isReturnable ? <RotateCcw className="w-2.5 h-2.5 text-emerald-500 inline" /> : <X className="w-2.5 h-2.5 text-red-400 inline" />}</TableCell>
                              <TableCell className="py-1 text-[11px] text-muted-foreground">{item.returnDeadline || '—'}</TableCell>
                              <TableCell className="py-1 text-center">{item._pending ? <Badge variant="outline" className="text-[9px] h-4 border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400">Pend</Badge> : <Badge variant="outline" className="text-[9px] h-4 border-emerald-300 text-emerald-700 dark:border-emerald-600 dark:text-emerald-400">Saved</Badge>}</TableCell>
                              <TableCell className="py-1 text-right"><Button size="sm" variant="ghost" onClick={() => item._pending ? removePendingItem(r.id, item.tempId) : crud.remove(`/stock-out/${r.id}/item/${item.id}`)} disabled={!item._pending && isCrudLoading('remove', `/stock-out/${r.id}/item/${item.id}`)} className="text-red-500 h-4 w-4 p-0">{!item._pending && isCrudLoading('remove', `/stock-out/${r.id}/item/${item.id}`) ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}</Button></TableCell>
                            </TableRow>)})}
                        </TableBody></Table></div>
                        <Pager page={stockOutItemPage} totalPages={totalPages} onPageChange={setStockOutItemPage} />
                      </>) : <div className="text-[10px] text-muted-foreground text-center py-2">No items yet</div>}
                    </div>)})()}

                  {/* Submit pending button */}
                  {pendingItems.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" disabled={submittingRecorder === r.id} onClick={() => submitPendingItems(r.id, r.enterpriseId || eid)} className="bg-emerald-600 text-white h-6 text-[11px]">{submittingRecorder === r.id ? <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" /> : <Check className="w-2.5 h-2.5 mr-0.5" />}Submit {pendingItems.length}</Button>
                      <Button size="sm" variant="ghost" onClick={() => clearPendingItems(r.id)} className="h-6 text-[11px] text-muted-foreground" disabled={submittingRecorder === r.id}>Clear</Button>
                    </div>
                  )}

                  {/* ── Add Items Section ── */}
                  <div className="bg-muted/30 rounded-md p-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Add Items</span>
                      <div className="flex items-center bg-muted rounded-md p-0.5">
                        <button onClick={() => setStockOutMode('pic')} className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${stockOutMode === 'pic' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-muted-foreground'}`}><LayoutGrid className="w-2.5 h-2.5 inline mr-0.5" />Pick</button>
                        <button onClick={() => setStockOutMode('table')} className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${stockOutMode === 'table' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-muted-foreground'}`}><List className="w-2.5 h-2.5 inline mr-0.5" />Table</button>
                      </div>
                    </div>

                    {/* ── Pick Mode: single row with Select dropdown that has paginated content ── */}
                    {stockOutMode === 'pic' ? (
                      (() => {
                        const sel = stockOutPickInputs['_selected'] || { productId: 0, qty: 1, unit: 'pcs', isReturnable: false, returnDeadline: '' }
                        const filteredProds = products.filter(p => !stockOutSearch || p.name.toLowerCase().includes(stockOutSearch.toLowerCase()) || p.sku.toLowerCase().includes(stockOutSearch.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name))
                        const selTotalPages = Math.ceil(filteredProds.length / STOCK_OUT_PICK_SELECT_PER_PAGE)
                        const selPaged = filteredProds.slice((stockOutPickSelectPage - 1) * STOCK_OUT_PICK_SELECT_PER_PAGE, stockOutPickSelectPage * STOCK_OUT_PICK_SELECT_PER_PAGE)
                        return (<div className="space-y-1.5">
                          <div className="relative"><Search className="w-3 h-3 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Filter products..." value={stockOutSearch} onChange={e => { setStockOutSearch(e.target.value); setStockOutPickSelectPage(1) }} className="h-6 text-[11px] pl-7" /></div>
                          <div className="rounded-md border overflow-hidden"><Table><TableHeader><TableRow>
                            <TableHead className="h-5 text-[10px]">Product</TableHead><TableHead className="h-5 text-[10px] text-right w-16">In Stock</TableHead><TableHead className="h-5 text-[10px] text-right w-20">Qty</TableHead><TableHead className="h-5 text-[10px] w-14">Unit</TableHead><TableHead className="h-5 text-[10px] text-center w-12">Ret?</TableHead><TableHead className="h-5 text-[10px] w-20">Deadline</TableHead><TableHead className="h-5 w-10"></TableHead>
                          </TableRow></TableHeader><TableBody><TableRow className="border-dashed border-b-blue-300 dark:border-b-blue-600">
                            <TableCell className="py-0.5"><Select value={sel.productId ? String(sel.productId) : '_none'} onValueChange={v => { if (v === '_none') return; setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], productId: parseInt(v), qty: prev['_selected']?.qty || 1, unit: prev['_selected']?.unit || 'pcs', isReturnable: prev['_selected']?.isReturnable || false, returnDeadline: prev['_selected']?.returnDeadline || '' } })) }}><SelectTrigger className="h-5 text-[11px]"><SelectValue placeholder="Select product..." /></SelectTrigger><SelectContent className="max-h-64">
                              {selPaged.map(p => { const stk = getAvailableStock(p.id, r.warehouseId); return <SelectItem key={p.id} value={String(p.id)}>{p.name} <span className="text-muted-foreground ml-1 font-mono text-[10px]">{p.sku}</span> <span className={`ml-1 text-[10px] font-semibold ${stk > 0 ? 'text-emerald-600' : 'text-red-500'}`}>({stk})</span></SelectItem> })}
                              {selPaged.length === 0 && <div className="px-2 py-1.5 text-[11px] text-muted-foreground text-center">No products found</div>}
                            </SelectContent></Select></TableCell>
                            <TableCell className="py-0.5 text-[11px] text-right font-mono">{sel.productId ? <span className={getAvailableStock(sel.productId, r.warehouseId) > 0 ? 'text-emerald-600' : 'text-red-500'}>{getAvailableStock(sel.productId, r.warehouseId)}</span> : '—'}</TableCell>
                            <TableCell className="py-0.5"><Input type="number" min={1} max={sel.productId ? getAvailableStock(sel.productId, r.warehouseId) : undefined} value={sel.qty || 1} onChange={e => setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], qty: parseInt(e.target.value) || 1 } }))} className="h-5 text-[11px] w-20 text-right" /></TableCell>
                            <TableCell className="py-0.5"><Select value={sel.unit || 'pcs'} onValueChange={v => setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], unit: v } }))}><SelectTrigger className="h-5 text-[11px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-36">{SORTED_MEASUREMENTS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></TableCell>
                            <TableCell className="py-0.5 text-center"><Switch checked={sel.isReturnable || false} onCheckedChange={v => setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], isReturnable: v } }))} className="scale-75" /></TableCell>
                            <TableCell className="py-0.5">{sel.isReturnable ? <CustomDatePicker value={sel.returnDeadline || ''} onChange={v => setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], returnDeadline: v } }))} /> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="py-0.5 text-right"><Button size="sm" disabled={addingItem || !sel.productId} className="h-5 text-[10px] bg-blue-600 text-white px-1.5" onClick={() => { if (!sel.productId) { toast({ title: 'Select a product', variant: 'destructive' }); return }; if (!sel.qty || sel.qty < 1) { toast({ title: 'Qty ≥ 1', variant: 'destructive' }); return }; const avail = getAvailableStock(sel.productId, r.warehouseId); if (sel.qty > avail) { toast({ title: `Only ${avail} in stock`, variant: 'destructive' }); return }; addPendingItem(r.id, { productId: sel.productId, warehouseId: r.warehouseId, quantity: sel.qty, unit: sel.unit || 'pcs', isReturnable: sel.isReturnable || false, returnDeadline: sel.returnDeadline || null, notes: '' }); setStockOutPickInputs(prev => { const n = { ...prev }; delete n['_selected']; return n }) }}>{addingItem ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}</Button></TableCell>
                          </TableRow></TableBody></Table></div>
                          {selTotalPages > 1 && <div className="flex items-center justify-between pt-1"><span className="text-[10px] text-muted-foreground">Products page {stockOutPickSelectPage}/{selTotalPages}</span><div className="flex gap-0.5"><Button size="sm" variant="outline" disabled={stockOutPickSelectPage <= 1} onClick={() => setStockOutPickSelectPage(p => p - 1)} className="h-5 w-5 p-0"><ChevronLeft className="w-2.5 h-2.5" /></Button><Button size="sm" variant="outline" disabled={stockOutPickSelectPage >= selTotalPages} onClick={() => setStockOutPickSelectPage(p => p + 1)} className="h-5 w-5 p-0"><ChevronRight className="w-2.5 h-2.5" /></Button></div></div>}
                        </div>)
                      })()
                    ) : (
                      // ── Table Mode: each product = its own row (spreadsheet), with pagination ──
                      (() => { const sortedProds = [...products].sort((a, b) => a.name.localeCompare(b.name)); const totalPages = Math.ceil(sortedProds.length / STOCK_OUT_PRODUCTS_PER_PAGE); const paged = sortedProds.slice((stockOutProductPage - 1) * STOCK_OUT_PRODUCTS_PER_PAGE, stockOutProductPage * STOCK_OUT_PRODUCTS_PER_PAGE)
                        return (<div>
                          <div className="rounded-md border overflow-hidden"><Table><TableHeader><TableRow>
                            <TableHead className="h-5 text-[10px]">Product</TableHead><TableHead className="h-5 text-[10px] text-right w-16">In Stock</TableHead><TableHead className="h-5 text-[10px] text-right w-20">Qty</TableHead><TableHead className="h-5 text-[10px] w-14">Unit</TableHead><TableHead className="h-5 text-[10px] text-center w-12">Ret?</TableHead><TableHead className="h-5 text-[10px] w-20">Deadline</TableHead><TableHead className="h-5 w-10"></TableHead>
                          </TableRow></TableHeader><TableBody>
                            {paged.map(prod => { const inp = getRowInput(prod.id); const stk = getAvailableStock(prod.id, r.warehouseId)
                              return (<TableRow key={prod.id}>
                                <TableCell className="py-0.5 text-[11px]"><span className="font-medium">{prod.name}</span> <span className="text-muted-foreground font-mono text-[10px]">{prod.sku}</span></TableCell>
                                <TableCell className="py-0.5 text-[11px] text-right font-mono"><span className={stk > 0 ? 'text-emerald-600' : 'text-red-500'}>{stk}</span></TableCell>
                                <TableCell className="py-0.5"><Input type="number" min={1} max={stk} value={inp.qty} onChange={e => updateRowInput(prod.id, { qty: parseInt(e.target.value) || 1 })} className="h-5 text-[11px] w-20 text-right" /></TableCell>
                                <TableCell className="py-0.5"><Select value={inp.unit} onValueChange={v => updateRowInput(prod.id, { unit: v })}><SelectTrigger className="h-5 text-[11px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-36">{SORTED_MEASUREMENTS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></TableCell>
                                <TableCell className="py-0.5 text-center"><Switch checked={inp.isReturnable} onCheckedChange={v => updateRowInput(prod.id, { isReturnable: v })} className="scale-75" /></TableCell>
                                <TableCell className="py-0.5">{inp.isReturnable ? <CustomDatePicker value={inp.returnDeadline} onChange={v => updateRowInput(prod.id, { returnDeadline: v })} /> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                                <TableCell className="py-0.5 text-right"><Button size="sm" disabled={addingItem || stk <= 0} className="h-5 text-[10px] bg-blue-600 text-white px-1.5" onClick={() => { if (!inp.qty || inp.qty < 1) { toast({ title: 'Qty ≥ 1', variant: 'destructive' }); return }; if (inp.qty > stk) { toast({ title: `Only ${stk} in stock`, variant: 'destructive' }); return }; addPendingItem(r.id, { productId: prod.id, warehouseId: r.warehouseId, quantity: inp.qty, unit: inp.unit, isReturnable: inp.isReturnable, returnDeadline: inp.returnDeadline || null, notes: '' }); updateRowInput(prod.id, { qty: 1, unit: 'pcs', isReturnable: false, returnDeadline: '' }) }}>{addingItem ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}</Button></TableCell>
                              </TableRow>)})}
                          </TableBody></Table></div>
                          <Pager page={stockOutProductPage} totalPages={totalPages} onPageChange={setStockOutProductPage} />
                        </div>)
                      })()
                    )}
                  </div>
                </div>)}
              </CardContent></Card>)})}
            <Pager page={stockOutRecPage} totalPages={recTotalPages} onPageChange={setStockOutRecPage} />
          </>)
        })()}
      </div>
    )

    // ─── FEATURES
    if (page === 'features') return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ToggleLeft className="w-6 h-6 text-blue-500" /> Enterprise Features</h1>
        {role !== 'super_admin' && <Card className="border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10"><CardContent className="p-3 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2"><Lock className="w-4 h-4" />Only Super Admin can toggle features</CardContent></Card>}
        {enterprises.map(e => { const eFeats = features.filter(f => f.enterpriseId === e.id)
          return (<Card key={e.id} className="shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-500" />{e.name} <Badge className="bg&text-muted-foreground border-0 text-xs">{e.code}</Badge></CardTitle></CardHeader>
            <CardContent><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{eFeats.map(f => (
              <div key={f.id} className="flex items-center justify-between bg-muted/40 rounded-xl p-3">
                <span className="text-sm font-medium capitalize">{f.feature.replace(/_/g, ' ')}</span>
                {role === 'super_admin' ? <Switch checked={f.enabled} onCheckedChange={async (v) => { try { await apiFetch('/features', { method: 'POST', body: JSON.stringify({ enterpriseId: e.id, feature: f.feature, enabled: v }) }); await loadData() } catch(e: any) { toast({ title: e.message, variant: 'destructive' }) } }} /> : <Badge className={`${f.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'} border-0 text-xs`}>{f.enabled ? 'On' : 'Off'}</Badge>}
              </div>))}</div></CardContent></Card>)})}
      </div>
    )

    // ─── AUDIT
    if (page === 'audit') return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <div className="space-y-1">{auditData.map(a => { const user = allUsers.find(u => u.id === a.userId)
          return (<div key={a.id} className="bg-card rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 shadow-sm">
            <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">{new Date(a.createdAt).toLocaleString()}</span>
            <span className="text-xs font-medium">{user?.fullName || `User #${a.userId}`}</span>
            <span className="font-mono text-xs text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded">{a.action}</span>
            <span className="text-xs text-muted-foreground">{a.entity}</span>
            <span className="text-xs text-muted-foreground/70 truncate">{a.details}</span></div>)})}</div>
      </div>
    )

    return null
  }

  // ─── MAIN LAYOUT ────────────────────────────────────────
  if (!mounted) return <div suppressHydrationWarning className="min-h-screen bg-background" />
  return (
    <TooltipProvider>
      <div dir={dir} suppressHydrationWarning className="min-h-screen bg-background text-foreground flex">
        {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r flex flex-col transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm"><Box className="w-5 h-5 text-white" /></div>
              <div><div className="font-bold text-sm">{t(locale, 'appName')}</div><div className="text-[10px] text-muted-foreground">{t(locale, 'appSubtitle')}</div></div></div>
            <button className="lg:hidden text-muted-foreground p-1 hover:bg-muted rounded-lg" onClick={() => setSidebarOpen(false)}><X className="w-5 h-5" /></button></div>

          <div className="px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2 mb-1"><Shield className="w-3.5 h-3.5 text-blue-500" /><span className="text-xs font-semibold text-blue-500">{ROLE_LABELS[role!]}</span></div>
            <div className="text-xs text-muted-foreground truncate">{auth.fullName}</div>
            {eid && <div className="text-[10px] text-muted-foreground/70 mt-0.5">E#{eid}{auth.branchId ? ` B#${auth.branchId}` : ''}{auth.warehouseId ? ` W#${auth.warehouseId}` : ''}</div>}</div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {navItems.map(item => { const Icon = ICONS[item.icon] || Box; const active = page === item.key
              return (<button key={item.key} onClick={() => { setPage(item.key); setSidebarOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${active ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}>
                <Icon className="w-4 h-4" /><span>{item.label}</span></button>)})}
          </nav>

          <div className="p-3 border-t space-y-2">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
            <div className="flex gap-1 justify-center">{locales.map(l => (
              <button key={l.code} onClick={() => setLocale(l.code)} className={`px-2 py-1 rounded-lg text-[10px] font-medium transition ${locale === l.code ? 'bg-blue-600 text-white' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>{l.code.toUpperCase()}</button>))}</div>
            <button onClick={() => { auth.logout(); setPage('dashboard') }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition"><LogOut className="w-4 h-4" />{t(locale, 'logout')}</button></div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          <header className="lg:hidden sticky top-0 z-30 bg-card/90 backdrop-blur-md border-b px-4 py-3 flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground p-1 hover:bg-muted rounded-lg"><Menu className="w-5 h-5" /></button>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center"><Box className="w-3.5 h-3.5 text-white" /></div>
            <span className="font-bold text-sm">{t(locale, 'appName')}</span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-muted rounded-lg">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </header>
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{renderPage()}</div>
        </main>

        {/* DIALOG */}
        <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
          <DialogContent className={dlgType === 'registerItem' ? 'max-w-xl w-[95vw]' : 'max-w-lg w-[95vw]'}>
            <DialogHeader><DialogTitle className="text-base font-bold">{dlgType === 'stockIn' ? 'Stock In' : dlgType === 'registerItem' ? 'Register Item to Inventory' : dlgEdit ? `Edit ${dlgType}` : `New ${dlgType}`}</DialogTitle></DialogHeader>
            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">

              {/* ─── Enterprise ─── */}
              {dlgType === 'enterprise' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Building2}>Details</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Building2}>Name</IconLabel><Input value={dlgData.name||''} onChange={e=>setDlgData({...dlgData,name:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                  <div className="space-y-1"><IconLabel icon={Hash}>Code</IconLabel><Input value={dlgData.code||''} onChange={e=>setDlgData({...dlgData,code:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Mail}>Contact</SectionHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><IconLabel icon={Mail}>Email</IconLabel><Input value={dlgData.contactEmail||''} onChange={e=>setDlgData({...dlgData,contactEmail:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={Phone}>Phone</IconLabel><Input value={dlgData.contactPhone||''} onChange={e=>setDlgData({...dlgData,contactPhone:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={MapPin}>Location</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={MapPin}>Address</IconLabel><Input value={dlgData.address||''} onChange={e=>setDlgData({...dlgData,address:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
              </>}

              {/* ─── Branch ─── */}
              {dlgType === 'branch' && <>
                {role==='super_admin' && <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Building2}>Organization</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Building2}>Enterprise</IconLabel><Select value={dlgData.enterpriseId ? String(dlgData.enterpriseId) : undefined} onValueChange={v=>setDlgData({...dlgData,enterpriseId:parseInt(v)})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{enterprises.map(e=><SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                </div>}
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Tag}>Details</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Tag}>Name</IconLabel><Input value={dlgData.name||''} onChange={e=>setDlgData({...dlgData,name:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                  <div className="space-y-1"><IconLabel icon={Hash}>Code</IconLabel><Input value={dlgData.code||''} onChange={e=>setDlgData({...dlgData,code:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={MapPin}>Location</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={MapPin}>Location</IconLabel><Input value={dlgData.location||''} onChange={e=>setDlgData({...dlgData,location:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
              </>}

              {/* ─── Warehouse ─── */}
              {dlgType === 'warehouse' && <>
                {role==='super_admin' && <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Building2}>Organization</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Building2}>Enterprise</IconLabel><Select value={dlgData.enterpriseId ? String(dlgData.enterpriseId) : undefined} onValueChange={v=>setDlgData({...dlgData,enterpriseId:parseInt(v)})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{enterprises.map(e=><SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                </div>}
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={GitBranch}>Branch</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={GitBranch}>Branch</IconLabel><Select value={dlgData.branchId ? String(dlgData.branchId) : undefined} onValueChange={v=>setDlgData({...dlgData,branchId:parseInt(v)})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{branches.filter(b=>!dlgData.enterpriseId||b.enterpriseId===dlgData.enterpriseId).map(b=><SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Tag}>Details</SectionHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><IconLabel icon={Tag}>Name</IconLabel><Input value={dlgData.name||''} onChange={e=>setDlgData({...dlgData,name:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={Hash}>Code</IconLabel><Input value={dlgData.code||''} onChange={e=>setDlgData({...dlgData,code:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Box}>Capacity</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Box}>Capacity</IconLabel><Input type="number" value={dlgData.capacity||''} onChange={e=>setDlgData({...dlgData,capacity:parseInt(e.target.value)||0})} className="h-8 text-sm rounded-md" /></div>
                </div>
              </>}

              {/* ─── User ─── */}
              {dlgType === 'user' && <>
                {role==='super_admin' && <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Building2}>Organization</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Building2}>Enterprise</IconLabel><Select value={dlgData.enterpriseId ? String(dlgData.enterpriseId) : undefined} onValueChange={v=>setDlgData({...dlgData,enterpriseId:parseInt(v)})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{enterprises.map(e=><SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                </div>}
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={GitBranch}>Assignment</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={GitBranch}>Branch</IconLabel><Select value={dlgData.branchId ? String(dlgData.branchId) : '0'} onValueChange={v=>setDlgData({...dlgData,branchId:parseInt(v)})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value="0">None</SelectItem>{branches.filter(b=>!dlgData.enterpriseId||b.enterpriseId===dlgData.enterpriseId).map(b=><SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Shield}>Role</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Shield}>Role</IconLabel><Select value={dlgData.role || undefined} onValueChange={v=>setDlgData({...dlgData,role:v})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{(MANAGEABLE_ROLES[role!]||[]).map(r=><SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Users}>Identity</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Users}>Full Name</IconLabel><Input value={dlgData.fullName||''} onChange={e=>setDlgData({...dlgData,fullName:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Key}>Credentials</SectionHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><IconLabel icon={Key}>Username</IconLabel><Input value={dlgData.username||''} onChange={e=>setDlgData({...dlgData,username:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={Lock}>Password</IconLabel><Input type="password" value={dlgData.passwordHash||''} onChange={e=>setDlgData({...dlgData,passwordHash:e.target.value})} placeholder="admin123" className="h-8 text-sm rounded-md" /></div>
                  </div>
                </div>
              </>}

              {/* ─── Product ─── */}
              {dlgType === 'product' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Tag}>Details</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Tag}>Name</IconLabel><Input value={dlgData.name||''} onChange={e=>setDlgData({...dlgData,name:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                  <div className="space-y-1"><IconLabel icon={Hash}>SKU</IconLabel><Input value={dlgData.sku||''} onChange={e=>setDlgData({...dlgData,sku:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Box}>Measurement</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Box}>Unit</IconLabel><Select value={dlgData.unit||'pcs'} onValueChange={v=>setDlgData({...dlgData,unit:v})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue /></SelectTrigger><SelectContent className="max-h-60">{SORTED_MEASUREMENTS.map(m=><SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={TrendingUp}>Pricing</SectionHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><IconLabel icon={TrendingUp}>Price</IconLabel><Input type="number" step="0.01" value={dlgData.price||''} onChange={e=>setDlgData({...dlgData,price:parseFloat(e.target.value)||0})} className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={TrendingUp}>Cost</IconLabel><Input type="number" step="0.01" value={dlgData.cost||''} onChange={e=>setDlgData({...dlgData,cost:parseFloat(e.target.value)||0})} className="h-8 text-sm rounded-md" /></div>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={AlertTriangle}>Inventory</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={AlertTriangle}>Reorder Level</IconLabel><Input type="number" value={dlgData.reorderLevel||0} onChange={e=>setDlgData({...dlgData,reorderLevel:parseInt(e.target.value)||0})} className="h-8 text-sm rounded-md" /></div>
                </div>
              </>}

              {/* ─── Register Item (Product + Stock In) ─── */}
              {dlgType === 'registerItem' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Package}>Product Details</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Tag}>Product Name</IconLabel><Input value={dlgData.name||''} onChange={e=>setDlgData({...dlgData,name:e.target.value})} placeholder="e.g. Wireless Mouse" className="h-8 text-sm rounded-md" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><IconLabel icon={Hash}>SKU</IconLabel><Input value={dlgData.sku||''} onChange={e=>setDlgData({...dlgData,sku:e.target.value})} placeholder="e.g. ITEM-001" className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={Box}>Unit</IconLabel><Select value={dlgData.unit||'pcs'} onValueChange={v=>setDlgData({...dlgData,unit:v})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue /></SelectTrigger><SelectContent className="max-h-60">{SORTED_MEASUREMENTS.map(m=><SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div className="space-y-1"><IconLabel icon={Tag}>Category</IconLabel><Select value={dlgData.categoryId ? String(dlgData.categoryId) : undefined} onValueChange={v=>setDlgData({...dlgData,categoryId:parseInt(v)})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="Select category..." /></SelectTrigger><SelectContent>{categories.filter(c=>c.enterpriseId===eid||role==='super_admin').map(c=><SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={TrendingUp}>Pricing</SectionHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><IconLabel icon={TrendingUp}>Selling Price</IconLabel><Input type="number" step="0.01" value={dlgData.price||''} onChange={e=>setDlgData({...dlgData,price:parseFloat(e.target.value)||0})} placeholder="0.00" className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={TrendingUp}>Cost Price</IconLabel><Input type="number" step="0.01" value={dlgData.cost||''} onChange={e=>setDlgData({...dlgData,cost:parseFloat(e.target.value)||0})} placeholder="0.00" className="h-8 text-sm rounded-md" /></div>
                  </div>
                  <div className="space-y-1"><IconLabel icon={AlertTriangle}>Reorder Level</IconLabel><Input type="number" value={dlgData.reorderLevel||0} onChange={e=>setDlgData({...dlgData,reorderLevel:parseInt(e.target.value)||0})} className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={WHIcon}>Stock Registration</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={WHIcon}>Warehouse</IconLabel><Select value={dlgData.warehouseId ? String(dlgData.warehouseId) : undefined} onValueChange={v=>setDlgData({...dlgData,warehouseId:parseInt(v)})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="Select warehouse..." /></SelectTrigger><SelectContent>{warehouses.filter(w=>w.isActive).map(w=><SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><IconLabel icon={ArrowUpFromLine}>Initial Quantity</IconLabel><Input type="number" min="0" value={dlgData.quantity||''} onChange={e=>setDlgData({...dlgData,quantity:parseInt(e.target.value)||0})} placeholder="Enter quantity..." className="h-8 text-sm rounded-md" /></div>
                </div>
              </>}

              {/* ─── Stock ─── */}
              {dlgType === 'stock' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Package}>Product</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Package}>Product</IconLabel><Input value={products.find(p=>p.id===dlgData.productId)?.name||''} disabled className="h-9 rounded-lg bg-muted" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Hash}>Quantity</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Hash}>Current Qty</IconLabel><Input value={dlgData.quantity||0} disabled className="h-9 rounded-lg bg-muted" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={TrendingUp}>Adjustment</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={TrendingUp}>Adjustment (+/-)</IconLabel><Input type="number" value={dlgData.delta||0} onChange={e=>setDlgData({...dlgData,delta:parseInt(e.target.value)||0})} className="h-8 text-sm rounded-md" /></div>
                </div>
              </>}

              {/* ─── Stock In ─── */}
              {dlgType === 'stockIn' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Package}>Product</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Package}>Product</IconLabel>
                    {dlgEdit ? <Input value={products.find(p=>p.id===dlgEdit.productId)?.name||products.find(p=>p.id===dlgData.productId)?.name||''} disabled className="h-9 rounded-lg bg-muted" />
                    : <Select value={dlgData.productId ? String(dlgData.productId) : undefined} onValueChange={v=>setDlgData({...dlgData,productId:parseInt(v)})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="Select product..." /></SelectTrigger><SelectContent className="max-h-60">{products.filter(p=>p.isActive).sort((a,b)=>a.name.localeCompare(b.name)).map(p=><SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.sku})</SelectItem>)}</SelectContent></Select>}
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={WHIcon}>Warehouse</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={WHIcon}>Warehouse</IconLabel><Select value={dlgData.warehouseId ? String(dlgData.warehouseId) : undefined} onValueChange={v=>setDlgData({...dlgData,warehouseId:parseInt(v)})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="Select warehouse..." /></SelectTrigger><SelectContent>{warehouses.filter(w=>w.isActive).map(w=><SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={ArrowUpFromLine}>Quantity In</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={ArrowUpFromLine}>Quantity</IconLabel><Input type="number" min="1" value={dlgData.quantity||''} onChange={e=>setDlgData({...dlgData,quantity:parseInt(e.target.value)||0})} placeholder="Enter quantity..." className="h-8 text-sm rounded-md" /></div>
                  {dlgData.productId && <div className="text-[11px] text-muted-foreground mt-1">Current stock: {stockData.filter(s=>s.productId===dlgData.productId).reduce((sum,s)=>sum+s.quantity,0)} {products.find(p=>p.id===dlgData.productId)?.unit || 'pcs'} across all warehouses</div>}
                </div>
              </>}

              {/* ─── Order ─── */}
              {dlgType === 'order' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={ShoppingCart}>Type</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={ShoppingCart}>Type</IconLabel><Select value={dlgData.type||'purchase'} onValueChange={v=>setDlgData({...dlgData,type:v})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="purchase">Purchase</SelectItem><SelectItem value="sales">Sales</SelectItem></SelectContent></Select></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={WHIcon}>Destination</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={WHIcon}>Warehouse</IconLabel><Select value={dlgData.warehouseId ? String(dlgData.warehouseId) : undefined} onValueChange={v=>setDlgData({...dlgData,warehouseId:parseInt(v)})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{warehouses.map(w=><SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={FileText}>Notes</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={FileText}>Notes</IconLabel><Textarea value={dlgData.notes||''} onChange={e=>setDlgData({...dlgData,notes:e.target.value})} className="rounded-md" /></div>
                </div>
              </>}

              {/* ─── Batch ─── */}
              {dlgType === 'batch' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Hash}>Details</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Hash}>Batch Code</IconLabel><Input value={dlgData.batchCode||''} onChange={e=>setDlgData({...dlgData,batchCode:e.target.value})} placeholder={`BATCH-${Date.now()}`} className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={WHIcon}>Destination</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={WHIcon}>Warehouse</IconLabel><Select value={dlgData.warehouseId ? String(dlgData.warehouseId) : undefined} onValueChange={v=>setDlgData({...dlgData,warehouseId:parseInt(v)})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{warehouses.map(w=><SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Users}>Person</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Users}>Person Name</IconLabel><Input value={dlgData.personName||''} onChange={e=>setDlgData({...dlgData,personName:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><IconLabel icon={Phone}>Phone</IconLabel><Input value={dlgData.personPhone||''} onChange={e=>setDlgData({...dlgData,personPhone:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={Mail}>Email</IconLabel><Input value={dlgData.personEmail||''} onChange={e=>setDlgData({...dlgData,personEmail:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={FileText}>Notes</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={FileText}>Notes</IconLabel><Textarea value={dlgData.notes||''} onChange={e=>setDlgData({...dlgData,notes:e.target.value})} className="rounded-md" /></div>
                </div>
              </>}

              {/* ─── BatchEntry ─── */}
              {dlgType === 'batchEntry' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Package}>Product</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Package}>Product</IconLabel><Select value={dlgData.productId ? String(dlgData.productId) : undefined} onValueChange={v=>setDlgData({...dlgData,productId:parseInt(v)})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{products.map(p=><SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Hash}>Quantity</SectionHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><IconLabel icon={Hash}>Quantity</IconLabel><Input type="number" value={dlgData.quantity||''} onChange={e=>setDlgData({...dlgData,quantity:parseInt(e.target.value)||0})} className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={Box}>Unit</IconLabel><Select value={dlgData.unit||'pcs'} onValueChange={v=>setDlgData({...dlgData,unit:v})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue /></SelectTrigger><SelectContent className="max-h-60">{SORTED_MEASUREMENTS.map(m=><SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={TrendingUp}>Pricing</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={TrendingUp}>Cost Per Unit</IconLabel><Input type="number" step="0.01" value={dlgData.costPerUnit||''} onChange={e=>setDlgData({...dlgData,costPerUnit:parseFloat(e.target.value)||0})} className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={FileText}>Notes</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={FileText}>Notes</IconLabel><Input value={dlgData.notes||''} onChange={e=>setDlgData({...dlgData,notes:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
              </>}

              {/* ─── StockOut ─── */}
              {dlgType === 'stockOut' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={WHIcon}>Warehouse</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={WHIcon}>Warehouse</IconLabel><Select value={dlgData.warehouseId ? String(dlgData.warehouseId) : undefined} onValueChange={v=>setDlgData({...dlgData,warehouseId:parseInt(v)})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{warehouses.map(w=><SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Users}>Person</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Users}>Person Name</IconLabel><Input value={dlgData.personName||''} onChange={e=>setDlgData({...dlgData,personName:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Phone}>Contact</SectionHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><IconLabel icon={Phone}>Phone</IconLabel><Input value={dlgData.personPhone||''} onChange={e=>setDlgData({...dlgData,personPhone:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={Mail}>Email</IconLabel><Input value={dlgData.personEmail||''} onChange={e=>setDlgData({...dlgData,personEmail:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={MapPin}>Location</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={MapPin}>Address</IconLabel><Input value={dlgData.personAddress||''} onChange={e=>setDlgData({...dlgData,personAddress:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={FileText}>Notes</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={FileText}>Notes</IconLabel><Textarea value={dlgData.notes||''} onChange={e=>setDlgData({...dlgData,notes:e.target.value})} className="rounded-md" /></div>
                </div>
              </>}

              {/* ─── StockOutItem ─── */}
              {dlgType === 'stockOutItem' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Package}>Product</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Package}>Product</IconLabel><Select value={dlgData.productId ? String(dlgData.productId) : undefined} onValueChange={v=>setDlgData({...dlgData,productId:parseInt(v)})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{products.map(p=><SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Hash}>Quantity</SectionHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><IconLabel icon={Hash}>Quantity</IconLabel><Input type="number" value={dlgData.quantity||''} onChange={e=>setDlgData({...dlgData,quantity:parseInt(e.target.value)||0})} className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={Box}>Unit</IconLabel><Select value={dlgData.unit||'pcs'} onValueChange={v=>setDlgData({...dlgData,unit:v})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue /></SelectTrigger><SelectContent className="max-h-60">{SORTED_MEASUREMENTS.map(m=><SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={RotateCcw}>Return</SectionHeader>
                  <div className="flex items-center gap-3 py-1"><IconLabel icon={RotateCcw}>Returnable?</IconLabel><Switch checked={dlgData.isReturnable||false} onCheckedChange={v=>setDlgData({...dlgData,isReturnable:v})} /></div>
                  {dlgData.isReturnable && <div className="space-y-1"><IconLabel icon={Calendar}>Return Deadline</IconLabel><CustomDatePicker value={dlgData.returnDeadline||''} onChange={v=>setDlgData({...dlgData,returnDeadline:v})} /></div>}
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={FileText}>Notes</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={FileText}>Notes</IconLabel><Input value={dlgData.notes||''} onChange={e=>setDlgData({...dlgData,notes:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
              </>}

              {/* ─── Supplier ─── */}
              {dlgType === 'supplier' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Truck}>Company</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Truck}>Name</IconLabel><Input value={dlgData.name||''} onChange={e=>setDlgData({...dlgData,name:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Users}>Contact</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Users}>Contact Person</IconLabel><Input value={dlgData.contactPerson||''} onChange={e=>setDlgData({...dlgData,contactPerson:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><IconLabel icon={Mail}>Email</IconLabel><Input value={dlgData.email||''} onChange={e=>setDlgData({...dlgData,email:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={Phone}>Phone</IconLabel><Input value={dlgData.phone||''} onChange={e=>setDlgData({...dlgData,phone:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                  </div>
                </div>
              </>}

              {/* ─── Category ─── */}
              {dlgType === 'category' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Tag}>Details</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Tag}>Name</IconLabel><Input value={dlgData.name||''} onChange={e=>setDlgData({...dlgData,name:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={FileText}>Description</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={FileText}>Description</IconLabel><Input value={dlgData.description||''} onChange={e=>setDlgData({...dlgData,description:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
              </>}

            </div>
            <DialogFooter><Button variant="ghost" onClick={()=>setDlgOpen(false)} className="text-muted-foreground" disabled={dlgSubmitting}>{t(locale,'cancel')}</Button>
              <Button disabled={dlgSubmitting} onClick={async () => {
                setDlgSubmitting(true)
                try {
                const sd = {...dlgData}
                if (dlgType==='user') { if(!sd.enterpriseId) sd.enterpriseId=eid; if(!sd.branchId||sd.branchId===0) sd.branchId=auth.branchId; if(!sd.warehouseId||sd.warehouseId===6) sd.warehouseId=null; if(!sd.passwordHash) sd.passwordHash='admin123' }
                if (dlgType==='product') { if(!sd.enterpriseId) sd.enterpriseId=eid; if(!sd.categoryId||sd.categoryId===0) sd.categoryId=null }
                if (dlgType==='branch'&&!sd.enterpriseId) sd.enterpriseId=eid
                if (dlgType==='warehouse'&&!sd.enterpriseId) sd.enterpriseId=eid
                if (dlgType==='batch'&&!sd.enterpriseId) sd.enterpriseId=eid
                if (dlgType==='stockOut'&&!sd.enterpriseId) sd.enterpriseId=eid
                if (dlgType==='stock') await crud.create('/stock',{productId:dlgData.productId,warehouseId:dlgData.warehouseId,delta:dlgData.delta})
                else if (dlgType==='registerItem') {
                  // Register Item: create product + stock-in in one step
                  if (!dlgData.name?.trim()) { toast({ title: 'Enter product name', variant: 'destructive' }); return }
                  if (!dlgData.sku?.trim()) { toast({ title: 'Enter SKU', variant: 'destructive' }); return }
                  if (!dlgData.warehouseId) { toast({ title: 'Select a warehouse', variant: 'destructive' }); return }
                  if (!dlgData.quantity || dlgData.quantity <= 0) { toast({ title: 'Enter a positive quantity', variant: 'destructive' }); return }
                  if (!eid) { toast({ title: 'No enterprise selected', variant: 'destructive' }); return }
                  const productData = { enterpriseId: eid, name: dlgData.name.trim(), sku: dlgData.sku.trim(), description: dlgData.description || '', categoryId: dlgData.categoryId || null, price: dlgData.price || 0, cost: dlgData.cost || 0, unit: dlgData.unit || 'pcs', reorderLevel: dlgData.reorderLevel || 0, isActive: true }
                  let prodRes: any = null
                  try {
                    prodRes = await apiFetch('/products', { method: 'POST', body: JSON.stringify(productData) })
                  } catch (e: any) {
                    toast({ title: `Failed to create product: ${e.message}`, variant: 'destructive' })
                    return
                  }
                  if (!prodRes || !prodRes.id) { toast({ title: 'Failed to create product - no ID returned', variant: 'destructive' }); return }
                  try {
                    await apiFetch('/stock', { method: 'POST', body: JSON.stringify({ action: 'stockIn', productId: prodRes.id, warehouseId: dlgData.warehouseId, quantity: dlgData.quantity }) })
                    toast({ title: `Registered: ${dlgData.name} with ${dlgData.quantity} ${dlgData.unit || 'pcs'}` })
                  } catch (e: any) {
                    toast({ title: `Product created but stock-in failed: ${e.message}. Add stock manually.`, variant: 'destructive' })
                  }
                  await loadData()
                }
                else if (dlgType==='stockIn') {
                  if (!dlgData.productId) { toast({ title: 'Select a product', variant: 'destructive' }); return }
                  if (!dlgData.warehouseId) { toast({ title: 'Select a warehouse', variant: 'destructive' }); return }
                  if (!dlgData.quantity || dlgData.quantity <= 0) { toast({ title: 'Enter a positive quantity', variant: 'destructive' }); return }
                  try {
                    await apiFetch('/stock', { method: 'POST', body: JSON.stringify({ action: 'stockIn', productId: dlgData.productId, warehouseId: dlgData.warehouseId, quantity: dlgData.quantity }) })
                    toast({ title: `Stock in: +${dlgData.quantity} added` })
                  } catch (e: any) {
                    toast({ title: `Stock in failed: ${e.message}`, variant: 'destructive' })
                  }
                  await loadData()
                }
                else if (dlgType==='batchEntry') {
                  const batchId = sd.batchId
                  if (!batchId) { toast({ title: 'No batch selected', variant: 'destructive' }); return }
                  if (!sd.enterpriseId) sd.enterpriseId = eid
                  await crud.create(`/batches/${batchId}/entry`, sd)
                }
                else if (dlgType==='stockOutItem') {
                  const recorderId = sd.recorderId
                  if (!recorderId) { toast({ title: 'No recorder selected', variant: 'destructive' }); return }
                  if (!sd.enterpriseId) sd.enterpriseId = eid
                  await crud.create(`/stock-out/${recorderId}/item`, sd)
                }
                else if (dlgEdit) await crud.update(dlgType==='stockOut' ? `/stock-out/${dlgEdit.id}` : `/${dlgType}s/${dlgEdit.id}`,sd)
                else if (dlgType==='stockOut') await crud.create('/stock-out', sd)
                else await crud.create(`/${dlgType}s`, sd)
                } catch(e: any) { toast({ title: e.message, variant: 'destructive' }) }
                setDlgSubmitting(false)
                setDlgOpen(false)
              }} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">{dlgSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}{dlgEdit?t(locale,'save'):t(locale,'add')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
