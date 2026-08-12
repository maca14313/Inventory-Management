'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  LayoutDashboard, Package, Warehouse as WHIcon, Users, ShoppingCart, Tag,
  Plus, Trash2, Pencil, Search, AlertTriangle, TrendingUp,
  Box, Truck, Building2, GitBranch, Shield, Globe, LogOut, Loader2,
  Key, Lock, ToggleLeft, ToggleRight, Menu, X, ChevronDown, ChevronRight,
  ArrowUpFromLine, ArrowDownToLine, Layers, RotateCcw, Calendar, Check, Eye, LayoutGrid, List,
  Sun, Moon, Phone, Mail, MapPin, FileText, Hash, ChevronLeft, Sparkles, ChevronRight as ChevronRightIcon, SkipBack, SkipForward, Printer, Filter, CalendarDays,
  MessageSquare, Send, Ban, ClipboardCheck,
  Paperclip, Download, Upload, Image as ImageIcon, File as FileIcon, FileImage,
  Table as TableIcon, Presentation, Video, Music, Archive, Code, Files, Tags,
} from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts'
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
  LayoutDashboard, Package, Warehouse: WHIcon, Users, ShoppingCart, Tag, ClipboardCheck,
  Box, Truck, Building2, GitBranch, Shield, Globe, ArrowUpFromLine, ArrowDownToLine, Layers, RotateCcw,
  Paperclip,
}

const PIE_COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']

interface Enterprise { id: number; name: string; code: string; contactEmail: string; contactPhone: string; address: string; isActive: boolean; maxBranches: number; maxWarehouses: number; maxUsers: number }
interface Branch { id: number; enterpriseId: number; name: string; code: string; location: string; managerName: string; managerEmail: string; isActive: boolean }
interface Warehouse { id: number; enterpriseId: number; branchId: number; name: string; code: string; location: string; capacity: number; managerName: string; isActive: boolean }
interface User { id: number; enterpriseId: number | null; branchId: number | null; warehouseId: number | null; username: string; email: string; fullName: string; role: RoleLevel; isActive: boolean }
interface Category { id: number; enterpriseId: number; name: string; description: string }
interface Condition { id: number; enterpriseId: number; name: string; description: string }
interface Supplier { id: number; enterpriseId: number; name: string; contactPerson: string; email: string; phone: string; address: string }
interface Product { id: number; enterpriseId: number; name: string; sku: string; description: string; categoryId: number | null; price: number; cost: number; unit: string; reorderLevel: number; isActive: boolean }
interface StockItem { id: number; productId: number; warehouseId: number; quantity: number }
interface Order { id: number; enterpriseId: number; type: 'purchase' | 'sales'; supplierId: number | null; warehouseId: number | null; status: string; totalAmount: number; notes: string; createdBy: number | null }
interface AuditEntry { id: number; userId: number | null; enterpriseId: number | null; action: string; entity: string; entityId: number | null; details: string; createdAt: string }
interface Feature { id: number; enterpriseId: number; feature: string; enabled: boolean }
interface Lot { id: number; lotNumber: string; productId: number; warehouseId: number; quantity: number; remainingQty: number; unit: string; costPerUnit: number; supplierName: string | null; source: string; sourceRef: string | null; notes: string | null; receivedDate: string; closedAt: string | null; status: string; createdAt: string; conditionId?: number | null; condition?: { id: number; name: string; description: string } | null }
interface StockInItem { id: number; recorderId: number; productId: number; warehouseId: number; quantity: number; unit: string; costPerUnit: number; notes: string; createdAt: string; conditionId?: number | null; condition?: { id: number; name: string; description: string } | null }
interface StockInRecorder { id: number; enterpriseId: number; warehouseId: number; recorderCode: string; personName: string; personPhone: string; personEmail: string; personAddress: string; notes: string; status: string; items: StockInItem[]; createdAt: string }
interface StockOutItem { id: number; recorderId: number; productId: number; warehouseId: number; quantity: number; unit: string; isReturnable: boolean; returnDeadline: string | null; notes: string; createdAt?: string; updatedAt?: string; conditionId?: number | null; condition?: { id: number; name: string; description: string } | null }
interface StockOutRecorder { id: number; enterpriseId: number; warehouseId: number; recorderCode: string; personName: string; personPhone: string; personEmail: string; personAddress: string; notes: string; status: string; items: StockOutItem[]; createdAt: string }
interface ReturnRecord { id: number; stockOutItemId: number; returnRecorderId: number | null; quantity: number; unit: string; notes: string; returnedAt: string; createdAt: string }
interface ReturnRecorder { id: number; enterpriseId: number; recorderCode: string; personName: string; personPhone: string; personEmail: string; personAddress: string; notes: string; status: string; itemCount: number; totalQty: number; createdAt: string; updatedAt: string; returns?: (ReturnRecord & { stockOutItem?: { product: Product } })[] }
interface NonReturnable { id: number; stockOutItemId: number; nonReturnableRecorderId: number | null; quantity: number; unit: string; reason: string; reasonDetail: string; notes: string; decidedAt: string; createdAt: string; stockOutItem?: { id: number; productId: number; warehouseId: number; quantity: number; unit: string; product?: Product } }
interface NonReturnableRecorder { id: number; enterpriseId: number; recorderCode: string; personName: string; personPhone: string; personEmail: string; personAddress: string; notes: string; status: string; itemCount: number; totalQty: number; createdAt: string; updatedAt: string; nonReturnables?: (NonReturnable & { stockOutItem?: { product: Product } })[] }
interface ReturnableItem extends StockOutItem { returnedQty: number; remainingQty: number; nonReturnableQty: number; product: Product; recorder: StockOutRecorder; returns: ReturnRecord[]; nonReturnables?: NonReturnable[]; createdAt: string }

// ─── Attachments ────────────────────────────────────────────
interface AttachmentMetaField { id: number; attachmentId: number; key: string; value: string; description: string; createdAt: string; updatedAt: string }
interface AttachmentFileEntry { name: string; size: number; mimeType: string }
interface AttachmentRecord {
  id: number; enterpriseId: number; branchId: number | null; warehouseId: number | null
  fileName: string; storedName: string; mimeType: string; originalSize: number; storedSize: number
  isImage: boolean; isMultiFile: boolean; fileCount: number; fileCategory: string; fileListJson: string
  previewData: string
  entityType: string; entityId: number | null
  title: string; description: string; uploadedById: number | null
  metaFields?: AttachmentMetaField[]
  uploadedBy?: { id: number; username: string; fullName: string } | null
  createdAt: string; updatedAt: string
}
const ATTACHMENT_ENTITY_TYPES = [
  { key: 'standalone', label: 'Standalone' },
  { key: 'stock_in', label: 'Stock In' },
  { key: 'stock_in_item', label: 'Stock In Item' },
  { key: 'stock_out', label: 'Stock Out' },
  { key: 'stock_out_item', label: 'Stock Out Item' },
  { key: 'return', label: 'Return' },
  { key: 'non_returnable', label: 'Non-Returnable' },
  { key: 'order', label: 'Order' },
  { key: 'order_item', label: 'Order Item' },
  { key: 'product', label: 'Product' },
] as const
const ATTACHMENT_FILE_CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'image', label: 'Images', icon: 'ImageIcon' },
  { key: 'pdf', label: 'PDFs', icon: 'FileText' },
  { key: 'document', label: 'Documents', icon: 'FileText' },
  { key: 'spreadsheet', label: 'Spreadsheets', icon: 'Table' },
  { key: 'presentation', label: 'Presentations', icon: 'Presentation' },
  { key: 'video', label: 'Videos', icon: 'Video' },
  { key: 'audio', label: 'Audio', icon: 'Music' },
  { key: 'archive', label: 'Archives', icon: 'Archive' },
  { key: 'code', label: 'Code', icon: 'Code' },
  { key: 'other', label: 'Other', icon: 'FileIcon' },
]

// ─── Non-Returnable reasons catalogue ────────────────────────────
// Curated list of why a "should-be-returned" item cannot be returned.
// Each entry is stored in the DB as the `reason` key (e.g. "damaged") and shown
// to the user as the human-readable label (e.g. "Damaged"). The "other" entry is
// always last and triggers a free-text reasonDetail input.
const NON_RETURNABLE_REASONS: { key: string; label: string }[] = [
  { key: 'altered', label: 'Altered' },
  { key: 'assembled', label: 'Assembled' },
  { key: 'biohazard', label: 'Biohazard' },
  { key: 'clearance-item', label: 'Clearance Item' },
  { key: 'code-revealed', label: 'Code Revealed' },
  { key: 'contaminated', label: 'Contaminated' },
  { key: 'counterfeit-suspected', label: 'Counterfeit Suspected' },
  { key: 'custom-made', label: 'Custom Made' },
  { key: 'customer-banned', label: 'Customer Banned' },
  { key: 'damaged', label: 'Damaged' },
  { key: 'damaged-in-transit', label: 'Damaged In Transit' },
  { key: 'dead', label: 'Dead' },
  { key: 'destroyed', label: 'Destroyed' },
  { key: 'dirty', label: 'Dirty' },
  { key: 'disposed', label: 'Disposed' },
  { key: 'duplicate-return', label: 'Duplicate Return' },
  { key: 'electrical-fault', label: 'Electrical Fault' },
  { key: 'excessive-wear', label: 'Excessive Wear' },
  { key: 'expired', label: 'Expired' },
  { key: 'export-restricted', label: 'Export Restricted' },
  { key: 'final-sale', label: 'Final Sale' },
  { key: 'fraud-suspected', label: 'Fraud Suspected' },
  { key: 'free-gift-missing', label: 'Free Gift Missing' },
  { key: 'gift-restriction', label: 'Gift Restriction' },
  { key: 'hazardous-material', label: 'Hazardous Material' },
  { key: 'hygiene-seal-broken', label: 'Hygiene Seal Broken' },
  { key: 'improperly-packaged', label: 'Improperly Packaged' },
  { key: 'incompatible-item', label: 'Incompatible Item' },
  { key: 'laundered', label: 'Laundered' },
  { key: 'liquid-damaged', label: 'Liquid Damaged' },
  { key: 'lost', label: 'Lost' },
  { key: 'manufacturer-defect', label: 'Manufacturer Defect' },
  { key: 'missing-accessories', label: 'Missing Accessories' },
  { key: 'missing-invoice', label: 'Missing Invoice' },
  { key: 'missing-packaging', label: 'Missing Packaging' },
  { key: 'missing-parts', label: 'Missing Parts' },
  { key: 'missing-serial-label', label: 'Missing Serial Label' },
  { key: 'non-original-condition', label: 'Non-Original Condition' },
  { key: 'no-receipt', label: 'No Receipt' },
  { key: 'not-purchased-here', label: 'Not Purchased Here' },
  { key: 'odor-tainted', label: 'Odor Tainted' },
  { key: 'opened', label: 'Opened' },
  { key: 'oversized-return', label: 'Oversized Return' },
  { key: 'policy-abuse', label: 'Policy Abuse' },
  { key: 'quarantine', label: 'Quarantine' },
  { key: 'recalled', label: 'Recalled' },
  { key: 'refurbished', label: 'Refurbished' },
  { key: 'regulated-item', label: 'Regulated Item' },
  { key: 'restocking-fee-zeroes-refund', label: 'Restocking Fee Zeroes Refund' },
  { key: 'return-window-closed', label: 'Return Window Closed' },
  { key: 'seasonal-item', label: 'Seasonal Item' },
  { key: 'serial-mismatch', label: 'Serial Mismatch' },
  { key: 'software-unsealed', label: 'Software Unsealed' },
  { key: 'spoiled', label: 'Spoiled' },
  { key: 'stolen', label: 'Stolen' },
  { key: 'swapped', label: 'Swapped' },
  { key: 'tampered', label: 'Tampered' },
  { key: 'time-lapsed', label: 'Time Lapsed' },
  { key: 'unauthorized-return', label: 'Unauthorized Return' },
  { key: 'unpaid-return-shipping', label: 'Unpaid Return Shipping' },
  { key: 'used', label: 'Used' },
  { key: 'warranty-voided', label: 'Warranty Voided' },
  { key: 'worn-out', label: 'Worn Out' },
  { key: 'wrong-address', label: 'Wrong Address' },
  { key: 'wrong-item-returned', label: 'Wrong Item Returned' },
  { key: 'other', label: 'Other (specify in notes)' },
]
// Quick lookup: reason key → human-readable label
const REASON_LABELS: Record<string, string> = Object.fromEntries(NON_RETURNABLE_REASONS.map(r => [r.key, r.label]))
interface DashboardStats { enterpriseCount: number; branchCount: number; warehouseCount: number; userCount: number; productCount: number; orderCount: number; pendingOrderCount: number; totalStockValue: number; lowStockProducts: { id: number; name: string; sku: string; reorderLevel: number; totalQty: number }[]; totalLots: number; openLots: number; stockInCount: number; stockOutCount: number }
interface AnalyticsData { stockByWarehouse: { name: string; value: number }[]; stockByCategory: { name: string; value: number }[]; topProducts: { name: string; quantity: number; value: number }[]; recentActivity: { id: number; action: string; entity: string; entityId: number | null; details: string; createdAt: string; userName: string | null }[] }

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

// ─── Reusable Attachment Picker ───────────────────────────
// Used inside EVERY record/item form dialog (Stock In, Stock Out, StockOutItem,
// Order, Register/Product, Return, NonReturnable) so the user can:
//   • pick multiple files at once  → zipped server-side into one archive
//   • preview selected files with size + IMG badge + per-file remove button
//   • attach unlimited key-value-description metadata fields to the SAME attachment
//   • set an optional title + description
// This is the SAME feature set as the standalone Upload dialog on the Attachments
// page, so behaviour is consistent everywhere an attachment can be created.
const ATT_PICKER_ACCENTS: Record<string, { ring: string; btn: string; chip: string; file: string; meta: string }> = {
  violet:  { ring: 'border-violet-200 dark:border-violet-500/30',  btn: 'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-500/20 dark:text-violet-300',          chip: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400',         file: 'file:bg-violet-100 file:text-violet-700 hover:file:bg-violet-200 dark:file:bg-violet-500/20 dark:file:text-violet-300',         meta: 'bg-violet-50 dark:bg-violet-500/10' },
  blue:    { ring: 'border-blue-200 dark:border-blue-500/30',      btn: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300',              chip: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',                 file: 'file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 dark:file:bg-blue-500/20 dark:file:text-blue-300',                 meta: 'bg-blue-50 dark:bg-blue-500/10' },
  emerald: { ring: 'border-emerald-200 dark:border-emerald-500/30',btn: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300',  chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',     file: 'file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 dark:file:bg-emerald-500/20 dark:file:text-emerald-300', meta: 'bg-emerald-50 dark:bg-emerald-500/10' },
  rose:    { ring: 'border-rose-200 dark:border-rose-500/30',     btn: 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-300',              chip: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400',                 file: 'file:bg-rose-100 file:text-rose-700 hover:file:bg-rose-200 dark:file:bg-rose-500/20 dark:file:text-rose-300',                 meta: 'bg-rose-50 dark:bg-rose-500/10' },
}

function AttachmentPicker({
  files, onFilesChange,
  metaFields, onMetaChange,
  title, onTitleChange,
  description, onDescChange,
  accent = 'violet',
  hint,
}: {
  files: File[]
  onFilesChange: (f: File[]) => void
  metaFields: { key: string; value: string; description: string }[]
  onMetaChange: (m: { key: string; value: string; description: string }[]) => void
  title: string
  onTitleChange: (s: string) => void
  description: string
  onDescChange: (s: string) => void
  accent?: 'violet' | 'blue' | 'emerald' | 'rose'
  hint?: string
}) {
  const a = ATT_PICKER_ACCENTS[accent] || ATT_PICKER_ACCENTS.violet
  const totalKB = files.reduce((s, f) => s + f.size, 0) / 1024
  return (
    <div className={`bg-muted/30 rounded-lg p-2.5 space-y-2 border ${a.ring}`}>
      <SectionHeader icon={Paperclip}>Attachments</SectionHeader>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}

      {/* File picker (multi) */}
      <input type="file" multiple onChange={e => onFilesChange(Array.from(e.target.files || []))} className={`w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-medium ${a.file}`} />
      <p className="text-[10px] text-muted-foreground">Select one or more files — they'll be zipped into a single archive on upload. Images will be previewable.</p>

      {/* Selected files list with per-file remove */}
      {files.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-muted-foreground font-medium">{files.length} file(s) selected · {totalKB.toFixed(1)} KB total</div>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-card rounded-md px-2 py-1 text-[11px] border">
              <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate" title={f.name}>{f.name}</span>
              <span className="text-muted-foreground text-[10px]">{(f.size / 1024).toFixed(1)} KB</span>
              {f.type.startsWith('image/') && <Badge className={`${a.chip} border-0 text-[9px] px-1 py-0`}><ImageIcon className="w-2.5 h-2.5 mr-0.5 inline" />IMG</Badge>}
              <Button size="sm" variant="ghost" onClick={() => onFilesChange(files.filter((_, j) => j !== i))} className="text-red-500 h-5 w-5 p-0"><X className="w-3 h-3" /></Button>
            </div>
          ))}
        </div>
      )}

      {/* Optional title + description for the attachment record */}
      <div className="grid grid-cols-1 gap-2">
        <div className="space-y-1"><Label className="text-[10px] font-medium text-muted-foreground">Attachment title (optional)</Label><Input value={title} onChange={e => onTitleChange(e.target.value)} placeholder="e.g. Delivery photos, Invoice scan..." className="h-7 text-xs" /></div>
        <div className="space-y-1"><Label className="text-[10px] font-medium text-muted-foreground">Attachment description (optional)</Label><Input value={description} onChange={e => onDescChange(e.target.value)} placeholder="Short note about this attachment..." className="h-7 text-xs" /></div>
      </div>

      {/* Custom metadata key-value-description editor (unlimited rows) */}
      <div className={`${a.meta} rounded-md p-2 space-y-1.5`}>
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-semibold flex items-center gap-1 text-muted-foreground uppercase tracking-wider"><Tags className="w-3 h-3" />Custom Metadata</Label>
          <Button size="sm" variant="ghost" onClick={() => onMetaChange([...metaFields, { key: '', value: '', description: '' }])} className="h-6 text-[11px] px-2 text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-500/20"><Plus className="w-3 h-3 mr-0.5" />Add Field</Button>
        </div>
        <p className="text-[10px] text-muted-foreground">Add unlimited key-value-description fields. These power the advanced content-based filters on every list page.</p>
        {metaFields.length === 0 && <div className="text-[10px] text-muted-foreground italic">No custom fields yet. Click "Add Field" to add key-value-description metadata.</div>}
        {metaFields.map((m, i) => (
          <div key={i} className="space-y-1 bg-card rounded-md p-1.5 border">
            <div className="flex gap-1">
              <Input value={m.key} onChange={e => onMetaChange(metaFields.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} placeholder="Key (e.g. batch)" className="h-7 text-xs flex-1" />
              <Input value={m.value} onChange={e => onMetaChange(metaFields.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="Value (e.g. B-001)" className="h-7 text-xs flex-1" />
              <Button size="sm" variant="ghost" onClick={() => onMetaChange(metaFields.filter((_, j) => j !== i))} className="text-red-500 h-7 w-7 p-0"><X className="w-3 h-3" /></Button>
            </div>
            <Input value={m.description} onChange={e => onMetaChange(metaFields.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Description (optional) — what this field means..." className="h-7 text-xs" />
          </div>
        ))}
      </div>
    </div>
  )
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

// ─── Advanced Collapsible Filter Panel (reusable across all list pages)
// Wraps a set of filter fields in a collapsible container with a header that shows
// the number of active filters and a Clear button. Children are the filter fields.
function FilterPanel({
  activeCount,
  onClear,
  children,
  title = 'Advanced Filters',
  defaultOpen = false,
  resultLabel,
}: {
  activeCount: number
  onClear: () => void
  children: React.ReactNode
  title?: string
  defaultOpen?: boolean
  resultLabel?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="bg-muted/30 rounded-md border">
      <div className="flex items-center justify-between gap-2 p-2">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition">
            <Filter className="w-3.5 h-3.5" />
            <span>{title}</span>
            {activeCount > 0 && <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-0 text-[9px] h-4 px-1.5">{activeCount}</Badge>}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2">
          {resultLabel && <span className="text-[10px] text-muted-foreground">{resultLabel}</span>}
          {activeCount > 0 && <Button size="sm" variant="ghost" onClick={onClear} className="h-7 text-xs text-muted-foreground"><X className="w-3 h-3 mr-0.5" />Clear</Button>}
        </div>
      </div>
      <CollapsibleContent>
        <div className="px-2 pb-2 pt-1 flex flex-wrap items-end gap-2 border-t">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Filter field wrapper: label + child
function FilterField({ label, children, width }: { label: string; children: React.ReactNode; width?: string }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className={width}>{children}</div>
    </div>
  )
}

// ─── PaginatedCombobox: reusable Popover-based combobox with search + pagination.
// Used to replace every large-data <Select> (warehouses, categories, products, suppliers,
// enterprises, branches) so that the dropdown stays fast and usable when the list grows.
// Style mirrors the Returns warehouse combobox (violet accent for selected).
type ComboItem = { value: string; label: string; sublabel?: string; badge?: string }
function PaginatedCombobox({
  items,
  value,
  onChange,
  placeholder = 'Select...',
  allLabel,
  allValue = '_all',
  perPage = 10,
  triggerClassName = '',
  contentClassName = 'w-44',
  disabled = false,
  compact = false,
}: {
  items: ComboItem[]
  value: string | undefined | ''
  onChange: (value: string) => void
  placeholder?: string
  allLabel?: string
  allValue?: string
  perPage?: number
  triggerClassName?: string
  contentClassName?: string
  disabled?: boolean
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Resolve the currently selected item's label for the trigger button.
  const selectedLabel = (() => {
    if (allLabel && (value === allValue || value === '' || value === undefined)) return allLabel
    const it = items.find(i => i.value === value)
    if (it) return it.label
    return ''
  })()

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return items
    return items.filter(i =>
      i.label.toLowerCase().includes(s)
      || (i.sublabel || '').toLowerCase().includes(s)
      || (i.badge || '').toLowerCase().includes(s)
    )
  }, [items, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  const handlePick = (v: string) => {
    onChange(v)
    setOpen(false)
    setSearch('')
    setPage(1)
  }

  const onOpenChange = (o: boolean) => {
    setOpen(o)
    if (!o) { setSearch(''); setPage(1) }
  }

  const sizeCls = compact ? 'h-7 text-[11px] px-2' : 'h-8 text-xs px-2'

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={`${sizeCls} justify-between w-full font-normal ${triggerClassName}`}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`${contentClassName} p-0`} align="start">
        {/* Sticky search */}
        <div className="p-1.5 border-b sticky top-0 bg-popover z-10">
          <div className="relative">
            <Search className="w-3 h-3 text-muted-foreground absolute left-1.5 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="h-7 text-xs pl-6"
            />
          </div>
        </div>
        {/* Scrollable list */}
        <div className="max-h-56 overflow-y-auto">
          {allLabel && (
            <button
              type="button"
              onClick={() => handlePick(allValue)}
              className={`w-full text-left px-2 py-1.5 text-xs hover:bg-violet-50 dark:hover:bg-violet-500/10 ${(value === allValue || value === '' || value === undefined) ? 'bg-violet-50 dark:bg-violet-500/10 font-medium text-violet-700 dark:text-violet-400' : ''}`}
            >
              {allLabel}
            </button>
          )}
          {paged.map(it => (
            <button
              key={it.value}
              type="button"
              onClick={() => handlePick(it.value)}
              className={`w-full text-left px-2 py-1.5 text-xs hover:bg-violet-50 dark:hover:bg-violet-500/10 flex items-center justify-between gap-1.5 ${value === it.value ? 'bg-violet-50 dark:bg-violet-500/10 font-medium text-violet-700 dark:text-violet-400' : ''}`}
            >
              <span className="truncate">{it.label}</span>
              {it.sublabel && <span className="text-[9px] text-muted-foreground font-mono shrink-0">{it.sublabel}</span>}
              {it.badge && <span className="text-[9px] text-muted-foreground shrink-0">{it.badge}</span>}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-2 py-2 text-[11px] text-muted-foreground text-center">No matches.</div>
          )}
        </div>
        {/* Pagination footer (only when more than 1 page) */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-1 px-1.5 py-1 border-t bg-popover">
            <span className="text-[10px] text-muted-foreground">{safePage}/{totalPages} · {filtered.length} items</span>
            <div className="flex items-center gap-0.5">
              <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="h-5 w-5 p-0"><ChevronLeft className="w-2.5 h-2.5" /></Button>
              <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="h-5 w-5 p-0"><ChevronRight className="w-2.5 h-2.5" /></Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
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
  const [conditions, setConditions] = useState<Condition[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  // Task 5: Products + Stock table pagination & search state
  const [productSearch, setProductSearch] = useState('')
  const [productCategoryFilter, setProductCategoryFilter] = useState<number | ''>('')
  const [productConditionFilter, setProductConditionFilter] = useState<number | ''>('')
  const [productStatusFilter, setProductStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const [productLowOnly, setProductLowOnly] = useState(false)
  const [productPage, setProductPage] = useState(1)
  const PRODUCTS_PER_PAGE = 10
  const [stockPage, setStockPage] = useState(1)
  const STOCK_PER_PAGE = 10
  const [stockData, setStockData] = useState<StockItem[]>([])
  // Stock advanced filters
  const [stockWarehouseFilter, setStockWarehouseFilter] = useState<number | ''>('')
  const [stockLowOnly, setStockLowOnly] = useState(false)
  const [stockCategoryFilter, setStockCategoryFilter] = useState<number | ''>('')
  // "Has Attachments" filter for Stock In / Stock Out list pages
  const [stockInHasAttachments, setStockInHasAttachments] = useState(false)
  const [stockInAttSearch, setStockInAttSearch] = useState('')
  const [stockOutHasAttachments, setStockOutHasAttachments] = useState(false)
  const [stockOutAttSearch, setStockOutAttSearch] = useState('')
  // Orders advanced filters
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState('')
  const [orderTypeFilter, setOrderTypeFilter] = useState<'' | 'purchase' | 'sales'>('')
  const [orderAttSearch, setOrderAttSearch] = useState('')
  const [orderWarehouseFilter, setOrderWarehouseFilter] = useState<number | ''>('')
  const [orders, setOrders] = useState<Order[]>([])
  const [auditData, setAuditData] = useState<AuditEntry[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [stockOutData, setStockOutData] = useState<StockOutRecorder[]>([])
  const [stockInData, setStockInData] = useState<StockInRecorder[]>([])
  const [attachmentsData, setAttachmentsData] = useState<AttachmentRecord[]>([])
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(false)

  // ─── Attachments state ────────────────────────────────────
  const [attFilterSearch, setAttFilterSearch] = useState('')
  const [attFilterEntityType, setAttFilterEntityType] = useState<'' | string>('')
  const [attFilterBranchId, setAttFilterBranchId] = useState<number | ''>('')
  const [attFilterWarehouseId, setAttFilterWarehouseId] = useState<number | ''>('')
  const [attFilterIsImage, setAttFilterIsImage] = useState<'' | 'true' | 'false'>('')
  const [attFilterMetaKey, setAttFilterMetaKey] = useState('')
  const [attFilterMetaValue, setAttFilterMetaValue] = useState('')
  const [attFilterDateFrom, setAttFilterDateFrom] = useState('')
  const [attFilterDateTo, setAttFilterDateTo] = useState('')
  // Tab state: 'all' or a fileCategory key (image/pdf/document/...)
  const [attTab, setAttTab] = useState<string>('all')
  // Secondary tab: metadata-key grouping — '_all' or a specific key
  const [attMetaTab, setAttMetaTab] = useState<string>('_all')
  // Distinct metadata keys + category counts (loaded from API)
  const [attMetaKeys, setAttMetaKeys] = useState<string[]>([])
  const [attCategoryCounts, setAttCategoryCounts] = useState<Record<string, number>>({})
  const [attPage, setAttPage] = useState(1)
  const [attPerPage, setAttPerPage] = useState(20)
  // Upload dialog — supports MULTIPLE files (zipped together as one attachment)
  const [attUpload, setAttUpload] = useState<{
    open: boolean; submitting: boolean
    files: File[]
    title: string; description: string
    entityType: string; entityId: string
    branchId: string; warehouseId: string
    enterpriseId: string  // super_admin picks the owning enterprise
    metaFields: { key: string; value: string; description: string }[]
  }>({ open: false, submitting: false, files: [], title: '', description: '', entityType: 'standalone', entityId: '', branchId: '', warehouseId: '', enterpriseId: '', metaFields: [] })
  // Edit dialog
  const [attEdit, setAttEdit] = useState<{
    open: boolean; submitting: boolean; attachment: AttachmentRecord | null
    title: string; description: string; entityType: string; entityId: string
    metaFields: { key: string; value: string; description: string }[]
  }>({ open: false, submitting: false, attachment: null, title: '', description: '', entityType: 'standalone', entityId: '', metaFields: [] })
  // Preview dialog (full-size image)
  const [attPreview, setAttPreview] = useState<{ open: boolean; attachment: AttachmentRecord | null; fileIndex: number }>({ open: false, attachment: null, fileIndex: 0 })
  // "Attach to existing record" dialog — lets the user attach files to ANY existing
  // record or item (stock_in, stock_in_item, stock_out, stock_out_item, return,
  // non_returnable, order, order_item, product) after it has been created. This is
  // critical for stock_in_item and order_item which are created inline (no create
  // dialog) so they had no way to receive attachments otherwise.
  const [attLink, setAttLink] = useState<{
    open: boolean; submitting: boolean
    entityType: string; entityId: number
    entityLabel: string; warehouseId?: number
    files: File[]; title: string; description: string
    metaFields: { key: string; value: string; description: string }[]
  }>({ open: false, submitting: false, entityType: '', entityId: 0, entityLabel: '', files: [], title: '', description: '', metaFields: [] })
  const openAttLink = (entityType: string, entityId: number, entityLabel: string, warehouseId?: number) =>
    setAttLink({ open: true, submitting: false, entityType, entityId, entityLabel, warehouseId, files: [], title: '', description: '', metaFields: [] })

  // Lots dialog state (Change 2)
  const [lotsData, setLotsData] = useState<Lot[]>([])
  const [lotsDialog, setLotsDialog] = useState<{ open: boolean; productId: number; warehouseId: number; productName: string }>({ open: false, productId: 0, warehouseId: 0, productName: '' })
  const [lotsPage, setLotsPage] = useState(1)
  const [lotsLoading, setLotsLoading] = useState(false)
  const LOTS_PER_PAGE = 8

  // Products Tab 2: multi-item register rows
  const [registerRows, setRegisterRows] = useState<{ name: string; sku: string; categoryId: number | null; conditionId: number | null; unit: string; price: number; cost: number; reorderLevel: number; quantity: number; costPerUnit: number; supplierName: string; notes: string }[]>([])
  const [registerWarehouseId, setRegisterWarehouseId] = useState<number | null>(null)
  const [registerSubmitting, setRegisterSubmitting] = useState(false)
  // Top-level supplier/person info for the whole registration batch (mirrors Stock In/Out recorder header)
  const [registerSupplier, setRegisterSupplier] = useState<{ personName: string; personPhone: string; personEmail: string; personAddress: string; notes: string }>({ personName: '', personPhone: '', personEmail: '', personAddress: '', notes: '' })

  // AI Assistant widget
  const [aiChat, setAiChat] = useState<{ open: boolean; messages: { role: 'user' | 'assistant'; content: string }[]; input: string; loading: boolean }>({
    open: false,
    messages: [{ role: 'assistant', content: 'Hello! I can help you with inventory questions. Ask me about stock, products, or warehouses.' }],
    input: '',
    loading: false,
  })

  // ─── Returns page state ─────────────────────────────────────────
  // 'records' = the 3rd top-level tab showing created group-return (ReturnRecorder) records
  const [returnsTab, setReturnsTab] = useState<'flagged' | 'not_flagged' | 'records' | 'non_returnable'>('flagged')
  const [returnsData, setReturnsData] = useState<ReturnableItem[]>([])
  const [returnsLoading, setReturnsLoading] = useState(false)
  const [returnsPage, setReturnsPage] = useState(1)
  const RETURNS_PER_PAGE = 8
  // Pagination for the "Group Return by Person" person-button bar
  const [returnsGroupPage, setReturnsGroupPage] = useState(1)
  const RETURNS_GROUP_PER_PAGE = 8
  // Pagination for the Return Records (3rd tab) list
  const [returnRecordsPage, setReturnRecordsPage] = useState(1)
  const RETURN_RECORDS_PER_PAGE = 6
  // Searchable warehouse combobox state (Returns filter) — handles many warehouses
  const [returnsWhComboOpen, setReturnsWhComboOpen] = useState(false)
  const [returnsWhComboSearch, setReturnsWhComboSearch] = useState('')
  const [returnsSearch, setReturnsSearch] = useState('')
  const [returnsWarehouseFilter, setReturnsWarehouseFilter] = useState<number | ''>('')
  const [returnsFilterDateFrom, setReturnsFilterDateFrom] = useState('')
  const [returnsFilterDateTo, setReturnsFilterDateTo] = useState('')
  const [returnsFilterRecorder, setReturnsFilterRecorder] = useState('')
  const [returnsFilterProgress, setReturnsFilterProgress] = useState<'' | 'none' | 'partial' | 'full'>('')
  const [returnsFilterCategory, setReturnsFilterCategory] = useState<number | ''>('')
  const [returnsFilterCondition, setReturnsFilterCondition] = useState<number | ''>('')
  const [returnsAttSearch, setReturnsAttSearch] = useState('')
  const [returnsFilterPerson, setReturnsFilterPerson] = useState('')
  // Single-item return dialog
  const [returnDlg, setReturnDlg] = useState<{ open: boolean; item: ReturnableItem | null; qty: number; notes: string; submitting: boolean; pendingFiles: File[]; pendingMetaFields: { key: string; value: string; description: string }[]; pendingAttTitle: string; pendingAttDesc: string }>({ open: false, item: null, qty: 0, notes: '', submitting: false, pendingFiles: [], pendingMetaFields: [], pendingAttTitle: '', pendingAttDesc: '' })
  // Source-record dialog (shows the StockOutRecorder that this item belongs to + return history)
  const [returnSourceDlg, setReturnSourceDlg] = useState<{ open: boolean; loading: boolean; item: ReturnableItem | null }>({ open: false, loading: false, item: null })
  // Group return dialog (mirrors Stock-In recorder creation: person header + warehouse + items)
  // mode='prefilled' → opened from a person button (items pre-filled from that person)
  // mode='new'       → opened from the "New Group Return" button (empty person + item picker across ALL returnable items)
  const [groupReturnDlg, setGroupReturnDlg] = useState<{
    open: boolean; submitting: boolean; mode: 'prefilled' | 'new'; personKey: string;
    personName: string; personPhone: string; personEmail: string; personAddress: string; notes: string;
    warehouseId: number | null;
    items: { item: ReturnableItem; qty: number; selected: boolean }[];
    availableItems: ReturnableItem[]; itemSearch: string; loadingAvailable: boolean;
    availPage: number; itemsPage: number;
    // Advanced filters for the item picker (NEW mode) — lets the user find what they want
    filterWarehouse: number | '';
    filterCategory: number | '';
    filterCondition: number | '';
    filterPerson: string;
    filterDateFrom: string;
    filterDateTo: string;
    filterProgress: '' | 'none' | 'partial' | 'full';
    filterFlagged: '' | 'flagged' | 'not_flagged';
    whComboOpen: boolean;
    whComboSearch: string;
    availableFlaggedIds: number[]; // ids among availableItems that came from the 'flagged' tab
  }>({ open: false, submitting: false, mode: 'new', personKey: '', personName: '', personPhone: '', personEmail: '', personAddress: '', notes: '', warehouseId: null, items: [], availableItems: [], itemSearch: '', loadingAvailable: false, availPage: 1, itemsPage: 1, filterWarehouse: '', filterCategory: '', filterCondition: '', filterPerson: '', filterDateFrom: '', filterDateTo: '', filterProgress: '', filterFlagged: '', whComboOpen: false, whComboSearch: '', availableFlaggedIds: [] })
  // Return Recorder records (created by group returns — mirrors Stock-In recorders list)
  const [groupReturnRecords, setGroupReturnRecords] = useState<ReturnRecorder[]>([])
  const [groupReturnRecordsLoading, setGroupReturnRecordsLoading] = useState(false)
  const [expandedReturnRec, setExpandedReturnRec] = useState<number | null>(null)

  // ─── Non-Returnables state (mirrors returns state — for the "mark as non-returnable" feature) ──
  // 'flagged' = the items to mark (reuses the same flagged StockOutItem list as Returns);
  // 'records' = the 4th tab showing NR- records.
  const [nonRetTab, setNonRetTab] = useState<'flagged' | 'records'>('flagged')
  const [nonRetData, setNonRetData] = useState<ReturnableItem[]>([])
  const [nonRetLoading, setNonRetLoading] = useState(false)
  const [nonRetPage, setNonRetPage] = useState(1)
  const NON_RET_PER_PAGE = 8
  // Pagination for the "Group Non-Returnable by Person" person-button bar
  const [nonRetGroupPage, setNonRetGroupPage] = useState(1)
  const NON_RET_GROUP_PER_PAGE = 8
  // Pagination for the Non-Returnable Records (4th tab) list
  const [nonRetRecordsPage, setNonRetRecordsPage] = useState(1)
  const NON_RET_RECORDS_PER_PAGE = 6
  // Searchable warehouse combobox state (Non-Returnable filter) — handles many warehouses
  const [nonRetWhComboOpen, setNonRetWhComboOpen] = useState(false)
  const [nonRetWhComboSearch, setNonRetWhComboSearch] = useState('')
  // Advanced filter state (mirrors returns filters)
  const [nonRetSearch, setNonRetSearch] = useState('')
  const [nonRetWarehouseFilter, setNonRetWarehouseFilter] = useState<number | ''>('')
  const [nonRetFilterDateFrom, setNonRetFilterDateFrom] = useState('')
  const [nonRetFilterDateTo, setNonRetFilterDateTo] = useState('')
  const [nonRetFilterRecorder, setNonRetFilterRecorder] = useState('')
  const [nonRetFilterProgress, setNonRetFilterProgress] = useState<'' | 'none' | 'partial' | 'full'>('')
  const [nonRetFilterCategory, setNonRetFilterCategory] = useState<number | ''>('')
  const [nonRetFilterCondition, setNonRetFilterCondition] = useState<number | ''>('')
  const [nonRetFilterPerson, setNonRetFilterPerson] = useState('')
  const [nonRetFilterReason, setNonRetFilterReason] = useState<string>('')
  const [nonRetAttSearch, setNonRetAttSearch] = useState('')
  // Single-item "mark as non-returnable" dialog (mirrors returnDlg)
  const [nonRetDlg, setNonRetDlg] = useState<{ open: boolean; item: ReturnableItem | null; qty: number; reason: string; reasonDetail: string; notes: string; submitting: boolean; pendingFiles: File[]; pendingMetaFields: { key: string; value: string; description: string }[]; pendingAttTitle: string; pendingAttDesc: string }>({ open: false, item: null, qty: 0, reason: '', reasonDetail: '', notes: '', submitting: false, pendingFiles: [], pendingMetaFields: [], pendingAttTitle: '', pendingAttDesc: '' })
  // Group "mark as non-returnable" dialog (mirrors groupReturnDlg)
  // mode='prefilled' → opened from a person button (items pre-filled from that person)
  // mode='new'       → opened from the "New Group Non-Returnable" button (empty person + item picker)
  const [groupNonRetDlg, setGroupNonRetDlg] = useState<{
    open: boolean; submitting: boolean; mode: 'prefilled' | 'new'; personKey: string;
    personName: string; personPhone: string; personEmail: string; personAddress: string; notes: string;
    warehouseId: number | null;
    items: { item: ReturnableItem; qty: number; reason: string; reasonDetail: string; selected: boolean }[];
    availableItems: ReturnableItem[]; itemSearch: string; loadingAvailable: boolean;
    availPage: number; itemsPage: number;
    // Advanced filters for the item picker (NEW mode)
    filterWarehouse: number | '';
    filterCategory: number | '';
    filterCondition: number | '';
    filterPerson: string;
    filterDateFrom: string;
    filterDateTo: string;
    filterProgress: '' | 'none' | 'partial' | 'full';
    filterFlagged: '' | 'flagged' | 'not_flagged';
    whComboOpen: boolean;
    whComboSearch: string;
    availableFlaggedIds: number[];
  }>({ open: false, submitting: false, mode: 'new', personKey: '', personName: '', personPhone: '', personEmail: '', personAddress: '', notes: '', warehouseId: null, items: [], availableItems: [], itemSearch: '', loadingAvailable: false, availPage: 1, itemsPage: 1, filterWarehouse: '', filterCategory: '', filterCondition: '', filterPerson: '', filterDateFrom: '', filterDateTo: '', filterProgress: '', filterFlagged: '', whComboOpen: false, whComboSearch: '', availableFlaggedIds: [] })
  // Non-Returnable Recorder records (NR- records created by group non-returnable)
  const [groupNonRetRecords, setGroupNonRetRecords] = useState<NonReturnableRecorder[]>([])
  const [groupNonRetRecordsLoading, setGroupNonRetRecordsLoading] = useState(false)
  const [expandedNonRetRec, setExpandedNonRetRec] = useState<number | null>(null)

  const [dlgOpen, setDlgOpen] = useState(false)
  const [dlgType, setDlgType] = useState('')
  const [dlgData, setDlgData] = useState<any>({})
  const [dlgEdit, setDlgEdit] = useState<any>(null)
  const [stockOutMode, setStockOutMode] = useState<'pic' | 'table'>('pic')
  const [stockInMode, setStockInMode] = useState<'pic' | 'table'>('pic')
  const [expandedOut, setExpandedOut] = useState<number | null>(null)
  const [expandingOutId, setExpandingOutId] = useState<number | null>(null)
  const [expandedIn, setExpandedIn] = useState<number | null>(null)
  const [expandingInId, setExpandingInId] = useState<number | null>(null)

  // Stock Out Pick mode: search + per-product inputs
  const [stockOutSearch, setStockOutSearch] = useState('')
  const [stockOutPickInputs, setStockOutPickInputs] = useState<Record<string, { qty: number; unit: string; isReturnable: boolean; returnDeadline: string; conditionId: number | null }>>({})
  // Stock Out Table mode: per-product row inputs (keyed by productId)
  const [stockOutTableRowInputs, setStockOutTableRowInputs] = useState<Record<string, { qty: number; unit: string; isReturnable: boolean; returnDeadline: string; conditionId: number | null }>>({})
  // Pagination
  const [stockOutItemPage, setStockOutItemPage] = useState(1)
  const [stockOutProductPage, setStockOutProductPage] = useState(1)
  const STOCK_OUT_ITEMS_PER_PAGE = 10
  const STOCK_OUT_PRODUCTS_PER_PAGE = 8
  // Loading states for buttons
  const [submittingRecorder, setSubmittingRecorder] = useState<number | null>(null)
  const [addingItem, setAddingItem] = useState(false)
  const [dlgSubmitting, setDlgSubmitting] = useState(false)
  // Stock Out recorder list filters & pagination
  const [stockOutRecPage, setStockOutRecPage] = useState(1)
  const STOCK_OUT_REC_PER_PAGE = 5
  const [stockOutFilterDateFrom, setStockOutFilterDateFrom] = useState('')
  const [stockOutFilterDateTo, setStockOutFilterDateTo] = useState('')
  const [stockOutFilterStatus, setStockOutFilterStatus] = useState('')
  const [stockOutFilterPerson, setStockOutFilterPerson] = useState('')
  const [stockOutFilterWarehouse, setStockOutFilterWarehouse] = useState<number | ''>('')
  const [stockOutFilterCondition, setStockOutFilterCondition] = useState<number | ''>('')
  const [stockOutFilterSearch, setStockOutFilterSearch] = useState('')
  // Pending items per recorder (local array before API submission)
  const [pendingStockOutItems, setPendingStockOutItems] = useState<Record<number, { tempId: number; productId: number; warehouseId: number; quantity: number; unit: string; isReturnable: boolean; returnDeadline: string | null; notes: string; conditionId: number | null }[]>>({})
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
            body: JSON.stringify({ productId: item.productId, warehouseId: item.warehouseId, quantity: item.quantity, unit: item.unit, isReturnable: item.isReturnable, returnDeadline: item.returnDeadline || null, notes: item.notes || '', conditionId: item.conditionId ?? null, enterpriseId })
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
  const getRowInput = (productId: number) => stockOutTableRowInputs[String(productId)] || { qty: 1, unit: 'pcs', isReturnable: false, returnDeadline: '', conditionId: null }
  const updateRowInput = (productId: number, updates: Partial<{ qty: number; unit: string; isReturnable: boolean; returnDeadline: string; conditionId: number | null }>) => {
    setStockOutTableRowInputs(prev => ({ ...prev, [String(productId)]: { ...((prev[String(productId)]) || { qty: 1, unit: 'pcs', isReturnable: false, returnDeadline: '', conditionId: null }), ...updates } }))
  }
  // Helper: get available stock for a product in a warehouse
  const getAvailableStock = (productId: number, warehouseId: number): number => {
    const s = stockData.find(s => s.productId === productId && s.warehouseId === warehouseId)
    return s ? s.quantity : 0
  }

  // ─── Stock In state (mirrors Stock Out, emerald theme) ─────────────
  const [stockInSearch, setStockInSearch] = useState('')
  const [stockSearch, setStockSearch] = useState('')
  const [stockInPickInputs, setStockInPickInputs] = useState<Record<string, { productId: number; qty: number; unit: string; costPerUnit: number; notes: string; conditionId: number | null }>>({})
  const [stockInTableRowInputs, setStockInTableRowInputs] = useState<Record<string, { qty: number; unit: string; costPerUnit: number; notes: string; conditionId: number | null }>>({})
  const [stockInItemPage, setStockInItemPage] = useState(1)
  const [stockInProductPage, setStockInProductPage] = useState(1)
  const STOCK_IN_ITEMS_PER_PAGE = 10
  const STOCK_IN_PRODUCTS_PER_PAGE = 8
  const [stockInRecPage, setStockInRecPage] = useState(1)
  const STOCK_IN_REC_PER_PAGE = 5
  const [stockInFilterDateFrom, setStockInFilterDateFrom] = useState('')
  const [stockInFilterDateTo, setStockInFilterDateTo] = useState('')
  const [stockInFilterStatus, setStockInFilterStatus] = useState('')
  const [stockInFilterPerson, setStockInFilterPerson] = useState('')
  const [stockInFilterWarehouse, setStockInFilterWarehouse] = useState<number | ''>('')
  const [stockInFilterCondition, setStockInFilterCondition] = useState<number | ''>('')
  const [stockInFilterSearch, setStockInFilterSearch] = useState('')
  const [pendingStockInItems, setPendingStockInItems] = useState<Record<number, { tempId: number; productId: number; warehouseId: number; quantity: number; unit: string; costPerUnit: number; notes: string; conditionId: number | null }[]>>({})
  const getPendingInItems = (recorderId: number) => pendingStockInItems[recorderId] || []
  const addPendingInItem = (recorderId: number, item: { productId: number; warehouseId: number; quantity: number; unit: string; costPerUnit: number; notes: string; conditionId: number | null }) => {
    setPendingStockInItems(prev => {
      const existing = (prev[recorderId] || [])
      const dupIdx = existing.findIndex(i => i.productId === item.productId && i.unit === item.unit && i.warehouseId === item.warehouseId)
      if (dupIdx >= 0) {
        const updated = [...existing]
        updated[dupIdx] = { ...updated[dupIdx], quantity: updated[dupIdx].quantity + item.quantity }
        return { ...prev, [recorderId]: updated }
      }
      return { ...prev, [recorderId]: [...existing, { ...item, tempId: Date.now() + Math.random() }] }
    })
  }
  const removePendingInItem = (recorderId: number, tempId: number) => {
    setPendingStockInItems(prev => ({
      ...prev,
      [recorderId]: (prev[recorderId] || []).filter(i => i.tempId !== tempId)
    }))
  }
  const clearPendingInItems = (recorderId: number) => {
    setPendingStockInItems(prev => ({ ...prev, [recorderId]: [] }))
  }
  const submitPendingInItems = async (recorderId: number, enterpriseId: number) => {
    const items = pendingStockInItems[recorderId] || []
    if (items.length === 0) { toast({ title: 'No items to submit', variant: 'destructive' }); return }
    setSubmittingRecorder(recorderId)
    let submittedCount = 0
    let lastError = ''
    try {
      for (const item of items) {
        try {
          await apiFetch(`/stock-in/${recorderId}/item`, {
            method: 'POST',
            body: JSON.stringify({ productId: item.productId, warehouseId: item.warehouseId, quantity: item.quantity, unit: item.unit, costPerUnit: item.costPerUnit, notes: item.notes || '', conditionId: item.conditionId ?? null, enterpriseId })
          })
          submittedCount++
        } catch (e: any) {
          lastError = e.message
          break
        }
      }
      if (submittedCount > 0) {
        toast({ title: `${submittedCount} item(s) added successfully${lastError ? `. Stopped: ${lastError}` : ''}` })
        clearPendingInItems(recorderId)
      } else {
        toast({ title: lastError || 'Failed to add items', variant: 'destructive' })
      }
      await loadData(false)
    } catch (e: any) { toast({ title: e.message, variant: 'destructive' }); await loadData(false) }
    setSubmittingRecorder(null)
  }
  const getInRowInput = (productId: number) => stockInTableRowInputs[String(productId)] || { qty: 1, unit: 'pcs', costPerUnit: 0, notes: '', conditionId: null }
  const updateInRowInput = (productId: number, updates: Partial<{ qty: number; unit: string; costPerUnit: number; notes: string; conditionId: number | null }>) => {
    setStockInTableRowInputs(prev => ({ ...prev, [String(productId)]: { ...((prev[String(productId)]) || { qty: 1, unit: 'pcs', costPerUnit: 0, notes: '', conditionId: null }), ...updates } }))
  }

  // ─── Lots dialog (Change 2) ─────────────────────────────────────────
  const viewLots = async (productId: number, warehouseId: number, productName: string) => {
    setLotsDialog({ open: true, productId, warehouseId, productName })
    setLotsData([]); setLotsPage(1); setLotsLoading(true)
    try {
      const res = await fetch(`${BASE}/api/lots?productId=${productId}&warehouseId=${warehouseId}`, { headers: { ...auth.getAuthHeaders() } })
      const data = await res.json()
      setLotsData(Array.isArray(data) ? data : [])
    } catch (e: any) {
      console.error('viewLots error:', e)
      setLotsData([])
    }
    setLotsLoading(false)
  }

  // ─── AI assistant: send message ─────────────────────────────────────
  const sendAiMessage = async () => {
    const msg = aiChat.input.trim()
    if (!msg || aiChat.loading) return
    const newMessages = [...aiChat.messages, { role: 'user' as const, content: msg }]
    setAiChat({ ...aiChat, messages: newMessages, input: '', loading: true })
    try {
      const res = await fetch(`${BASE}/api/ai-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth.getAuthHeaders() },
        body: JSON.stringify({ message: msg })
      })
      const data = await res.json()
      const reply = data.reply || 'Sorry, I could not process that.'
      setAiChat({ ...aiChat, messages: [...newMessages, { role: 'assistant', content: reply }], loading: false })
    } catch (e: any) {
      setAiChat({ ...aiChat, messages: [...newMessages, { role: 'assistant', content: `Error: ${e.message}` }], loading: false })
    }
  }

  // ─── Returns: fetch list of returnable items for active tab ────────
  // 'records' tab is handled separately (shows ReturnRecorder records), so this fetch
  // is only called for 'flagged' / 'not_flagged'. The union type keeps the call-site happy.
  const loadReturns = useCallback(async (tab: 'flagged' | 'not_flagged' | 'records' | 'non_returnable') => {
    if (tab === 'records' || tab === 'non_returnable') return
    setReturnsLoading(true)
    try {
      const params = new URLSearchParams({ tab })
      const res = await fetch(`${BASE}/api/returns?${params.toString()}`, { headers: { ...auth.getAuthHeaders() } })
      const data = await res.json()
      setReturnsData(Array.isArray(data) ? data : [])
    } catch (e: any) {
      console.error('loadReturns error:', e)
      setReturnsData([])
    }
    setReturnsLoading(false)
  }, [auth])

  // ─── Returns: load group-return recorder records (mirrors Stock-In recorders list) ────
  const loadGroupReturnRecords = useCallback(async () => {
    setGroupReturnRecordsLoading(true)
    try {
      const res = await fetch(`${BASE}/api/returns?recorders=1`, { headers: { ...auth.getAuthHeaders() } })
      const data = await res.json()
      setGroupReturnRecords(Array.isArray(data) ? data : [])
    } catch (e: any) {
      console.error('loadGroupReturnRecords error:', e)
      setGroupReturnRecords([])
    }
    setGroupReturnRecordsLoading(false)
  }, [auth])

  // Fetch returns whenever the Returns page is opened or the tab changes.
  // 'records' tab shows ReturnRecorder records (loaded via loadGroupReturnRecords),
  // 'non_returnable' tab is handled by the separate non-returnable loader.
  // So we skip the per-item returns fetch when either of those tabs is active.
  useEffect(() => {
    if (!auth.isLoggedIn || page !== 'returns') return
    setReturnsPage(1)
    setReturnsGroupPage(1)
    setReturnRecordsPage(1)
    if (returnsTab !== 'records' && returnsTab !== 'non_returnable') loadReturns(returnsTab)
    loadGroupReturnRecords()
  }, [auth.isLoggedIn, page, returnsTab, loadReturns, loadGroupReturnRecords])

  // ─── Returns: open single-item return dialog (qty defaults to full remaining) ────
  const openReturnDlg = (item: ReturnableItem) => {
    setReturnDlg({ open: true, item, qty: item.remainingQty, notes: '', submitting: false, pendingFiles: [], pendingMetaFields: [], pendingAttTitle: '', pendingAttDesc: '' })
  }
  // ─── Returns: submit single-item return ────
  const submitReturn = async () => {
    const it = returnDlg.item
    if (!it) return
    if (!returnDlg.qty || returnDlg.qty <= 0) { toast({ title: 'Quantity must be positive', variant: 'destructive' }); return }
    if (returnDlg.qty > it.remainingQty) { toast({ title: `Only ${it.remainingQty} remaining to return`, variant: 'destructive' }); return }
    setReturnDlg(s => ({ ...s, submitting: true }))
    try {
      const createdReturn = await apiFetch(`/returns`, { method: 'POST', body: JSON.stringify({ stockOutItemId: it.id, quantity: returnDlg.qty, notes: returnDlg.notes || undefined }) })
      // Upload return-level attachments (entityType='return', entityId=createdReturn.id)
      if (returnDlg.pendingFiles?.length && createdReturn?.id) {
        await uploadAttachmentsFor('return', createdReturn.id, it.warehouseId, returnDlg.pendingFiles, { metaFields: returnDlg.pendingMetaFields, title: returnDlg.pendingAttTitle, description: returnDlg.pendingAttDesc })
      }
      toast({ title: `Returned ${returnDlg.qty} ${it.unit} of ${it.product.name}` })
      setReturnDlg({ open: false, item: null, qty: 0, notes: '', submitting: false, pendingFiles: [], pendingMetaFields: [], pendingAttTitle: '', pendingAttDesc: '' })
      await loadReturns(returnsTab)
      await loadData(false) // refresh dashboard + stock to reflect the stock-in
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
      setReturnDlg(s => ({ ...s, submitting: false }))
    }
  }
  // ─── Returns: open source-record dialog (fetch fresh data for the item) ────
  const openReturnSourceDlg = async (item: ReturnableItem) => {
    setReturnSourceDlg({ open: true, loading: true, item })
    try {
      const res = await fetch(`${BASE}/api/returns/${item.id}`, { headers: { ...auth.getAuthHeaders() } })
      const data = await res.json()
      if (data && data.id) setReturnSourceDlg({ open: true, loading: false, item: data as ReturnableItem })
      else setReturnSourceDlg({ open: true, loading: false, item })
    } catch (e: any) {
      console.error('openReturnSourceDlg error:', e)
      setReturnSourceDlg({ open: true, loading: false, item })
    }
  }
  // ─── Returns: open group-return dialog for a given person key (prefilled mode) ────
  // Mirrors Stock-In recorder creation: pre-fills the person header + warehouse from the
  // first item's existing recorder so the user can review/edit before submitting the group return.
  const openGroupReturnDlg = (personKey: string, items: ReturnableItem[]) => {
    const first = items[0]
    const rec = first?.recorder
    setGroupReturnDlg({
      open: true, submitting: false, mode: 'prefilled', personKey,
      personName: rec?.personName || personKey,
      personPhone: rec?.personPhone || '',
      personEmail: rec?.personEmail || '',
      personAddress: rec?.personAddress || '',
      notes: '',
      warehouseId: first?.warehouseId ?? null,
      items: items.map(it => ({ item: it, qty: it.remainingQty, selected: true })),
      availableItems: [], itemSearch: '', loadingAvailable: false,
      availPage: 1, itemsPage: 1,
      filterWarehouse: '', filterCategory: '', filterCondition: '', filterPerson: '', filterDateFrom: '', filterDateTo: '', filterProgress: '', filterFlagged: '', whComboOpen: false, whComboSearch: '', availableFlaggedIds: [],
    })
  }
  // ─── Returns: open a NEW group-return record from scratch (new mode) ────
  // Just like Stock-In "New Receipt": empty person header + an item picker that lists ALL
  // returnable stock-out items (both tabs) so the user can build a brand-new group return
  // combining items from different suppliers/persons/recorders.
  const openNewGroupReturnDlg = async () => {
    setGroupReturnDlg({ open: true, submitting: false, mode: 'new', personKey: '', personName: '', personPhone: '', personEmail: '', personAddress: '', notes: '', warehouseId: null, items: [], availableItems: [], itemSearch: '', loadingAvailable: true, availPage: 1, itemsPage: 1, filterWarehouse: '', filterCategory: '', filterCondition: '', filterPerson: '', filterDateFrom: '', filterDateTo: '', filterProgress: '', filterFlagged: '', whComboOpen: false, whComboSearch: '', availableFlaggedIds: [] })
    try {
      const h = { ...auth.getAuthHeaders() }
      const [flagged, notFlagged] = await Promise.all([
        fetch(`${BASE}/api/returns?tab=flagged`, { headers: h }).then(r => r.json()).catch(() => []),
        fetch(`${BASE}/api/returns?tab=not_flagged`, { headers: h }).then(r => r.json()).catch(() => []),
      ])
      const flaggedArr: ReturnableItem[] = Array.isArray(flagged) ? flagged : []
      const notFlaggedArr: ReturnableItem[] = Array.isArray(notFlagged) ? notFlagged : []
      const all = [...flaggedArr, ...notFlaggedArr]
      const flaggedIds = flaggedArr.map(it => it.id)
      setGroupReturnDlg(s => ({ ...s, availableItems: all, availableFlaggedIds: flaggedIds, loadingAvailable: false }))
    } catch (e: any) {
      console.error('openNewGroupReturnDlg error:', e)
      setGroupReturnDlg(s => ({ ...s, availableItems: returnsData, loadingAvailable: false }))
    }
  }
  // Add an available item to the new group return (defaults qty = full remaining)
  const addReturnItemToGroup = (it: ReturnableItem) => {
    setGroupReturnDlg(s => s.items.some(x => x.item.id === it.id) ? s : ({ ...s, items: [...s.items, { item: it, qty: it.remainingQty, selected: true }], itemsPage: 1 }))
  }
  const removeReturnItemFromGroup = (id: number) => {
    setGroupReturnDlg(s => ({ ...s, items: s.items.filter(x => x.item.id !== id), itemsPage: 1 }))
  }
  // ─── Returns: submit group return (creates a NEW ReturnRecorder record) ────
  // Sends the person header + items to /api/returns/group which creates a ReturnRecorder
  // (RET-YYYY-NNNN) record — just like Stock-In creates a StockInRecorder — then processes
  // each item return linked to it.
  const submitGroupReturn = async () => {
    const selected = groupReturnDlg.items.filter(i => i.selected && i.qty > 0)
    if (selected.length === 0) { toast({ title: 'Select at least one item with qty > 0', variant: 'destructive' }); return }
    if (!groupReturnDlg.personName.trim()) { toast({ title: 'Enter the person/supplier name for this return record', variant: 'destructive' }); return }
    setGroupReturnDlg(s => ({ ...s, submitting: true }))
    try {
      const res = await fetch(`${BASE}/api/returns/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth.getAuthHeaders() },
        body: JSON.stringify({
          personName: groupReturnDlg.personName.trim(),
          personPhone: groupReturnDlg.personPhone,
          personEmail: groupReturnDlg.personEmail,
          personAddress: groupReturnDlg.personAddress,
          notes: groupReturnDlg.notes.trim(),
          items: selected.map(i => ({ stockOutItemId: i.item.id, quantity: i.qty })),
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Group return failed')
      toast({ title: `Created return record ${data.recorder?.recorderCode || ''} — ${data.processed || 0} item(s) returned${data.lastError ? `. Stopped: ${data.lastError}` : ''}` })
      setGroupReturnDlg(s => ({ ...s, open: false, submitting: false }))
      await loadReturns(returnsTab)
      await loadGroupReturnRecords()
      await loadData(false)
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
      setGroupReturnDlg(s => ({ ...s, submitting: false }))
    }
  }

  // ─── Non-Returnables: fetch list of flagged items eligible for the non-returnable decision ──
  const loadNonReturnables = useCallback(async (tab: 'flagged' | 'records') => {
    if (tab === 'records') return // records tab is handled by loadGroupNonRetRecords
    setNonRetLoading(true)
    try {
      // Fetch BOTH flagged (isReturnable=true) AND not-flagged (isReturnable=false) stock-out
      // items, just like openNewGroupReturnDlg does — any stock-out item with remaining qty
      // can be marked non-returnable, regardless of its return flag.
      const h = { ...auth.getAuthHeaders() }
      const [flagged, notFlagged] = await Promise.all([
        fetch(`${BASE}/api/returns?tab=flagged`, { headers: h }).then(r => r.json()).catch(() => []),
        fetch(`${BASE}/api/returns?tab=not_flagged`, { headers: h }).then(r => r.json()).catch(() => []),
      ])
      const flaggedArr: ReturnableItem[] = Array.isArray(flagged) ? flagged : []
      const notFlaggedArr: ReturnableItem[] = Array.isArray(notFlagged) ? notFlagged : []
      setNonRetData([...flaggedArr, ...notFlaggedArr])
    } catch (e) {
      console.error('loadNonReturnables error:', e)
      setNonRetData([])
    }
    setNonRetLoading(false)
  }, [auth])

  // ─── Non-Returnables: load group-non-returnable recorder records (mirrors loadGroupReturnRecords) ──
  const loadGroupNonRetRecords = useCallback(async () => {
    setGroupNonRetRecordsLoading(true)
    try {
      const res = await fetch(`${BASE}/api/non-returnables?recorders=1`, { headers: { ...auth.getAuthHeaders() } })
      const data = await res.json()
      setGroupNonRetRecords(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('loadGroupNonRetRecords error:', e)
      setGroupNonRetRecords([])
    }
    setGroupNonRetRecordsLoading(false)
  }, [auth])

  // Fetch non-returnable data whenever the Returns page is opened or the non-returnable tab changes.
  useEffect(() => {
    if (!auth.isLoggedIn || page !== 'returns') return
    setNonRetPage(1)
    setNonRetGroupPage(1)
    setNonRetRecordsPage(1)
    if (nonRetTab !== 'records') loadNonReturnables(nonRetTab)
    loadGroupNonRetRecords()
  }, [auth.isLoggedIn, page, nonRetTab, loadNonReturnables, loadGroupNonRetRecords])

  // ─── Non-Returnables: open single-item dialog (qty defaults to full remaining; reason unselected) ──
  const openNonRetDlg = (item: ReturnableItem) => {
    setNonRetDlg({ open: true, item, qty: item.remainingQty, reason: '', reasonDetail: '', notes: '', submitting: false, pendingFiles: [], pendingMetaFields: [], pendingAttTitle: '', pendingAttDesc: '' })
  }
  // ─── Non-Returnables: submit single-item decision ──
  const submitNonReturnable = async () => {
    const it = nonRetDlg.item
    if (!it) return
    if (!nonRetDlg.qty || nonRetDlg.qty <= 0) { toast({ title: 'Quantity must be positive', variant: 'destructive' }); return }
    if (nonRetDlg.qty > it.remainingQty) { toast({ title: `Only ${it.remainingQty} remaining to mark`, variant: 'destructive' }); return }
    if (!nonRetDlg.reason) { toast({ title: 'Choose a reason', variant: 'destructive' }); return }
    if (nonRetDlg.reason === 'other' && !nonRetDlg.reasonDetail.trim()) { toast({ title: 'For "Other", specify the reason in the detail field', variant: 'destructive' }); return }
    setNonRetDlg(s => ({ ...s, submitting: true }))
    try {
      const created = await apiFetch(`/non-returnables`, {
        method: 'POST',
        body: JSON.stringify({
          stockOutItemId: it.id,
          quantity: nonRetDlg.qty,
          reason: nonRetDlg.reason,
          reasonDetail: nonRetDlg.reasonDetail || undefined,
          notes: nonRetDlg.notes || undefined,
        }),
      })
      // Upload non-returnable-level attachments (entityType='non_returnable', entityId=created.id)
      if (nonRetDlg.pendingFiles?.length && created?.id) {
        await uploadAttachmentsFor('non_returnable', created.id, it.warehouseId, nonRetDlg.pendingFiles, { metaFields: nonRetDlg.pendingMetaFields, title: nonRetDlg.pendingAttTitle, description: nonRetDlg.pendingAttDesc })
      }
      toast({ title: `Marked ${nonRetDlg.qty} ${it.unit} of ${it.product.name} as non-returnable (${REASON_LABELS[nonRetDlg.reason] || nonRetDlg.reason})` })
      setNonRetDlg({ open: false, item: null, qty: 0, reason: '', reasonDetail: '', notes: '', submitting: false, pendingFiles: [], pendingMetaFields: [], pendingAttTitle: '', pendingAttDesc: '' })
      await loadNonReturnables(nonRetTab)
      await loadReturns(returnsTab) // refresh the Returns page too (remaining qty changed)
      await loadGroupNonRetRecords()
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
      setNonRetDlg(s => ({ ...s, submitting: false }))
    }
  }

  // ─── Non-Returnables: open group dialog for a given person key (prefilled mode) ──
  const openGroupNonRetDlg = (personKey: string, items: ReturnableItem[]) => {
    const whId = items[0]?.warehouseId ?? null
    setGroupNonRetDlg({
      open: true, submitting: false, mode: 'prefilled', personKey,
      personName: personKey === '(no person)' ? '' : personKey,
      personPhone: '', personEmail: '', personAddress: '', notes: '',
      warehouseId: whId,
      items: items.map(it => ({ item: it, qty: it.remainingQty, reason: '', reasonDetail: '', selected: true })),
      availableItems: [], itemSearch: '', loadingAvailable: false,
      availPage: 1, itemsPage: 1,
      filterWarehouse: '', filterCategory: '', filterCondition: '', filterPerson: '', filterDateFrom: '', filterDateTo: '', filterProgress: '', filterFlagged: '',
      whComboOpen: false, whComboSearch: '', availableFlaggedIds: [],
    })
  }
  // ─── Non-Returnables: open a NEW group-non-returnable record from scratch (new mode) ──
  const openNewGroupNonRetDlg = async () => {
    setGroupNonRetDlg({ open: true, submitting: false, mode: 'new', personKey: '', personName: '', personPhone: '', personEmail: '', personAddress: '', notes: '', warehouseId: null, items: [], availableItems: [], itemSearch: '', loadingAvailable: true, availPage: 1, itemsPage: 1, filterWarehouse: '', filterCategory: '', filterCondition: '', filterPerson: '', filterDateFrom: '', filterDateTo: '', filterProgress: '', filterFlagged: '', whComboOpen: false, whComboSearch: '', availableFlaggedIds: [] })
    try {
      // Fetch BOTH flagged (isReturnable=true) AND not-flagged (isReturnable=false) stock-out
      // items — mirrors openNewGroupReturnDlg exactly. Any stock-out item with remaining qty
      // can be marked non-returnable, so the picker must show the full pool, not just flagged.
      const h = { ...auth.getAuthHeaders() }
      const [flagged, notFlagged] = await Promise.all([
        fetch(`${BASE}/api/returns?tab=flagged`, { headers: h }).then(r => r.json()).catch(() => []),
        fetch(`${BASE}/api/returns?tab=not_flagged`, { headers: h }).then(r => r.json()).catch(() => []),
      ])
      const flaggedArr: ReturnableItem[] = Array.isArray(flagged) ? flagged : []
      const notFlaggedArr: ReturnableItem[] = Array.isArray(notFlagged) ? notFlagged : []
      const all = [...flaggedArr, ...notFlaggedArr]
      const flaggedIds = flaggedArr.map(it => it.id)
      setGroupNonRetDlg(s => ({ ...s, availableItems: all, availableFlaggedIds: flaggedIds, loadingAvailable: false }))
    } catch (e) {
      console.error('openNewGroupNonRetDlg error:', e)
      setGroupNonRetDlg(s => ({ ...s, availableItems: nonRetData, loadingAvailable: false }))
    }
  }
  const addNonRetItemToGroup = (it: ReturnableItem) => {
    setGroupNonRetDlg(s => s.items.some(x => x.item.id === it.id) ? s : ({ ...s, items: [...s.items, { item: it, qty: it.remainingQty, reason: '', reasonDetail: '', selected: true }], itemsPage: 1 }))
  }
  const removeNonRetItemFromGroup = (id: number) => {
    setGroupNonRetDlg(s => ({ ...s, items: s.items.filter(x => x.item.id !== id), itemsPage: 1 }))
  }
  // ─── Non-Returnables: submit group decision (creates a NEW NonReturnableRecorder record) ──
  const submitGroupNonReturnable = async () => {
    const selected = groupNonRetDlg.items.filter(i => i.selected && i.qty > 0 && i.reason)
    if (selected.length === 0) { toast({ title: 'Select at least one item with qty > 0 and a reason', variant: 'destructive' }); return }
    if (selected.some(i => i.reason === 'other' && !i.reasonDetail.trim())) { toast({ title: 'For "Other" reasons, fill in the detail field', variant: 'destructive' }); return }
    if (!groupNonRetDlg.personName.trim()) { toast({ title: 'Enter the person/inspector name for this record', variant: 'destructive' }); return }
    setGroupNonRetDlg(s => ({ ...s, submitting: true }))
    try {
      const res = await fetch(`${BASE}/api/non-returnables/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth.getAuthHeaders() },
        body: JSON.stringify({
          personName: groupNonRetDlg.personName.trim(),
          personPhone: groupNonRetDlg.personPhone,
          personEmail: groupNonRetDlg.personEmail,
          personAddress: groupNonRetDlg.personAddress,
          notes: groupNonRetDlg.notes.trim(),
          items: selected.map(i => ({ stockOutItemId: i.item.id, quantity: i.qty, reason: i.reason, reasonDetail: i.reasonDetail || undefined, notes: i.reasonDetail || undefined })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Group non-returnable failed')
      toast({ title: `Created non-returnable record ${data.recorder?.recorderCode || ''} — ${data.processed || 0} item(s) marked${data.lastError ? `. Stopped: ${data.lastError}` : ''}` })
      setGroupNonRetDlg(s => ({ ...s, open: false, submitting: false }))
      await loadNonReturnables(nonRetTab)
      await loadReturns(returnsTab) // refresh Returns too (remaining qty changed)
      await loadGroupNonRetRecords()
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
      setGroupNonRetDlg(s => ({ ...s, submitting: false }))
    }
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
      const defaultStats: DashboardStats = { enterpriseCount: 0, branchCount: 0, warehouseCount: 0, userCount: 0, productCount: 0, orderCount: 0, pendingOrderCount: 0, totalStockValue: 0, lowStockProducts: [], totalLots: 0, openLots: 0, stockInCount: 0, stockOutCount: 0 }
      const defaultAnalytics: AnalyticsData = { stockByWarehouse: [], stockByCategory: [], topProducts: [], recentActivity: [] }
      const [s, e, b, w, u, c, cond, sup, p, st, o, a, feat, so, si, an, att] = await Promise.all([
        fObj('/dashboard', defaultStats), fArr('/enterprises'), fArr('/branches'), fArr('/warehouses'), fArr('/users'),
        fArr('/categories'), fArr('/conditions'), fArr('/suppliers'), fArr('/products'), fArr('/stock'), fArr('/orders'),
        fArr('/audit'), fArr('/features'), fArr('/stock-out'), fArr('/stock-in'), fObj('/analytics', defaultAnalytics),
        fArr('/attachments'),
      ])
      // Ensure stats is always a proper object with all required fields
      const safeStats: DashboardStats = s && typeof s === 'object' && !Array.isArray(s) ? { ...defaultStats, ...s } : defaultStats
      const safeAnalytics: AnalyticsData = an && typeof an === 'object' && !Array.isArray(an) ? { ...defaultAnalytics, ...an } : defaultAnalytics
      setStats(safeStats); setEnterprises(Array.isArray(e) ? e : []); setBranches(Array.isArray(b) ? b : []); setWarehouses(Array.isArray(w) ? w : [])
      setAllUsers(Array.isArray(u) ? u : []); setCategories(Array.isArray(c) ? c : []); setConditions(Array.isArray(cond) ? cond : []); setSuppliers(Array.isArray(sup) ? sup : []); setProducts(Array.isArray(p) ? p : [])
      setStockData(Array.isArray(st) ? st : []); setOrders(Array.isArray(o) ? o : []); setAuditData(Array.isArray(a) ? a : []); setFeatures(Array.isArray(feat) ? feat : [])
      setStockOutData(Array.isArray(so) ? so : []); setStockInData(Array.isArray(si) ? si : []); setAnalyticsData(safeAnalytics)
      setAttachmentsData(Array.isArray(att) ? att : [])
      // Fetch attachment tabs data (meta-keys + category counts) in parallel
      Promise.all([
        fetch(`${BASE}/api/attachments/meta-keys`, { headers: auth.getAuthHeaders() }).then(r => r.ok ? r.json() : { keys: [] }).catch(() => ({ keys: [] })),
        fetch(`${BASE}/api/attachments/counts`, { headers: auth.getAuthHeaders() }).then(r => r.ok ? r.json() : { counts: {} }).catch(() => ({ counts: {} })),
      ]).then(([mk, cc]) => {
        setAttMetaKeys(Array.isArray(mk.keys) ? mk.keys : [])
        setAttCategoryCounts(cc.counts && typeof cc.counts === 'object' ? cc.counts : {})
      })
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

  // Upload attachments linked to a newly-created record (entityType + entityId).
  // Used by the Stock In / Stock Out recorder dialogs AND item-level forms when files are selected.
  // Files are bundled into a single ZIP archive server-side; multiple File objects become one Attachment row.
  const uploadAttachmentsFor = async (entityType: string, entityId: number, warehouseId: number | undefined, files: File[], opts?: { branchId?: number; metaFields?: { key: string; value: string; description: string }[]; title?: string; description?: string }) => {
    const h = useAuthStore.getState().getAuthHeaders()
    if (!files || files.length === 0) return
    try {
      const fd = new FormData()
      for (const f of files) fd.append('files', f)
      if (opts?.title) fd.append('title', opts.title)
      if (opts?.description) fd.append('description', opts.description)
      fd.append('entityType', entityType)
      fd.append('entityId', String(entityId))
      if (warehouseId) fd.append('warehouseId', String(warehouseId))
      if (opts?.branchId) fd.append('branchId', String(opts.branchId))
      if (opts?.metaFields && opts.metaFields.length > 0) fd.append('metaFields', JSON.stringify(opts.metaFields.filter(m => m.key.trim())))
      const res = await fetch(`${BASE}/api/attachments`, { method: 'POST', headers: h, body: fd })
      if (res.ok) {
        toast({ title: `${files.length} file(s) zipped + linked to ${entityType} #${entityId}` })
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ title: `Attachment upload failed: ${err.error || res.status}`, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: `Attachment upload failed: ${e.message}`, variant: 'destructive' })
    }
  }

  // Default attachment-picker state injected into every form dialog so the
  // AttachmentPicker component always has well-defined props (files/meta/title/desc).
  const EMPTY_ATT_STATE = { pendingFiles: [] as File[], pendingMetaFields: [] as { key: string; value: string; description: string }[], pendingAttTitle: '', pendingAttDesc: '' }
  const openCreate = (type: string) => { setDlgType(type); setDlgEdit(null); setDlgData({ ...EMPTY_ATT_STATE }); setDlgOpen(true) }
  const openEdit = (type: string, item: any) => { setDlgType(type); setDlgEdit(item); setDlgData({ ...item, ...EMPTY_ATT_STATE }); setDlgOpen(true) }

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
    { key: 'stockIn', label: 'Stock In', icon: 'ArrowDownToLine', href: '/stock-in', permission: 'stock:view' as Permission },
    { key: 'stockOut', label: 'Stock Out', icon: 'ArrowUpFromLine', href: '/stock-out', permission: 'orders:view' as Permission },
    { key: 'returns', label: 'Returns', icon: 'RotateCcw', href: '/returns', permission: 'stock:view' as Permission },
    { key: 'attachments', label: 'Attachments', icon: 'Paperclip', href: '/attachments', permission: 'stock:view' as Permission },
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
                { u: 'acme_admin', label: 'Enterprise Admin', desc: 'Acme Corp', color: 'from-blue-500 to-cyan-500' },
                { u: 'acme_hq_admin', label: 'Branch Admin', desc: 'Acme HQ', color: 'from-orange-500 to-amber-500' },
                { u: 'acme_wh1_admin', label: 'Warehouse Admin', desc: 'Acme WH1', color: 'from-emerald-500 to-teal-500' },
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
    // Task 5: derived pagination values for Products + Stock tables
    const filteredProducts = products.filter(p => {
      if (productSearch) {
        const q = productSearch.toLowerCase()
        if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false
      }
      if (productCategoryFilter !== '' && p.categoryId !== productCategoryFilter) return false
      if (productStatusFilter === 'active' && !p.isActive) return false
      if (productStatusFilter === 'inactive' && p.isActive) return false
      if (productConditionFilter !== '') {
        // Filter products that have at least one stock-in or stock-out item with the chosen condition
        const hasCond = (recorders: any[]) => recorders.some(r => (r.items || []).some((it: any) => it.conditionId === productConditionFilter))
        if (!hasCond(stockInData) && !hasCond(stockOutData)) return false
      }
      if (productLowOnly) {
        const totalQty = stockData.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0)
        if (totalQty > p.reorderLevel) return false
      }
      return true
    })
    const productTotalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE) || 1
    const safeProductPage = Math.min(productPage, productTotalPages)
    const pagedProducts = filteredProducts.slice((safeProductPage - 1) * PRODUCTS_PER_PAGE, safeProductPage * PRODUCTS_PER_PAGE)
    const filteredStock = stockData.filter(s => {
      const prod = products.find(p => p.id === s.productId); const wh = warehouses.find(w => w.id === s.warehouseId)
      if (stockSearch) { const q = stockSearch.toLowerCase(); if (!(prod?.name || '').toLowerCase().includes(q) && !(wh?.name || '').toLowerCase().includes(q) && !(prod?.sku || '').toLowerCase().includes(q)) return false }
      if (stockWarehouseFilter !== '' && s.warehouseId !== stockWarehouseFilter) return false
      if (stockCategoryFilter !== '' && (!prod || prod.categoryId !== stockCategoryFilter)) return false
      if (stockLowOnly) { const isLow = prod ? s.quantity <= prod.reorderLevel : false; if (!isLow) return false }
      return true
    })
    const stockTotalPages = Math.ceil(filteredStock.length / STOCK_PER_PAGE) || 1
    const safeStockPage = Math.min(stockPage, stockTotalPages)
    const pagedStock = filteredStock.slice((safeStockPage - 1) * STOCK_PER_PAGE, safeStockPage * STOCK_PER_PAGE)
    // Orders derived filters
    const filteredOrders = orders.filter(o => {
      if (orderSearch) { const q = orderSearch.toLowerCase(); if (!String(o.id).includes(q) && !(o.notes || '').toLowerCase().includes(q)) return false }
      if (orderStatusFilter && o.status !== orderStatusFilter) return false
      if (orderTypeFilter && o.type !== orderTypeFilter) return false
      if (orderWarehouseFilter !== '' && o.warehouseId !== orderWarehouseFilter) return false
      if (orderAttSearch) {
        const aq = orderAttSearch.toLowerCase()
        const matches = attachmentsData.some(a => {
          if (a.entityType !== 'order' || a.entityId !== o.id) return false
          if (a.title?.toLowerCase().includes(aq)) return true
          if (a.fileName?.toLowerCase().includes(aq)) return true
          if (a.description?.toLowerCase().includes(aq)) return true
          if (a.mimeType?.toLowerCase().includes(aq)) return true
          if ((a.metaFields || []).some(m => m.key.toLowerCase().includes(aq) || m.value.toLowerCase().includes(aq) || m.description.toLowerCase().includes(aq))) return true
          return false
        })
        if (!matches) return false
      }
      return true
    })

    if (loading) return <div className="space-y-4 py-8"><div className="flex items-center justify-center gap-3"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /><span className="text-muted-foreground text-sm">Loading data...</span></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Array.from({length:3}).map((_,i)=><div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />)}</div></div>

    // ─── DASHBOARD
    if (page === 'dashboard') return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{t(locale, 'navDashboard')}</h1><Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-0 font-medium">{ROLE_LABELS[role!]}</Badge></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats && [
            { key: 'enterpriseCount', label: t(locale, 'kpiEnterprises'), icon: Building2, gradient: 'from-purple-500 to-pink-500' },
            { key: 'branchCount', label: t(locale, 'kpiBranches'), icon: GitBranch, gradient: 'from-orange-500 to-amber-500' },
            { key: 'warehouseCount', label: t(locale, 'kpiWarehouses'), icon: WHIcon, gradient: 'from-cyan-500 to-teal-500' },
            { key: 'userCount', label: 'Users', icon: Users, gradient: 'from-green-500 to-emerald-500' },
            { key: 'productCount', label: t(locale, 'kpiProducts'), icon: Package, gradient: 'from-blue-500 to-indigo-500' },
            { key: 'orderCount', label: t(locale, 'navOrders'), icon: ShoppingCart, gradient: 'from-yellow-500 to-orange-500' },
            { key: 'pendingOrderCount', label: t(locale, 'kpiPendingOrders'), icon: AlertTriangle, gradient: 'from-red-500 to-pink-500' },
            { key: 'totalStockValue', label: t(locale, 'kpiStockValue'), icon: TrendingUp, gradient: 'from-emerald-500 to-green-500' },
            { key: 'totalLots', label: 'Total Lots', icon: Layers, gradient: 'from-violet-500 to-purple-500' },
            { key: 'openLots', label: 'Open Lots', icon: Layers, gradient: 'from-amber-500 to-yellow-500' },
            { key: 'stockInCount', label: 'Stock In', icon: ArrowDownToLine, gradient: 'from-emerald-500 to-teal-500' },
            { key: 'stockOutCount', label: 'Stock Out', icon: ArrowUpFromLine, gradient: 'from-orange-500 to-red-500' },
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
        {analyticsData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart className="w-4 h-4 text-emerald-500" /> Stock by Warehouse</CardTitle></CardHeader>
              <CardContent>
                {analyticsData.stockByWarehouse.length === 0 ? <div className="text-xs text-muted-foreground text-center py-8">No data</div> :
                  <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.stockByWarehouse}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" /><YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" /><RTooltip /><Bar dataKey="value" fill="#10b981" radius={[4,4,0,0]} name="Stock Value" /></BarChart>
                  </ResponsiveContainer></div>}
              </CardContent></Card>
            <Card className="shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PieChart className="w-4 h-4 text-blue-500" /> Stock by Category</CardTitle></CardHeader>
              <CardContent>
                {analyticsData.stockByCategory.length === 0 ? <div className="text-xs text-muted-foreground text-center py-8">No data</div> :
                  <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={analyticsData.stockByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>{analyticsData.stockByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><RTooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
                  </ResponsiveContainer></div>}
              </CardContent></Card>
            <Card className="shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-violet-500" /> Top Products (by Quantity)</CardTitle></CardHeader>
              <CardContent>
                {analyticsData.topProducts.length === 0 ? <div className="text-xs text-muted-foreground text-center py-8">No data</div> :
                  <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.topProducts} layout="vertical" margin={{ left: 20, right: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" /><YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} stroke="hsl(var(--muted-foreground))" /><RTooltip /><Bar dataKey="quantity" fill="#8b5cf6" radius={[0,4,4,0]} /></BarChart>
                  </ResponsiveContainer></div>}
              </CardContent></Card>
            <Card className="shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> Recent Activity</CardTitle></CardHeader>
              <CardContent>
                {analyticsData.recentActivity.length === 0 ? <div className="text-xs text-muted-foreground text-center py-8">No recent activity</div> :
                  <div className="max-h-80 overflow-y-auto space-y-2 pr-1">{analyticsData.recentActivity.map(act => (
                    <div key={act.id} className="bg-muted/40 rounded-lg p-2.5 flex items-start gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0 text-white text-[10px] font-bold">{(act.userName || 'U').charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 flex-wrap"><span className="text-xs font-semibold">{act.userName || 'System'}</span><span className="font-mono text-[10px] text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">{act.action}</span><span className="text-[10px] text-muted-foreground">{act.entity}</span></div>
                      {act.details && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{act.details}</div>}
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5">{new Date(act.createdAt).toLocaleString()}</div></div>
                    </div>))}</div>}
              </CardContent></Card>
          </div>
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

    // ─── PRODUCTS (two tabs: List + New Products). New products are ONLY created via the New Products tab (multi-item recorder under one supplier).
    if (page === 'products' && hasPermission(role!, 'products:view')) return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2"><div><h1 className="text-2xl font-bold">{t(locale, 'navProducts')}</h1>
          <p className="text-xs text-muted-foreground mt-1">New products are registered via the <span className="font-semibold text-emerald-600 dark:text-emerald-400">New Products</span> tab below — a multi-item recorder under one supplier/person name.</p></div></div>
        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="newProducts">New Products</TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="mt-4">
            <div className="mb-3">
              <FilterPanel
                activeCount={(productSearch ? 1 : 0) + (productCategoryFilter !== '' ? 1 : 0) + (productStatusFilter !== '' ? 1 : 0) + (productLowOnly ? 1 : 0) + (productConditionFilter !== '' ? 1 : 0)}
                onClear={() => { setProductSearch(''); setProductCategoryFilter(''); setProductStatusFilter(''); setProductLowOnly(false); setProductConditionFilter(''); setProductPage(1) }}
                resultLabel={`${filteredProducts.length} records`}
              >
                <FilterField label="Search" width="w-56">
                  <div className="relative"><Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Name or SKU..." value={productSearch} onChange={e => { setProductSearch(e.target.value); setProductPage(1) }} className="h-8 text-xs pl-7" /></div>
                </FilterField>
                <FilterField label="Category" width="w-44">
                  <PaginatedCombobox
                    items={categories.filter(c => role === 'super_admin' || c.enterpriseId === eid).map(c => ({ value: String(c.id), label: c.name }))}
                    value={productCategoryFilter === '' ? '_all' : String(productCategoryFilter)}
                    onChange={v => { setProductCategoryFilter(v === '_all' ? '' : parseInt(v)); setProductPage(1) }}
                    allLabel="All Categories"
                    placeholder="All"
                  />
                </FilterField>
                <FilterField label="Condition" width="w-44">
                  <PaginatedCombobox
                    items={conditions.filter(c => role === 'super_admin' || c.enterpriseId === eid).map(c => ({ value: String(c.id), label: c.name }))}
                    value={productConditionFilter === '' ? '_all' : String(productConditionFilter)}
                    onChange={v => { setProductConditionFilter(v === '_all' ? '' : parseInt(v)); setProductPage(1) }}
                    allLabel="All Conditions"
                    placeholder="All"
                  />
                </FilterField>
                <FilterField label="Status" width="w-36">
                  <Select value={productStatusFilter || '_all'} onValueChange={v => { setProductStatusFilter(v === '_all' ? '' : v as 'active' | 'inactive'); setProductPage(1) }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent><SelectItem value="_all">All</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Stock Level" width="w-auto">
                  <div className="flex items-center gap-1.5 h-8"><Switch checked={productLowOnly} onCheckedChange={v => { setProductLowOnly(v); setProductPage(1) }} className="scale-90" /><span className="text-[11px] text-muted-foreground">Low stock only</span></div>
                </FilterField>
              </FilterPanel>
            </div>
            {/* Mobile: stacked cards (no horizontal scroll) */}
            <div className="sm:hidden space-y-2">
              {pagedProducts.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">No products found</div>}
              {pagedProducts.map(p => {
                const cat = categories.find(c => c.id === p.categoryId)
                const totalQty = stockData.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0)
                const isLow = totalQty <= p.reorderLevel
                return (<Card key={p.id} className="shadow-sm"><CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="font-semibold text-sm truncate">{p.name}</div><div className="text-[10px] text-muted-foreground font-mono truncate">{p.sku}</div></div>
                    {p.isActive ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-0 text-[10px] shrink-0">Active</Badge> : <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border-0 text-[10px] shrink-0">Inactive</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                    <div><span className="text-muted-foreground">Category: </span><span className="font-medium">{cat?.name || '—'}</span></div>
                    <div><span className="text-muted-foreground">Price: </span><span className="font-semibold text-emerald-600 dark:text-emerald-400">{fmt(p.price)}</span></div>
                    <div><span className="text-muted-foreground">In Stock: </span><span className={`font-bold ${isLow ? 'text-red-600 dark:text-red-400' : ''}`}>{totalQty}</span> <span className="text-muted-foreground text-[10px]">{p.unit}</span></div>
                    <div><span className="text-muted-foreground">Reorder: </span><span className="font-medium">{p.reorderLevel}</span></div>
                  </div>
                  <div className="flex gap-1 pt-1 border-t">
                    {hasPermission(role!, 'products:edit') && <Button size="sm" variant="outline" onClick={() => openEdit('product', p)} className="h-7 text-xs flex-1"><Pencil className="w-3 h-3 mr-1" />Edit</Button>}
                    {hasPermission(role!, 'products:delete') && <Button size="sm" variant="outline" onClick={() => crud.remove(`/products/${p.id}`)} disabled={isCrudLoading('remove', `/products/${p.id}`)} className="text-red-500 h-7 text-xs flex-1">{isCrudLoading('remove', `/products/${p.id}`) ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}Delete</Button>}
                  </div>
                </CardContent></Card>)})}
            </div>
            {/* Desktop: table */}
            <div className="hidden sm:block rounded-md border"><Table>
              <TableHeader><TableRow>
                <TableHead className="h-8 text-xs">Product</TableHead>
                <TableHead className="h-8 text-xs">Category</TableHead>
                <TableHead className="h-8 text-xs text-right">Price</TableHead>
                <TableHead className="h-8 text-xs text-right hidden md:table-cell">Cost</TableHead>
                <TableHead className="h-8 text-xs text-right">In Stock</TableHead>
                <TableHead className="h-8 text-xs text-right hidden md:table-cell">Reorder</TableHead>
                <TableHead className="h-8 text-xs text-center">Status</TableHead>
                <TableHead className="h-8 text-xs text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {pagedProducts.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No products found</TableCell></TableRow>}
                {pagedProducts.map(p => {
                  const cat = categories.find(c => c.id === p.categoryId)
                  const totalQty = stockData.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0)
                  const isLow = totalQty <= p.reorderLevel
                  return (<TableRow key={p.id}>
                    <TableCell className="py-2"><div className="font-medium text-sm">{p.name}</div><div className="text-[10px] text-muted-foreground font-mono">{p.sku}</div></TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">{cat?.name || '—'}</TableCell>
                    <TableCell className="py-2 text-xs text-right font-semibold text-emerald-600 dark:text-emerald-400">{fmt(p.price)}</TableCell>
                    <TableCell className="py-2 text-xs text-right text-muted-foreground hidden md:table-cell">{fmt(p.cost)}</TableCell>
                    <TableCell className="py-2 text-xs text-right"><span className={`font-bold ${isLow ? 'text-red-600 dark:text-red-400' : ''}`}>{totalQty}</span> <span className="text-muted-foreground text-[10px]">{p.unit}</span></TableCell>
                    <TableCell className="py-2 text-xs text-right text-muted-foreground hidden md:table-cell">{p.reorderLevel}</TableCell>
                    <TableCell className="py-2 text-center">{p.isActive ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-0 text-[10px]">Active</Badge> : <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border-0 text-[10px]">Inactive</Badge>}</TableCell>
                    <TableCell className="py-2 text-right"><div className="flex gap-0.5 justify-end">
                      {hasPermission(role!, 'products:edit') && <Button size="sm" variant="ghost" onClick={() => openEdit('product', p)} className="h-7 w-7 p-0"><Pencil className="w-3 h-3" /></Button>}
                      {hasPermission(role!, 'products:delete') && <Button size="sm" variant="ghost" onClick={() => crud.remove(`/products/${p.id}`)} disabled={isCrudLoading('remove', `/products/${p.id}`)} className="text-red-500 h-7 w-7 p-0">{isCrudLoading('remove', `/products/${p.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}</Button>}
                    </div></TableCell>
                  </TableRow>)})}
              </TableBody>
            </Table></div>
            <Pager page={safeProductPage} totalPages={productTotalPages} onPageChange={setProductPage} />
          </TabsContent>
          <TabsContent value="newProducts" className="mt-4">
            <Card className="border-emerald-200 dark:border-emerald-500/20 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4 text-emerald-500" /> Multi-Item Product Registration</CardTitle>
                <CardDescription className="text-xs">Register multiple products under one supplier/person. Each product with quantity &gt; 0 creates a Lot (source = register_item) automatically — visible via the Lots icon on the Stock page.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {/* Supplier / person header — mirrors Stock In/Out recorder */}
                <div className="bg-emerald-50/50 dark:bg-emerald-500/5 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Truck}>Supplier / Person (applies to all items)</SectionHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1"><IconLabel icon={Users}>Supplier / Person Name</IconLabel><Input value={registerSupplier.personName} onChange={e => setRegisterSupplier(s => ({ ...s, personName: e.target.value }))} placeholder="e.g. Acme Supplies Ltd." className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={Phone}>Phone</IconLabel><Input value={registerSupplier.personPhone} onChange={e => setRegisterSupplier(s => ({ ...s, personPhone: e.target.value }))} placeholder="Phone..." className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={Mail}>Email</IconLabel><Input value={registerSupplier.personEmail} onChange={e => setRegisterSupplier(s => ({ ...s, personEmail: e.target.value }))} placeholder="Email..." className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={MapPin}>Address</IconLabel><Input value={registerSupplier.personAddress} onChange={e => setRegisterSupplier(s => ({ ...s, personAddress: e.target.value }))} placeholder="Address..." className="h-8 text-sm rounded-md" /></div>
                  </div>
                  <div className="space-y-1"><IconLabel icon={FileText}>Notes</IconLabel><Input value={registerSupplier.notes} onChange={e => setRegisterSupplier(s => ({ ...s, notes: e.target.value }))} placeholder="Optional batch notes..." className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-emerald-50/50 dark:bg-emerald-500/5 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={WHIcon}>Destination Warehouse</SectionHeader>
                  <PaginatedCombobox
                    items={warehouses.filter(w => w.isActive).map(w => ({ value: String(w.id), label: w.name, sublabel: w.code }))}
                    value={registerWarehouseId ? String(registerWarehouseId) : ''}
                    onChange={v => setRegisterWarehouseId(parseInt(v))}
                    placeholder="Select warehouse..."
                  />
                </div>
                {/* Items: mobile stacked cards, desktop table */}
                <div className="sm:hidden space-y-2">
                  {registerRows.length === 0 && <div className="text-center text-xs text-muted-foreground py-4 border rounded-md border-dashed">No rows. Click "Add Row" to begin.</div>}
                  {registerRows.map((row, idx) => (
                    <Card key={idx} className="border-emerald-100 dark:border-emerald-500/20"><CardContent className="p-2.5 space-y-2">
                      <div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Item {idx + 1}</span><Button size="sm" variant="ghost" onClick={() => setRegisterRows(registerRows.filter((_, i) => i !== idx))} className="text-red-500 h-6 w-6 p-0"><Trash2 className="w-3 h-3" /></Button></div>
                      <Input value={row.name} onChange={e => { const n = [...registerRows]; n[idx] = { ...n[idx], name: e.target.value }; setRegisterRows(n) }} placeholder="Product name" className="h-8 text-xs rounded-md" />
                      <Input value={row.sku} onChange={e => { const n = [...registerRows]; n[idx] = { ...n[idx], sku: e.target.value }; setRegisterRows(n) }} placeholder="SKU-001" className="h-8 text-xs rounded-md" />
                      <PaginatedCombobox
                        items={categories.filter(c => c.enterpriseId === eid || role === 'super_admin').map(c => ({ value: String(c.id), label: c.name }))}
                        value={row.categoryId ? String(row.categoryId) : ''}
                        onChange={v => { const n = [...registerRows]; n[idx] = { ...n[idx], categoryId: parseInt(v) }; setRegisterRows(n) }}
                        placeholder="Category —"
                      />
                      <PaginatedCombobox
                        items={conditions.filter(c => c.enterpriseId === eid || role === 'super_admin').map(c => ({ value: String(c.id), label: c.name }))}
                        value={row.conditionId ? String(row.conditionId) : ''}
                        onChange={v => { const n = [...registerRows]; n[idx] = { ...n[idx], conditionId: parseInt(v) }; setRegisterRows(n) }}
                        placeholder="Condition —"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={row.unit} onValueChange={v => { const n = [...registerRows]; n[idx] = { ...n[idx], unit: v }; setRegisterRows(n) }}><SelectTrigger className="h-8 text-xs rounded-md"><SelectValue /></SelectTrigger><SelectContent className="max-h-40">{SORTED_MEASUREMENTS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                        <Input type="number" min="0" value={row.quantity || ''} onChange={e => { const n = [...registerRows]; n[idx] = { ...n[idx], quantity: parseInt(e.target.value) || 0 }; setRegisterRows(n) }} placeholder="Init Qty" className="h-8 text-xs rounded-md text-right" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input type="number" step="0.01" value={row.price || ''} onChange={e => { const n = [...registerRows]; n[idx] = { ...n[idx], price: parseFloat(e.target.value) || 0 }; setRegisterRows(n) }} placeholder="Price" className="h-8 text-xs rounded-md text-right" />
                        <Input type="number" step="0.01" value={row.cost || ''} onChange={e => { const n = [...registerRows]; n[idx] = { ...n[idx], cost: parseFloat(e.target.value) || 0 }; setRegisterRows(n) }} placeholder="Cost" className="h-8 text-xs rounded-md text-right" />
                        <Input type="number" value={row.reorderLevel || ''} onChange={e => { const n = [...registerRows]; n[idx] = { ...n[idx], reorderLevel: parseInt(e.target.value) || 0 }; setRegisterRows(n) }} placeholder="Reorder" className="h-8 text-xs rounded-md text-right" />
                      </div>
                    </CardContent></Card>))}
                </div>
                <div className="hidden sm:block rounded-md border"><Table>
                  <TableHeader><TableRow>
                    <TableHead className="h-7 text-[10px]">Name</TableHead>
                    <TableHead className="h-7 text-[10px]">SKU</TableHead>
                    <TableHead className="h-7 text-[10px]">Category</TableHead>
                    <TableHead className="h-7 text-[10px]">Condition</TableHead>
                    <TableHead className="h-7 text-[10px]">Unit</TableHead>
                    <TableHead className="h-7 text-[10px] text-right">Price</TableHead>
                    <TableHead className="h-7 text-[10px] text-right">Cost</TableHead>
                    <TableHead className="h-7 text-[10px] text-right">Reorder</TableHead>
                    <TableHead className="h-7 text-[10px] text-right">Init Qty</TableHead>
                    <TableHead className="h-7 w-10"></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {registerRows.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-xs text-muted-foreground py-4">No rows. Click "Add Row" to begin.</TableCell></TableRow>}
                    {registerRows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="py-1"><Input value={row.name} onChange={e => { const n = [...registerRows]; n[idx] = { ...n[idx], name: e.target.value }; setRegisterRows(n) }} placeholder="Product name" className="h-7 text-[11px] rounded-md" /></TableCell>
                        <TableCell className="py-1"><Input value={row.sku} onChange={e => { const n = [...registerRows]; n[idx] = { ...n[idx], sku: e.target.value }; setRegisterRows(n) }} placeholder="SKU-001" className="h-7 text-[11px] rounded-md" /></TableCell>
                        <TableCell className="py-1"><PaginatedCombobox
                          compact
                          items={categories.filter(c => c.enterpriseId === eid || role === 'super_admin').map(c => ({ value: String(c.id), label: c.name }))}
                          value={row.categoryId ? String(row.categoryId) : ''}
                          onChange={v => { const n = [...registerRows]; n[idx] = { ...n[idx], categoryId: parseInt(v) }; setRegisterRows(n) }}
                          placeholder="—"
                        /></TableCell>
                        <TableCell className="py-1"><PaginatedCombobox
                          compact
                          items={conditions.filter(c => c.enterpriseId === eid || role === 'super_admin').map(c => ({ value: String(c.id), label: c.name }))}
                          value={row.conditionId ? String(row.conditionId) : ''}
                          onChange={v => { const n = [...registerRows]; n[idx] = { ...n[idx], conditionId: parseInt(v) }; setRegisterRows(n) }}
                          placeholder="—"
                        /></TableCell>
                        <TableCell className="py-1"><Select value={row.unit} onValueChange={v => { const n = [...registerRows]; n[idx] = { ...n[idx], unit: v }; setRegisterRows(n) }}><SelectTrigger className="h-7 text-[11px] rounded-md"><SelectValue /></SelectTrigger><SelectContent className="max-h-40">{SORTED_MEASUREMENTS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></TableCell>
                        <TableCell className="py-1"><Input type="number" step="0.01" value={row.price || ''} onChange={e => { const n = [...registerRows]; n[idx] = { ...n[idx], price: parseFloat(e.target.value) || 0 }; setRegisterRows(n) }} className="h-7 text-[11px] rounded-md text-right" /></TableCell>
                        <TableCell className="py-1"><Input type="number" step="0.01" value={row.cost || ''} onChange={e => { const n = [...registerRows]; n[idx] = { ...n[idx], cost: parseFloat(e.target.value) || 0 }; setRegisterRows(n) }} className="h-7 text-[11px] rounded-md text-right" /></TableCell>
                        <TableCell className="py-1"><Input type="number" value={row.reorderLevel || ''} onChange={e => { const n = [...registerRows]; n[idx] = { ...n[idx], reorderLevel: parseInt(e.target.value) || 0 }; setRegisterRows(n) }} className="h-7 text-[11px] rounded-md text-right" /></TableCell>
                        <TableCell className="py-1"><Input type="number" min="0" value={row.quantity || ''} onChange={e => { const n = [...registerRows]; n[idx] = { ...n[idx], quantity: parseInt(e.target.value) || 0 }; setRegisterRows(n) }} className="h-7 text-[11px] rounded-md text-right" /></TableCell>
                        <TableCell className="py-1 text-right"><Button size="sm" variant="ghost" onClick={() => setRegisterRows(registerRows.filter((_, i) => i !== idx))} className="text-red-500 h-6 w-6 p-0"><Trash2 className="w-3 h-3" /></Button></TableCell>
                      </TableRow>))}
                  </TableBody>
                </Table></div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setRegisterRows([...registerRows, { name: '', sku: '', categoryId: null, conditionId: null, unit: 'piece', price: 0, cost: 0, reorderLevel: 0, quantity: 0, costPerUnit: 0, supplierName: '', notes: '' }])} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"><Plus className="w-3.5 h-3.5 mr-1.5" />Add Row</Button>
                  <Button size="sm" disabled={registerSubmitting || !registerWarehouseId || registerRows.filter(r => r.name && r.sku).length === 0} onClick={async () => {
                    if (!registerWarehouseId) { toast({ title: 'Select a warehouse', variant: 'destructive' }); return }
                    const valid = registerRows.filter(r => r.name && r.sku)
                    if (valid.length === 0) { toast({ title: 'Add at least one row with name+SKU', variant: 'destructive' }); return }
                    setRegisterSubmitting(true)
                    try {
                      const res = await apiFetch<{ products: any[]; lotsCreated: number }>('/products/register', { method: 'POST', body: JSON.stringify({ warehouseId: registerWarehouseId, items: valid.map(r => ({ name: r.name.trim(), sku: r.sku.trim(), categoryId: r.categoryId || null, conditionId: r.conditionId || null, price: r.price, cost: r.cost, unit: r.unit, reorderLevel: r.reorderLevel, quantity: r.quantity, costPerUnit: r.cost, notes: r.notes || null })), supplierInfo: { personName: registerSupplier.personName.trim() || null, personPhone: registerSupplier.personPhone.trim() || null, personEmail: registerSupplier.personEmail.trim() || null, personAddress: registerSupplier.personAddress.trim() || null, notes: registerSupplier.notes.trim() || null } }) })
                      toast({ title: `Registered ${res.products?.length || valid.length} product(s)${res.lotsCreated ? `, ${res.lotsCreated} lot(s) created` : ''}` })
                      setRegisterRows([]); setRegisterSupplier({ personName: '', personPhone: '', personEmail: '', personAddress: '', notes: '' })
                      await loadData()
                    } catch (e: any) { toast({ title: e.message, variant: 'destructive' }) }
                    setRegisterSubmitting(false)
                  }} className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">{registerSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}Register All</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )

    // ─── STOCK (responsive table; row actions = View Lots + Adjust only; receiving inventory is done via the Stock In page)
    if (page === 'stock' && hasPermission(role!, 'stock:view')) return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2"><div><h1 className="text-2xl font-bold">{t(locale, 'navStock')}</h1>
          <p className="text-xs text-muted-foreground mt-1">View current stock levels and lots per product. To receive new inventory, open the <span className="font-semibold text-emerald-600 dark:text-emerald-400">Stock In</span> page in the sidebar.</p></div>
        </div>
        <FilterPanel
          activeCount={(stockSearch ? 1 : 0) + (stockWarehouseFilter !== '' ? 1 : 0) + (stockLowOnly ? 1 : 0) + (stockCategoryFilter !== '' ? 1 : 0)}
          onClear={() => { setStockSearch(''); setStockWarehouseFilter(''); setStockLowOnly(false); setStockCategoryFilter(''); setStockPage(1) }}
          resultLabel={`${filteredStock.length} records`}
        >
          <FilterField label="Search" width="w-56">
            <div className="relative"><Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Product, SKU, warehouse..." value={stockSearch} onChange={e => { setStockSearch(e.target.value); setStockPage(1) }} className="h-8 text-xs pl-7" /></div>
          </FilterField>
          <FilterField label="Category" width="w-44">
            <PaginatedCombobox
              items={categories.filter(c => role === 'super_admin' || c.enterpriseId === eid).map(c => ({ value: String(c.id), label: c.name }))}
              value={stockCategoryFilter === '' ? '_all' : String(stockCategoryFilter)}
              onChange={v => { setStockCategoryFilter(v === '_all' ? '' : parseInt(v)); setStockPage(1) }}
              allLabel="All Categories"
              placeholder="All"
            />
          </FilterField>
          <FilterField label="Warehouse" width="w-44">
            <PaginatedCombobox
              items={warehouses.map(w => ({ value: String(w.id), label: w.name, sublabel: w.code }))}
              value={stockWarehouseFilter === '' ? '_all' : String(stockWarehouseFilter)}
              onChange={v => { setStockWarehouseFilter(v === '_all' ? '' : parseInt(v)); setStockPage(1) }}
              allLabel="All Warehouses"
              placeholder="All"
            />
          </FilterField>
          <FilterField label="Stock Level" width="w-auto">
            <div className="flex items-center gap-1.5 h-8"><Switch checked={stockLowOnly} onCheckedChange={v => { setStockLowOnly(v); setStockPage(1) }} className="scale-90" /><span className="text-[11px] text-muted-foreground">Low stock only</span></div>
          </FilterField>
        </FilterPanel>
        {/* Mobile: stacked cards (no horizontal scroll) */}
        <div className="sm:hidden space-y-2">
          {pagedStock.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">No stock found</div>}
          {pagedStock.map(s => {
            const prod = products.find(p => p.id === s.productId); const wh = warehouses.find(w => w.id === s.warehouseId); const isLow = prod ? s.quantity <= prod.reorderLevel : false
            return (<Card key={s.id} className="shadow-sm"><CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="font-semibold text-sm truncate">{prod?.name || `Product #${s.productId}`}</div>{prod && <div className="text-[10px] text-muted-foreground font-mono truncate">{prod.sku}</div>}</div>
                {isLow ? <Badge className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-0 text-[10px] shrink-0">Low</Badge> : <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-0 text-[10px] shrink-0">OK</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                <div><span className="text-muted-foreground">Warehouse: </span><span className="font-medium">{wh?.name || `WH #${s.warehouseId}`}</span></div>
                <div><span className="text-muted-foreground">Quantity: </span><span className={`font-bold ${isLow ? 'text-red-600 dark:text-red-400' : ''}`}>{s.quantity}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Value: </span><span className="font-medium">{prod ? fmt(s.quantity * prod.price) : '—'}</span></div>
              </div>
              <div className="flex gap-1 pt-1 border-t">
                <Button size="sm" variant="outline" onClick={() => viewLots(s.productId, s.warehouseId, prod?.name || `Product #${s.productId}`)} className="text-violet-600 hover:bg-violet-50 h-7 text-xs flex-1"><Layers className="w-3 h-3 mr-1" />Lots</Button>
                {hasPermission(role!, 'stock:adjust') && <Button size="sm" variant="outline" onClick={() => openEdit('stock', s)} className="h-7 text-xs flex-1">Adjust</Button>}
              </div>
            </CardContent></Card>)})}
        </div>
        {/* Desktop: table */}
        <div className="hidden sm:block rounded-md border"><Table>
          <TableHeader><TableRow>
            <TableHead className="h-8 text-xs">Product</TableHead>
            <TableHead className="h-8 text-xs">Warehouse</TableHead>
            <TableHead className="h-8 text-xs text-right">Quantity</TableHead>
            <TableHead className="h-8 text-xs text-right">Value</TableHead>
            <TableHead className="h-8 text-xs text-center">Status</TableHead>
            <TableHead className="h-8 text-xs text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {pagedStock.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No stock found</TableCell></TableRow>}
            {pagedStock.map(s => {
              const prod = products.find(p => p.id === s.productId); const wh = warehouses.find(w => w.id === s.warehouseId); const isLow = prod ? s.quantity <= prod.reorderLevel : false
              return (<TableRow key={s.id}>
                <TableCell className="py-2"><div className="font-medium text-sm">{prod?.name || `Product #${s.productId}`}</div>{prod && <div className="text-[10px] text-muted-foreground font-mono">{prod.sku}</div>}</TableCell>
                <TableCell className="py-2 text-xs text-muted-foreground">{wh?.name || `WH #${s.warehouseId}`}</TableCell>
                <TableCell className="py-2 text-right"><span className={`text-sm font-bold ${isLow ? 'text-red-600 dark:text-red-400' : ''}`}>{s.quantity}</span></TableCell>
                <TableCell className="py-2 text-right text-xs text-muted-foreground">{prod ? fmt(s.quantity * prod.price) : '—'}</TableCell>
                <TableCell className="py-2 text-center">{isLow ? <Badge className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-0 text-[10px]">Low</Badge> : <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-0 text-[10px]">OK</Badge>}</TableCell>
                <TableCell className="py-2 text-right"><div className="flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => viewLots(s.productId, s.warehouseId, prod?.name || `Product #${s.productId}`)} className="text-xs text-violet-600 hover:bg-violet-50 h-7" title="View Lots"><Layers className="w-3 h-3 mr-1" />Lots</Button>
                  {hasPermission(role!, 'stock:adjust') && <Button size="sm" variant="outline" onClick={() => openEdit('stock', s)} className="text-xs h-7">Adjust</Button>}
                </div></TableCell>
              </TableRow>)})}
          </TableBody>
        </Table></div>
        <Pager page={safeStockPage} totalPages={stockTotalPages} onPageChange={setStockPage} />
      </div>
    )

    // ─── ORDERS
    if (page === 'orders' && hasPermission(role!, 'orders:view')) return (
      <div className="space-y-5">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{t(locale, 'navOrders')}</h1>
          {hasPermission(role!, 'orders:create') && <Button onClick={() => openCreate('order')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"><Plus className="w-4 h-4 mr-1.5" />{t(locale, 'newOrder')}</Button>}</div>
        <FilterPanel
          activeCount={(orderSearch ? 1 : 0) + (orderStatusFilter ? 1 : 0) + (orderTypeFilter ? 1 : 0) + (orderWarehouseFilter !== '' ? 1 : 0) + (orderAttSearch ? 1 : 0)}
          onClear={() => { setOrderSearch(''); setOrderStatusFilter(''); setOrderTypeFilter(''); setOrderWarehouseFilter(''); setOrderAttSearch('') }}
          resultLabel={`${filteredOrders.length} orders`}
        >
          <FilterField label="Search" width="w-48">
            <div className="relative"><Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="ID or notes..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="h-8 text-xs pl-7" /></div>
          </FilterField>
          <FilterField label="Warehouse" width="w-44">
            <PaginatedCombobox
              items={warehouses.map(w => ({ value: String(w.id), label: w.name, sublabel: w.code }))}
              value={orderWarehouseFilter === '' ? '_all' : String(orderWarehouseFilter)}
              onChange={v => setOrderWarehouseFilter(v === '_all' ? '' : parseInt(v))}
              allLabel="All Warehouses"
              placeholder="All"
            />
          </FilterField>
          <FilterField label="Status" width="w-36">
            <Select value={orderStatusFilter || '_all'} onValueChange={v => setOrderStatusFilter(v === '_all' ? '' : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="_all">All Statuses</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="shipped">Shipped</SelectItem><SelectItem value="received">Received</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Type" width="w-36">
            <Select value={orderTypeFilter || '_all'} onValueChange={v => setOrderTypeFilter(v === '_all' ? '' : v as 'purchase' | 'sales')}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="_all">All Types</SelectItem><SelectItem value="purchase">Purchase</SelectItem><SelectItem value="sales">Sales</SelectItem></SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Attachment Content" width="w-48"><div className="relative"><Paperclip className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Title, file name, meta key/value..." value={orderAttSearch} onChange={e => setOrderAttSearch(e.target.value)} className="h-8 text-xs pl-7" /></div></FilterField>
        </FilterPanel>
        <div className="grid gap-3">{filteredOrders.map(o => { const wh = warehouses.find(w => w.id === o.warehouseId)
          return (<Card key={o.id} className="shadow-sm"><CardContent className="p-4">
            <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-2"><span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">#{o.id}</span>{statusBadge(o.status)}
              <Badge className={`${o.type === 'purchase' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'} border-0 text-[11px]`}>{o.type}</Badge></div>
              <span className="text-sm font-bold">{fmt(o.totalAmount)}</span></div>
            <div className="text-xs text-muted-foreground">{wh?.name || '—'} · {o.notes}</div>
            <div className="flex gap-1 mt-2">
              {hasPermission(role!, 'orders:edit') && <Button size="sm" variant="ghost" onClick={() => openEdit('order', o)} className="text-xs"><Pencil className="w-3 h-3 mr-1" />Edit</Button>}
              <Button size="sm" variant="ghost" onClick={() => openAttLink('order', o.id, `Order #${o.id} (${o.type}, ${o.status})`, o.warehouseId || undefined)} className="text-xs text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/20"><Paperclip className="w-3 h-3 mr-1" />Attach</Button>
            </div>
          </CardContent></Card>)})}
          {filteredOrders.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">No orders match the current filters</div>}
        </div>
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

    // ─── CONDITIONS (mirrors Categories — managed list of inventory conditions)
    if (page === 'conditions' && hasPermission(role!, 'categories:view')) return (
      <div className="space-y-5">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardCheck className="w-6 h-6 text-teal-500" />Conditions</h1>
          {hasPermission(role!, 'categories:create') && <Button onClick={() => openCreate('condition')} className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-sm"><Plus className="w-4 h-4 mr-1.5" />New Condition</Button>}</div>
        <p className="text-xs text-muted-foreground -mt-3">Manage the catalogue of inventory conditions (e.g. New, Used, Refurbished, Damaged). Conditions are assigned per stock-in / stock-out / lot — not per product.</p>
        {conditions.length === 0 ? (
          <Card className="shadow-sm border-dashed"><CardContent className="p-8 text-center text-sm text-muted-foreground">No conditions yet. Click <span className="font-semibold text-teal-600">New Condition</span> to create one.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{conditions.map(c => (
            <Card key={c.id} className="shadow-sm hover:shadow-md transition-shadow"><CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1"><ClipboardCheck className="w-4 h-4 text-teal-500" /><div className="font-semibold text-sm">{c.name}</div></div>
              <div className="text-xs text-muted-foreground line-clamp-2">{c.description}</div>
              <div className="flex gap-2 mt-2">{hasPermission(role!, 'categories:edit') && <Button size="sm" variant="ghost" onClick={() => openEdit('condition', c)} className="h-6 w-6 p-0"><Pencil className="w-3 h-3" /></Button>}
                {hasPermission(role!, 'categories:delete') && <Button size="sm" variant="ghost" onClick={() => crud.remove(`/conditions/${c.id}`)} disabled={isCrudLoading('remove', `/conditions/${c.id}`)} className="text-red-500 h-6 w-6 p-0">{isCrudLoading('remove', `/conditions/${c.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}</Button>}</div>
            </CardContent></Card>))}
          </div>
        )}
      </div>
    )

    // ─── ATTACHMENTS (files zipped + uploaded, image preview, custom metadata, tenant-isolated)
    if (page === 'attachments' && hasPermission(role!, 'stock:view')) return (
      <div className="space-y-3">
        {/* A. Header row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-1.5"><Paperclip className="w-4 h-4 text-violet-500" />Attachments</h1>
            <p className="text-xs text-muted-foreground">Files are zipped on upload. Multi-file uploads become a single ZIP archive. Images preview inline. Attach to any record or keep standalone. Never shared across enterprises / branches / warehouses.</p>
          </div>
          <Button size="sm" onClick={() => setAttUpload({ open: true, submitting: false, files: [], title: '', description: '', entityType: 'standalone', entityId: '', branchId: '', warehouseId: '', enterpriseId: '', metaFields: [] })} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white h-7 text-xs"><Upload className="w-3 h-3 mr-1" />Upload</Button>
        </div>

        {/* B. Primary tabs (file-type categories) */}
        <Tabs value={attTab} onValueChange={v => { setAttTab(v); setAttPage(1) }}>
          <TabsList className="flex w-full overflow-x-auto h-9 justify-start gap-1 bg-muted/40">
            <TabsTrigger value="all" className="text-xs gap-1 data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 dark:data-[state=active]:bg-violet-500/20 dark:data-[state=active]:text-violet-300">
              All
              <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 border-0 text-[9px] h-4 px-1.5">{attachmentsData.length}</Badge>
            </TabsTrigger>
            {ATTACHMENT_FILE_CATEGORIES.filter(c => (attCategoryCounts[c.key] || 0) > 0).map(c => {
              const CatIcon = ((): React.ComponentType<any> => {
                const m: Record<string, React.ComponentType<any>> = { ImageIcon, FileText, Table: TableIcon, Presentation, Video, Music, Archive, Code, FileIcon }
                return m[c.icon] || FileIcon
              })()
              return (
                <TabsTrigger key={c.key} value={c.key} className="text-xs gap-1 data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 dark:data-[state=active]:bg-violet-500/20 dark:data-[state=active]:text-violet-300">
                  <CatIcon className="w-3 h-3" />
                  {c.label}
                  <Badge className="bg-muted text-muted-foreground border-0 text-[9px] h-4 px-1.5">{attCategoryCounts[c.key] || 0}</Badge>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>

        {/* C. Secondary tabs (metadata-key) */}
        {attMetaKeys.length > 0 && (
          <Tabs value={attMetaTab} onValueChange={v => { setAttMetaTab(v); setAttPage(1) }}>
            <TabsList className="flex w-full overflow-x-auto h-7 justify-start gap-1 bg-muted/20">
              <TabsTrigger value="_all" className="text-[11px] gap-1 data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 dark:data-[state=active]:bg-violet-500/20 dark:data-[state=active]:text-violet-300">All Metadata</TabsTrigger>
              {attMetaKeys.map(k => (
                <TabsTrigger key={k} value={k} className="text-[11px] font-mono data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 dark:data-[state=active]:bg-violet-500/20 dark:data-[state=active]:text-violet-300">{k}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* D. FilterPanel */}
        <FilterPanel
          activeCount={(attFilterSearch ? 1 : 0) + (attFilterEntityType ? 1 : 0) + (attFilterBranchId !== '' ? 1 : 0) + (attFilterWarehouseId !== '' ? 1 : 0) + (attFilterIsImage ? 1 : 0) + (attFilterMetaKey ? 1 : 0) + (attFilterMetaValue ? 1 : 0) + (attFilterDateFrom ? 1 : 0) + (attFilterDateTo ? 1 : 0)}
          onClear={() => { setAttFilterSearch(''); setAttFilterEntityType(''); setAttFilterBranchId(''); setAttFilterWarehouseId(''); setAttFilterIsImage(''); setAttFilterMetaKey(''); setAttFilterMetaValue(''); setAttFilterDateFrom(''); setAttFilterDateTo(''); setAttPage(1) }}
          resultLabel={`${attachmentsData.length} file(s)`}
        >
          <FilterField label="Search" width="w-48">
            <div className="relative"><Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Title, file name, desc..." value={attFilterSearch} onChange={e => { setAttFilterSearch(e.target.value); setAttPage(1) }} className="h-8 text-xs pl-7" /></div>
          </FilterField>
          <FilterField label="Entity Type" width="w-40"><Select value={attFilterEntityType || '_all'} onValueChange={v => { setAttFilterEntityType(v === '_all' ? '' : v); setAttPage(1) }}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="_all">All Types</SelectItem>{ATTACHMENT_ENTITY_TYPES.map(et => <SelectItem key={et.key} value={et.key}>{et.label}</SelectItem>)}</SelectContent></Select></FilterField>
          <FilterField label="Branch" width="w-40"><PaginatedCombobox items={branches.map(br => ({ value: String(br.id), label: br.name, sublabel: br.code }))} value={attFilterBranchId === '' ? '_all' : String(attFilterBranchId)} onChange={v => { setAttFilterBranchId(v === '_all' ? '' : parseInt(v)); setAttPage(1) }} allLabel="All Branches" placeholder="All" /></FilterField>
          <FilterField label="Warehouse" width="w-40"><PaginatedCombobox items={warehouses.map(w => ({ value: String(w.id), label: w.name, sublabel: w.code }))} value={attFilterWarehouseId === '' ? '_all' : String(attFilterWarehouseId)} onChange={v => { setAttFilterWarehouseId(v === '_all' ? '' : parseInt(v)); setAttPage(1) }} allLabel="All Warehouses" placeholder="All" /></FilterField>
          <FilterField label="File Kind" width="w-32"><Select value={attFilterIsImage || '_all'} onValueChange={v => { setAttFilterIsImage(v === '_all' ? '' : v as 'true' | 'false'); setAttPage(1) }}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="_all">All Files</SelectItem><SelectItem value="true">Images Only</SelectItem><SelectItem value="false">Non-Images</SelectItem></SelectContent></Select></FilterField>
          <FilterField label="Meta Key" width="w-36"><Input value={attFilterMetaKey} onChange={e => { setAttFilterMetaKey(e.target.value); setAttPage(1) }} placeholder="e.g. batch" className="h-8 text-xs" /></FilterField>
          <FilterField label="Meta Value" width="w-36"><Input value={attFilterMetaValue} onChange={e => { setAttFilterMetaValue(e.target.value); setAttPage(1) }} placeholder="e.g. B-001" className="h-8 text-xs" /></FilterField>
          <FilterField label="Date From" width="w-32"><CustomDatePicker compact value={attFilterDateFrom} onChange={v => { setAttFilterDateFrom(v); setAttPage(1) }} /></FilterField>
          <FilterField label="Date To" width="w-32"><CustomDatePicker compact value={attFilterDateTo} onChange={v => { setAttFilterDateTo(v); setAttPage(1) }} /></FilterField>
        </FilterPanel>

        {(() => {
          const getCatIcon = (cat: string): React.ComponentType<any> => {
            const m: Record<string, React.ComponentType<any>> = { ImageIcon, FileText, Table: TableIcon, Presentation, Video, Music, Archive, Code, FileIcon }
            const catDef = ATTACHMENT_FILE_CATEGORIES.find(c => c.key === cat)
            return m[catDef?.icon || 'FileIcon'] || FileIcon
          }
          const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/i
          const parseFileList = (json: string): AttachmentFileEntry[] => {
            try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
          }
          const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`
          const entityLabel = (et: string) => ATTACHMENT_ENTITY_TYPES.find(e => e.key === et)?.label || et
          const attHeaders = useAuthStore.getState().getAuthHeaders()

          const filtered = attachmentsData.filter(a => {
            if (attTab !== 'all' && a.fileCategory !== attTab) return false
            if (attMetaTab !== '_all' && !(a.metaFields || []).some(m => m.key === attMetaTab)) return false
            if (attFilterSearch) { const q = attFilterSearch.toLowerCase(); if (!a.title.toLowerCase().includes(q) && !a.fileName.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false }
            if (attFilterEntityType && a.entityType !== attFilterEntityType) return false
            if (attFilterBranchId !== '' && a.branchId !== attFilterBranchId) return false
            if (attFilterWarehouseId !== '' && a.warehouseId !== attFilterWarehouseId) return false
            if (attFilterIsImage === 'true' && !a.isImage) return false
            if (attFilterIsImage === 'false' && a.isImage) return false
            if (attFilterMetaKey) { const k = attFilterMetaKey.toLowerCase(); if (!(a.metaFields || []).some(m => m.key.toLowerCase().includes(k))) return false }
            if (attFilterMetaValue) { const v = attFilterMetaValue.toLowerCase(); if (!(a.metaFields || []).some(m => m.value.toLowerCase().includes(v))) return false }
            if (attFilterDateFrom && new Date(a.createdAt) < new Date(attFilterDateFrom + 'T00:00:00')) return false
            if (attFilterDateTo && new Date(a.createdAt) > new Date(attFilterDateTo + 'T23:59:59')) return false
            return true
          })
          const totalPages = Math.ceil(filtered.length / attPerPage) || 1
          const safePage = Math.min(attPage, totalPages)
          const paged = filtered.slice((safePage - 1) * attPerPage, safePage * attPerPage)

          const downloadAttachment = (a: AttachmentRecord) => {
            fetch(`${BASE}/api/attachments/${a.id}/download`, { headers: attHeaders }).then(r => r.blob()).then(b => {
              const u = URL.createObjectURL(b); const link = document.createElement('a'); link.href = u; link.download = a.fileName; link.click(); URL.revokeObjectURL(u)
            })
          }
          const deleteAttachment = async (a: AttachmentRecord) => {
            if (!confirm(`Delete "${a.title || a.fileName}"? This cannot be undone.`)) return
            try { await apiFetch(`/attachments/${a.id}`, { method: 'DELETE' }); toast({ title: 'Attachment deleted' }); await loadData() } catch (e: any) { toast({ title: e.message, variant: 'destructive' }) }
          }
          const openEdit = (a: AttachmentRecord) => setAttEdit({ open: true, submitting: false, attachment: a, title: a.title, description: a.description, entityType: a.entityType, entityId: a.entityId ? String(a.entityId) : '', metaFields: (a.metaFields || []).map(m => ({ key: m.key, value: m.value, description: m.description })) })

          if (filtered.length === 0) {
            return (
              <Card className="shadow-sm border-dashed">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  <div>No attachments found. Click <span className="font-semibold text-violet-600">Upload</span> to add one.</div>
                  {(attTab !== 'all' || attMetaTab !== '_all') && <div className="text-[11px] mt-1">Try the &lsquo;All&rsquo; tab.</div>}
                </CardContent>
              </Card>
            )
          }

          return (<>
            {/* E. List rendering — contacts-list style */}
            <Card className="shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {paged.map(a => {
                  const wh = warehouses.find(w => w.id === a.warehouseId)
                  const br = branches.find(b => b.id === a.branchId)
                  const CatIcon = getCatIcon(a.fileCategory)
                  const entries = a.isMultiFile ? parseFileList(a.fileListJson) : []
                  const hasImages = entries.some(e => IMAGE_EXT.test(e.name))
                  const inlineUrl = (fileIndex = 0) => `${BASE}/api/attachments/${a.id}/download?inline=1&fileIndex=${fileIndex}`
                  const metaFields = a.metaFields || []
                  return (
                    <div key={a.id} className="flex items-start gap-3 p-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      {/* Avatar (48x48) */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden bg-muted/40 flex items-center justify-center">
                        {a.isImage ? (
                          <img src={inlineUrl(0)} alt={a.title || a.fileName} className="w-full h-full object-cover cursor-pointer" loading="lazy" onClick={() => setAttPreview({ open: true, attachment: a, fileIndex: 0 })} onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none' }} />
                        ) : (
                          <CatIcon className="w-5 h-5 text-muted-foreground/70" />
                        )}
                      </div>

                      {/* Body (middle) */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        {/* Line 1: title + badges */}
                        <div className="font-medium text-sm truncate flex items-center gap-1.5">
                          <span className="truncate">{a.title || a.fileName}</span>
                          {a.isMultiFile && <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-0 text-[9px] h-4 px-1.5 flex items-center gap-0.5"><Layers className="w-2.5 h-2.5" />{a.fileCount} files</Badge>}
                          {a.entityType !== 'standalone' && <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border-0 text-[9px] h-4 px-1.5">{entityLabel(a.entityType)}{a.entityId ? ` #${a.entityId}` : ''}</Badge>}
                        </div>
                        {/* Line 2: mime • size • date (+ ZIP archive) */}
                        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-2 flex-wrap">
                          <span className="truncate max-w-[200px]">{a.mimeType || 'unknown'}</span>
                          <span>•</span>
                          <span>{fmtSize(a.originalSize)}</span>
                          <span>•</span>
                          <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                          {a.isMultiFile && <><span>•</span><span className="text-violet-600 dark:text-violet-400">ZIP archive</span></>}
                        </div>
                        {/* Line 3: meta fields inline */}
                        {metaFields.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {metaFields.slice(0, 4).map(m => (
                              <Tooltip key={m.id}>
                                <TooltipTrigger asChild>
                                  <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 border-0 text-[9px] font-mono cursor-help">{m.key}: {m.value}</Badge>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <div><span className="font-semibold">{m.key}</span>: {m.value}</div>
                                  {m.description && <div className="text-muted-foreground">{m.description}</div>}
                                </TooltipContent>
                              </Tooltip>
                            ))}
                            {metaFields.length > 4 && <Badge className="bg-muted text-muted-foreground border-0 text-[9px]">+{metaFields.length - 4}</Badge>}
                          </div>
                        )}
                        {/* Line 4: warehouse / branch (tiny) */}
                        {(wh || br) && (
                          <div className="text-[10px] text-muted-foreground/70 truncate">
                            {wh ? `W: ${wh.name}` : ''}{wh && br ? ' • ' : ''}{br ? `B: ${br.name}` : ''}
                          </div>
                        )}
                      </div>

                      {/* Actions (right) */}
                      <div className="flex-shrink-0 flex items-center gap-0.5">
                        {(a.isImage || (a.isMultiFile && hasImages)) && (
                          <Button size="sm" variant="ghost" onClick={() => setAttPreview({ open: true, attachment: a, fileIndex: 0 })} className="h-7 w-7 p-0" title="Preview"><Eye className="w-3.5 h-3.5" /></Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => downloadAttachment(a)} className="h-7 w-7 p-0" title="Download"><Download className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(a)} className="h-7 w-7 p-0" title="Edit"><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteAttachment(a)} className="h-7 w-7 p-0 text-red-500 hover:text-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* F. Pagination with per-page selector (Pager component lacks perPage support) */}
            <div className="flex items-center justify-between pt-2 gap-2 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[11px] text-muted-foreground">Page {safePage} of {totalPages} • {filtered.length} total</span>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>Per page:</span>
                  <Select value={String(attPerPage)} onValueChange={v => { setAttPerPage(parseInt(v)); setAttPage(1) }}>
                    <SelectTrigger className="h-7 w-[72px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setAttPage(1)} className="h-7 w-7 p-0"><SkipBack className="w-3 h-3" /></Button>
                <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setAttPage(p => Math.max(1, p - 1))} className="h-7 w-7 p-0"><ChevronLeft className="w-3 h-3" /></Button>
                <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setAttPage(p => Math.min(totalPages, p + 1))} className="h-7 w-7 p-0"><ChevronRight className="w-3 h-3" /></Button>
                <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setAttPage(totalPages)} className="h-7 w-7 p-0"><SkipForward className="w-3 h-3" /></Button>
              </div>
            </div>
          </>)
        })()}
      </div>
    )

    // ─── STOCK OUT RECORDER
    // ─── STOCK IN (Task 1-b + Task 6: mirrors Stock Out, emerald theme)
    if (page === 'stockIn') return (
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div><h1 className="text-lg font-bold flex items-center gap-1.5"><ArrowDownToLine className="w-4 h-4 text-emerald-500" />Stock In</h1></div>
          <Button size="sm" onClick={() => openCreate('stockInRecorder')} className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white h-7 text-xs"><Plus className="w-3 h-3 mr-1" />New Receipt</Button>
        </div>

        {/* ── Filters ── */}
        <FilterPanel
          activeCount={(stockInFilterSearch ? 1 : 0) + (stockInFilterDateFrom ? 1 : 0) + (stockInFilterDateTo ? 1 : 0) + (stockInFilterStatus ? 1 : 0) + (stockInFilterPerson ? 1 : 0) + (stockInFilterWarehouse !== '' ? 1 : 0) + (stockInFilterCondition !== '' ? 1 : 0) + (stockInHasAttachments ? 1 : 0) + (stockInAttSearch ? 1 : 0)}
          onClear={() => { setStockInFilterSearch(''); setStockInFilterDateFrom(''); setStockInFilterDateTo(''); setStockInFilterStatus(''); setStockInFilterPerson(''); setStockInFilterWarehouse(''); setStockInFilterCondition(''); setStockInHasAttachments(false); setStockInAttSearch(''); setStockInRecPage(1) }}
          resultLabel={`${stockInData.length} recorders`}
        >
          <FilterField label="Search" width="w-48">
            <div className="relative"><Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Code, supplier, notes..." value={stockInFilterSearch} onChange={e => { setStockInFilterSearch(e.target.value); setStockInRecPage(1) }} className="h-8 text-xs pl-7" /></div>
          </FilterField>
          <FilterField label="Date From" width="w-32"><CustomDatePicker compact value={stockInFilterDateFrom} onChange={v => { setStockInFilterDateFrom(v); setStockInRecPage(1) }} /></FilterField>
          <FilterField label="Date To" width="w-32"><CustomDatePicker compact value={stockInFilterDateTo} onChange={v => { setStockInFilterDateTo(v); setStockInRecPage(1) }} /></FilterField>
          <FilterField label="Warehouse" width="w-44"><PaginatedCombobox
            items={warehouses.map(w => ({ value: String(w.id), label: w.name, sublabel: w.code }))}
            value={stockInFilterWarehouse === '' ? '_all' : String(stockInFilterWarehouse)}
            onChange={v => { setStockInFilterWarehouse(v === '_all' ? '' : parseInt(v)); setStockInRecPage(1) }}
            allLabel="All Warehouses"
            placeholder="All"
          /></FilterField>
          <FilterField label="Status" width="w-32"><Select value={stockInFilterStatus || '_all'} onValueChange={v => { setStockInFilterStatus(v === '_all' ? '' : v); setStockInRecPage(1) }}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="_all">All</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="submitted">Submitted</SelectItem></SelectContent></Select></FilterField>
          <FilterField label="Supplier" width="w-40"><Input value={stockInFilterPerson} onChange={e => { setStockInFilterPerson(e.target.value); setStockInRecPage(1) }} placeholder="Search name..." className="h-8 text-xs" /></FilterField>
          <FilterField label="Condition" width="w-44">
            <PaginatedCombobox
              items={conditions.filter(c => role === 'super_admin' || c.enterpriseId === eid).map(c => ({ value: String(c.id), label: c.name }))}
              value={stockInFilterCondition === '' ? '_all' : String(stockInFilterCondition)}
              onChange={v => { setStockInFilterCondition(v === '_all' ? '' : parseInt(v)); setStockInRecPage(1) }}
              allLabel="All Conditions"
              placeholder="All"
            />
          </FilterField>
          <FilterField label="Has Attachments" width="w-36"><div className="flex items-center gap-1.5 h-8"><Switch checked={stockInHasAttachments} onCheckedChange={v => { setStockInHasAttachments(v); setStockInRecPage(1) }} /><span className="text-xs text-muted-foreground">{stockInHasAttachments ? 'Yes' : 'Any'}</span></div></FilterField>
          <FilterField label="Attachment Content" width="w-48"><div className="relative"><Paperclip className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Title, file name, meta key/value..." value={stockInAttSearch} onChange={e => { setStockInAttSearch(e.target.value); setStockInRecPage(1) }} className="h-8 text-xs pl-7" /></div></FilterField>
        </FilterPanel>

        {(() => {
          let filtered = [...stockInData].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          if (stockInFilterDateFrom) filtered = filtered.filter(r => new Date(r.createdAt) >= new Date(stockInFilterDateFrom + 'T00:00:00'))
          if (stockInFilterDateTo) filtered = filtered.filter(r => new Date(r.createdAt) <= new Date(stockInFilterDateTo + 'T23:59:59'))
          if (stockInFilterStatus) filtered = filtered.filter(r => r.status === stockInFilterStatus)
          if (stockInFilterPerson) filtered = filtered.filter(r => (r.personName || '').toLowerCase().includes(stockInFilterPerson.toLowerCase()))
          if (stockInFilterWarehouse !== '') filtered = filtered.filter(r => r.warehouseId === stockInFilterWarehouse)
          if (stockInFilterCondition !== '') filtered = filtered.filter(r => (r.items || []).some((it: any) => it.conditionId === stockInFilterCondition))
          if (stockInFilterSearch) { const q = stockInFilterSearch.toLowerCase(); filtered = filtered.filter(r => (r.recorderCode || '').toLowerCase().includes(q) || (r.personName || '').toLowerCase().includes(q) || (r.notes || '').toLowerCase().includes(q)) }
          if (stockInHasAttachments) filtered = filtered.filter(r => attachmentsData.some(a => (a.entityType === 'stock_in' || a.entityType === 'stock_in_item') && (a.entityId === r.id || (r.items || []).some((it: any) => it.id === a.entityId))))
          if (stockInAttSearch) {
            const q = stockInAttSearch.toLowerCase()
            filtered = filtered.filter(r => attachmentsData.some(a => {
              // Match record-level OR any item-level attachment on this recorder's items
              const matchesRecorder = a.entityType === 'stock_in' && a.entityId === r.id
              const matchesItem = a.entityType === 'stock_in_item' && (r.items || []).some((it: any) => it.id === a.entityId)
              if (!matchesRecorder && !matchesItem) return false
              // Content match: title, fileName, description, mime, or any metaField key/value/description
              if (a.title?.toLowerCase().includes(q)) return true
              if (a.fileName?.toLowerCase().includes(q)) return true
              if (a.description?.toLowerCase().includes(q)) return true
              if (a.mimeType?.toLowerCase().includes(q)) return true
              if ((a.metaFields || []).some(m => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q) || m.description.toLowerCase().includes(q))) return true
              return false
            }))
          }

          const recTotalPages = Math.ceil(filtered.length / STOCK_IN_REC_PER_PAGE)
          const recPaged = filtered.slice((stockInRecPage - 1) * STOCK_IN_REC_PER_PAGE, stockInRecPage * STOCK_IN_REC_PER_PAGE)

          return (<>
            {recPaged.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">No receipts found</div>}
            {recPaged.map(r => { const isExp = expandedIn === r.id; const isExpanding = expandingInId === r.id; const pendingItems = getPendingInItems(r.id); const totalItems = r.items.length + pendingItems.length
              return (<Card key={r.id} className="shadow-sm"><CardContent className="p-2.5">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => { if (isExp) { setExpandedIn(null) } else { setExpandingInId(r.id); setTimeout(() => { setExpandedIn(r.id); setExpandingInId(null) }, 200) } }}>
                  <div className="flex items-center gap-1.5">{isExpanding ? <Loader2 className="w-3 h-3 animate-spin text-emerald-500" /> : <ChevronRight className={`w-3.5 h-3.5 text-emerald-500 transition-transform ${isExp ? 'rotate-90' : ''}`} />}
                    <div className="flex items-center gap-1.5 flex-wrap">{!isExp && r.personName ? <span className="text-xs font-semibold">{r.personName}</span> : <span className="text-xs font-semibold">{r.recorderCode}</span>}{statusBadge(r.status)}<span className="text-[10px] text-muted-foreground">{totalItems} item{totalItems !== 1 ? 's' : ''}{pendingItems.length > 0 && ` (${pendingItems.length} pend.)`}</span></div>
                    {!isExp && r.personName && <span className="text-[10px] text-muted-foreground ml-0.5">{r.recorderCode}</span>}{isExp && r.personName && <span className="text-xs font-medium text-foreground/80 ml-1">{r.personName}</span>}</div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                    <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); openAttLink('stock_in', r.id, `${r.recorderCode} — ${r.personName || 'Receipt'}`, r.warehouseId) }} className="h-5 w-5 p-0 text-violet-600" title="Attach files to this receipt"><Paperclip className="w-2.5 h-2.5" /></Button>
                    {hasPermission(role!, 'orders:edit') && <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); openEdit('stockInRecorder', r) }} className="h-5 w-5 p-0 text-muted-foreground"><Pencil className="w-2.5 h-2.5" /></Button>}
                    {hasPermission(role!, 'orders:edit') && <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); crud.remove(`/stock-in/${r.id}`) }} disabled={isCrudLoading('remove', `/stock-in/${r.id}`)} className="h-5 w-5 p-0 text-red-500">{isCrudLoading('remove', `/stock-in/${r.id}`) ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}</Button>}
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
                    const totalPages = Math.ceil(allItems.length / STOCK_IN_ITEMS_PER_PAGE); const paged = allItems.slice((stockInItemPage - 1) * STOCK_IN_ITEMS_PER_PAGE, stockInItemPage * STOCK_IN_ITEMS_PER_PAGE)
                    const totalQty = allItems.reduce((sum: number, i: any) => sum + i.quantity, 0)
                    const totalValue = allItems.reduce((sum: number, i: any) => sum + (i.quantity * (i.costPerUnit || 0)), 0)
                    return (<div id={`stockin-print-${r.id}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Items ({totalItems}) · Total Qty: {totalQty} · Value: {fmt(totalValue)}</span>
                        <Button size="sm" variant="outline" onClick={() => { const w = window.open('', '_blank', 'width=800,height=600'); if (!w) return; w.document.write('<html><head><title>Stock In - ' + r.recorderCode + '</title><style>body{font-family:system-ui,sans-serif;padding:24px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left;font-size:13px}th{background:#f1f5f9;font-weight:600}.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}.saved{background:#dcfce7;color:#166534}.pending{background:#fef3c7;color:#92400e}h2{font-size:18px;margin:0}p{color:#64748b;font-size:13px;margin:4px 0}.summary{margin-top:8px;font-size:13px;color:#334155;font-weight:600}</style></head><body>'); w.document.write('<h2>' + r.recorderCode + '</h2>'); w.document.write('<p>Date: ' + new Date(r.createdAt).toLocaleString() + '</p>'); w.document.write('<p>Supplier: ' + r.personName + (r.personPhone ? ' | Phone: ' + r.personPhone : '') + (r.personEmail ? ' | Email: ' + r.personEmail : '') + '</p>'); if (r.personAddress) w.document.write('<p>Address: ' + r.personAddress + '</p>'); if (r.notes) w.document.write('<p>Notes: ' + r.notes + '</p>'); w.document.write('<table><thead><tr><th>Product</th><th style="text-align:right">Qty</th><th>Unit</th><th style="text-align:right">Cost/Unit</th><th style="text-align:right">Total</th><th>Status</th></tr></thead><tbody>'); allItems.forEach((item: any) => { const prod = products.find((p: any) => p.id === item.productId); w.document.write('<tr><td>' + (prod?.name || '#'+item.productId) + '</td><td style="text-align:right">' + item.quantity + '</td><td>' + item.unit + '</td><td style="text-align:right">' + (item.costPerUnit || 0).toFixed(2) + '</td><td style="text-align:right">' + ((item.costPerUnit || 0) * item.quantity).toFixed(2) + '</td><td><span class="badge ' + (item._pending ? 'pending' : 'saved') + '">' + (item._pending ? 'Pending' : 'Saved') + '</span></td></tr>') }); w.document.write('</tbody></table>'); w.document.write('<p class="summary">Total Items: ' + totalItems + ' · Total Qty: ' + totalQty + ' · Total Value: $' + totalValue.toFixed(2) + '</p>'); w.document.write('</body></html>'); w.document.close(); w.print() }} className="h-5 text-[10px] gap-0.5"><Printer className="w-2.5 h-2.5" />Print</Button>
                      </div>
                      {totalItems > 0 ? (<>
                        {/* Mobile: stacked cards */}
                        <div className="sm:hidden space-y-1.5">
                          {paged.map((item: any) => { const prod = products.find(p => p.id === item.productId); const cond = conditions.find(c => c.id === item.conditionId)
                            return (<div key={item.id} className={`rounded-md border p-2 space-y-1 ${item._pending ? 'bg-amber-50/50 dark:bg-amber-500/5 border-dashed border-amber-300 dark:border-amber-600' : ''}`}>
                              <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium truncate flex items-center gap-1">{prod?.name || `#${item.productId}`}{cond && <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border-0 text-[9px] h-4 shrink-0">{cond.name}</Badge>}</span>{item._pending ? <Badge variant="outline" className="text-[9px] h-4 border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400 shrink-0">Pend</Badge> : <Badge variant="outline" className="text-[9px] h-4 border-emerald-300 text-emerald-700 dark:border-emerald-600 dark:text-emerald-400 shrink-0">Saved</Badge>}</div>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                                <div><span className="text-muted-foreground">Qty: </span><span className="font-mono">{item.quantity}</span></div>
                                <div><span className="text-muted-foreground">Unit: </span>{item.unit}</div>
                                <div><span className="text-muted-foreground">Cost/U: </span><span className="font-mono">{fmt(item.costPerUnit || 0)}</span></div>
                                <div><span className="text-muted-foreground">Total: </span><span className="font-mono">{fmt((item.costPerUnit || 0) * item.quantity)}</span></div>
                              </div>
                              <div className="flex justify-end pt-0.5 border-t gap-1">{!item._pending && <Button size="sm" variant="ghost" onClick={() => openAttLink('stock_in_item', item.id, `${prod?.name || `#${item.productId}`} — Qty ${item.quantity} ${item.unit}`, r.warehouseId)} className="text-violet-600 h-5 w-5 p-0" title="Attach files to this item"><Paperclip className="w-2.5 h-2.5" /></Button>}<Button size="sm" variant="ghost" onClick={() => item._pending ? removePendingInItem(r.id, item.tempId) : crud.remove(`/stock-in/${r.id}/item/${item.id}`)} disabled={!item._pending && isCrudLoading('remove', `/stock-in/${r.id}/item/${item.id}`)} className="text-red-500 h-5 w-5 p-0">{!item._pending && isCrudLoading('remove', `/stock-in/${r.id}/item/${item.id}`) ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}</Button></div>
                            </div>)})}
                        </div>
                        {/* Desktop: table */}
                        <div className="hidden sm:block rounded-md border overflow-x-auto"><Table><TableHeader><TableRow>
                          <TableHead className="h-6 text-[10px]">Product</TableHead><TableHead className="h-6 text-[10px] text-right w-14">Qty</TableHead><TableHead className="h-6 text-[10px] w-14">Unit</TableHead><TableHead className="h-6 text-[10px] text-right w-20">Cost/U</TableHead><TableHead className="h-6 text-[10px] text-right w-24">Total</TableHead><TableHead className="h-6 text-[10px] w-20">Condition</TableHead><TableHead className="h-6 text-[10px] text-center w-14">Status</TableHead><TableHead className="h-6 w-10"></TableHead>
                        </TableRow></TableHeader><TableBody>
                          {paged.map((item: any) => { const prod = products.find(p => p.id === item.productId); const cond = conditions.find(c => c.id === item.conditionId)
                            return (<TableRow key={item.id} className={item._pending ? 'bg-amber-50/50 dark:bg-amber-500/5 border-dashed' : ''}>
                              <TableCell className="py-1 text-[11px] font-medium">{prod?.name || `#${item.productId}`}</TableCell>
                              <TableCell className="py-1 text-[11px] text-right font-mono">{item.quantity}</TableCell>
                              <TableCell className="py-1 text-[11px] text-muted-foreground">{item.unit}</TableCell>
                              <TableCell className="py-1 text-[11px] text-right font-mono">{fmt(item.costPerUnit || 0)}</TableCell>
                              <TableCell className="py-1 text-[11px] text-right font-mono">{fmt((item.costPerUnit || 0) * item.quantity)}</TableCell>
                              <TableCell className="py-1">{cond ? <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border-0 text-[9px] h-4">{cond.name}</Badge> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                              <TableCell className="py-1 text-center">{item._pending ? <Badge variant="outline" className="text-[9px] h-4 border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400">Pend</Badge> : <Badge variant="outline" className="text-[9px] h-4 border-emerald-300 text-emerald-700 dark:border-emerald-600 dark:text-emerald-400">Saved</Badge>}</TableCell>
                              <TableCell className="py-1 text-right"><div className="flex items-center justify-end gap-0.5">{!item._pending && <Button size="sm" variant="ghost" onClick={() => openAttLink('stock_in_item', item.id, `${prod?.name || `#${item.productId}`} — Qty ${item.quantity} ${item.unit}`, r.warehouseId)} className="text-violet-600 h-4 w-4 p-0" title="Attach files to this item"><Paperclip className="w-2.5 h-2.5" /></Button>}<Button size="sm" variant="ghost" onClick={() => item._pending ? removePendingInItem(r.id, item.tempId) : crud.remove(`/stock-in/${r.id}/item/${item.id}`)} disabled={!item._pending && isCrudLoading('remove', `/stock-in/${r.id}/item/${item.id}`)} className="text-red-500 h-4 w-4 p-0">{!item._pending && isCrudLoading('remove', `/stock-in/${r.id}/item/${item.id}`) ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}</Button></div></TableCell>
                            </TableRow>)})}
                        </TableBody></Table></div>
                        <Pager page={stockInItemPage} totalPages={totalPages} onPageChange={setStockInItemPage} />
                      </>) : <div className="text-[10px] text-muted-foreground text-center py-2">No items yet</div>}
                    </div>)})()}

                  {/* Submit pending button */}
                  {pendingItems.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" disabled={submittingRecorder === r.id} onClick={() => submitPendingInItems(r.id, r.enterpriseId || eid || 0)} className="bg-emerald-600 text-white h-6 text-[11px]">{submittingRecorder === r.id ? <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" /> : <Check className="w-2.5 h-2.5 mr-0.5" />}Submit {pendingItems.length}</Button>
                      <Button size="sm" variant="ghost" onClick={() => clearPendingInItems(r.id)} className="h-6 text-[11px] text-muted-foreground" disabled={submittingRecorder === r.id}>Clear</Button>
                    </div>
                  )}

                  {/* ── Add Items Section ── */}
                  <div className="bg-muted/30 rounded-md p-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Add Items</span>
                      <div className="flex items-center bg-muted rounded-md p-0.5">
                        <button onClick={() => setStockInMode('pic')} className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${stockInMode === 'pic' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-muted-foreground'}`}><LayoutGrid className="w-2.5 h-2.5 inline mr-0.5" />Pick</button>
                        <button onClick={() => setStockInMode('table')} className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${stockInMode === 'table' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-muted-foreground'}`}><List className="w-2.5 h-2.5 inline mr-0.5" />Table</button>
                      </div>
                    </div>

                    {/* ── Pick Mode ── */}
                    {stockInMode === 'pic' ? (
                      (() => {
                        const sel = (stockInPickInputs['_selected'] || { productId: 0, qty: 1, unit: 'pcs', costPerUnit: 0, notes: '', conditionId: null }) as { productId: number; qty: number; unit: string; costPerUnit: number; notes: string; conditionId: number | null }
                        const pickItems = products.filter(p => !stockInSearch || p.name.toLowerCase().includes(stockInSearch.toLowerCase()) || p.sku.toLowerCase().includes(stockInSearch.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ value: String(p.id), label: p.name, sublabel: p.sku }))
                        return (<div className="space-y-1.5">
                          <div className="relative"><Search className="w-3 h-3 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Filter products..." value={stockInSearch} onChange={e => setStockInSearch(e.target.value)} className="h-6 text-[11px] pl-7" /></div>
                          {/* Mobile: stacked form */}
                          <div className="sm:hidden rounded-md border border-dashed border-emerald-300 dark:border-emerald-600 p-2 space-y-1.5">
                            <PaginatedCombobox
                              items={pickItems}
                              value={sel.productId ? String(sel.productId) : ''}
                              onChange={v => { setStockInPickInputs(prev => ({ ...prev, _selected: { productId: parseInt(v), qty: prev['_selected']?.qty || 1, unit: prev['_selected']?.unit || 'pcs', costPerUnit: prev['_selected']?.costPerUnit || 0, notes: prev['_selected']?.notes || '', conditionId: prev['_selected']?.conditionId ?? null } })) }}
                              placeholder="Select product..."
                              perPage={20}
                              contentClassName="w-64"
                              compact
                            />
                            <div className="grid grid-cols-3 gap-1.5">
                              <Input type="number" min={1} value={sel.qty || 1} onChange={e => setStockInPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], qty: parseInt(e.target.value) || 1 } as any }))} placeholder="Qty" className="h-7 text-[11px] text-right" />
                              <Select value={sel.unit || 'pcs'} onValueChange={v => setStockInPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], unit: v } as any }))}><SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-36">{SORTED_MEASUREMENTS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                              <Input type="number" step="0.01" min={0} value={sel.costPerUnit || ''} onChange={e => setStockInPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], costPerUnit: parseFloat(e.target.value) || 0 } as any }))} placeholder="Cost/U" className="h-7 text-[11px] text-right" />
                            </div>
                            <PaginatedCombobox items={conditions.filter(c=>c.enterpriseId===eid||role==='super_admin').map(c=>({value:String(c.id),label:c.name}))} value={sel.conditionId ? String(sel.conditionId) : ''} onChange={v => setStockInPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], conditionId: parseInt(v) } as any }))} placeholder="Condition —" compact contentClassName="w-56" />
                            <Button size="sm" disabled={addingItem || !sel.productId} className="h-7 text-[11px] bg-emerald-600 text-white w-full" onClick={() => { if (!sel.productId) { toast({ title: 'Select a product', variant: 'destructive' }); return }; if (!sel.qty || sel.qty < 1) { toast({ title: 'Qty ≥ 1', variant: 'destructive' }); return }; addPendingInItem(r.id, { productId: sel.productId, warehouseId: r.warehouseId, quantity: sel.qty, unit: sel.unit || 'pcs', costPerUnit: sel.costPerUnit || 0, notes: '', conditionId: sel.conditionId ?? null }); setStockInPickInputs(prev => { const n = { ...prev }; delete n['_selected']; return n }) }}>{addingItem ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}Add to receipt</Button>
                          </div>
                          {/* Desktop: table */}
                          <div className="hidden sm:block rounded-md border overflow-x-auto"><Table><TableHeader><TableRow>
                            <TableHead className="h-5 text-[10px]">Product</TableHead><TableHead className="h-5 text-[10px] text-right w-20">Qty</TableHead><TableHead className="h-5 text-[10px] w-14">Unit</TableHead><TableHead className="h-5 text-[10px] text-right w-20">Cost/U</TableHead><TableHead className="h-5 text-[10px] w-28">Condition</TableHead><TableHead className="h-5 w-10"></TableHead>
                          </TableRow></TableHeader><TableBody><TableRow className="border-dashed border-b-emerald-300 dark:border-b-emerald-600">
                            <TableCell className="py-0.5">
                              <PaginatedCombobox
                                items={pickItems}
                                value={sel.productId ? String(sel.productId) : ''}
                                onChange={v => { setStockInPickInputs(prev => ({ ...prev, _selected: { productId: parseInt(v), qty: prev['_selected']?.qty || 1, unit: prev['_selected']?.unit || 'pcs', costPerUnit: prev['_selected']?.costPerUnit || 0, notes: prev['_selected']?.notes || '', conditionId: prev['_selected']?.conditionId ?? null } })) }}
                                placeholder="Select product..."
                                perPage={20}
                                contentClassName="w-64"
                                compact
                              />
                            </TableCell>
                            <TableCell className="py-0.5"><Input type="number" min={1} value={sel.qty || 1} onChange={e => setStockInPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], qty: parseInt(e.target.value) || 1 } as any }))} className="h-5 text-[11px] w-20 text-right" /></TableCell>
                            <TableCell className="py-0.5"><Select value={sel.unit || 'pcs'} onValueChange={v => setStockInPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], unit: v } as any }))}><SelectTrigger className="h-5 text-[11px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-36">{SORTED_MEASUREMENTS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></TableCell>
                            <TableCell className="py-0.5"><Input type="number" step="0.01" min={0} value={sel.costPerUnit || ''} onChange={e => setStockInPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], costPerUnit: parseFloat(e.target.value) || 0 } as any }))} className="h-5 text-[11px] w-20 text-right" /></TableCell>
                            <TableCell className="py-0.5"><PaginatedCombobox items={conditions.filter(c=>c.enterpriseId===eid||role==='super_admin').map(c=>({value:String(c.id),label:c.name}))} value={sel.conditionId ? String(sel.conditionId) : ''} onChange={v => setStockInPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], conditionId: parseInt(v) } as any }))} placeholder="Condition —" compact contentClassName="w-56" /></TableCell>
                            <TableCell className="py-0.5 text-right"><Button size="sm" disabled={addingItem || !sel.productId} className="h-5 text-[10px] bg-emerald-600 text-white px-1.5" onClick={() => { if (!sel.productId) { toast({ title: 'Select a product', variant: 'destructive' }); return }; if (!sel.qty || sel.qty < 1) { toast({ title: 'Qty ≥ 1', variant: 'destructive' }); return }; addPendingInItem(r.id, { productId: sel.productId, warehouseId: r.warehouseId, quantity: sel.qty, unit: sel.unit || 'pcs', costPerUnit: sel.costPerUnit || 0, notes: '', conditionId: sel.conditionId ?? null }); setStockInPickInputs(prev => { const n = { ...prev }; delete n['_selected']; return n }) }}>{addingItem ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}</Button></TableCell>
                          </TableRow></TableBody></Table></div>
                        </div>)
                      })()
                    ) : (
                      // ── Table Mode ──
                      (() => { const sortedProds = [...products].sort((a, b) => a.name.localeCompare(b.name)); const totalPages = Math.ceil(sortedProds.length / STOCK_IN_PRODUCTS_PER_PAGE); const paged = sortedProds.slice((stockInProductPage - 1) * STOCK_IN_PRODUCTS_PER_PAGE, stockInProductPage * STOCK_IN_PRODUCTS_PER_PAGE)
                        return (<div>
                          {/* Mobile: stacked cards */}
                          <div className="sm:hidden space-y-1.5">
                            {paged.map(prod => { const inp = getInRowInput(prod.id)
                              return (<div key={prod.id} className="rounded-md border p-2 space-y-1.5">
                                <div className="text-[11px]"><span className="font-medium">{prod.name}</span> <span className="text-muted-foreground font-mono text-[10px]">{prod.sku}</span></div>
                                <div className="grid grid-cols-3 gap-1.5">
                                  <Input type="number" min={1} value={inp.qty} onChange={e => updateInRowInput(prod.id, { qty: parseInt(e.target.value) || 1 })} placeholder="Qty" className="h-6 text-[11px] text-right" />
                                  <Select value={inp.unit} onValueChange={v => updateInRowInput(prod.id, { unit: v })}><SelectTrigger className="h-6 text-[11px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-36">{SORTED_MEASUREMENTS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                                  <Input type="number" step="0.01" min={0} value={inp.costPerUnit || ''} onChange={e => updateInRowInput(prod.id, { costPerUnit: parseFloat(e.target.value) || 0 })} placeholder="Cost/U" className="h-6 text-[11px] text-right" />
                                </div>
                                <PaginatedCombobox items={conditions.filter(c=>c.enterpriseId===eid||role==='super_admin').map(c=>({value:String(c.id),label:c.name}))} value={inp.conditionId ? String(inp.conditionId) : ''} onChange={v => updateInRowInput(prod.id, { conditionId: parseInt(v) })} placeholder="Condition —" compact contentClassName="w-56" />
                                <Button size="sm" disabled={addingItem} className="h-6 text-[10px] bg-emerald-600 text-white w-full" onClick={() => { if (!inp.qty || inp.qty < 1) { toast({ title: 'Qty ≥ 1', variant: 'destructive' }); return }; addPendingInItem(r.id, { productId: prod.id, warehouseId: r.warehouseId, quantity: inp.qty, unit: inp.unit, costPerUnit: inp.costPerUnit || 0, notes: inp.notes || '', conditionId: inp.conditionId ?? null }); updateInRowInput(prod.id, { qty: 1, unit: 'pcs', costPerUnit: 0, notes: '', conditionId: null }) }}>{addingItem ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}Add</Button>
                              </div>)})}
                          </div>
                          {/* Desktop: table */}
                          <div className="hidden sm:block rounded-md border overflow-x-auto"><Table><TableHeader><TableRow>
                            <TableHead className="h-5 text-[10px]">Product</TableHead><TableHead className="h-5 text-[10px] text-right w-20">Qty</TableHead><TableHead className="h-5 text-[10px] w-14">Unit</TableHead><TableHead className="h-5 text-[10px] text-right w-20">Cost/U</TableHead><TableHead className="h-5 text-[10px] w-28">Condition</TableHead><TableHead className="h-5 w-10"></TableHead>
                          </TableRow></TableHeader><TableBody>
                            {paged.map(prod => { const inp = getInRowInput(prod.id)
                              return (<TableRow key={prod.id}>
                                <TableCell className="py-0.5 text-[11px]"><span className="font-medium">{prod.name}</span> <span className="text-muted-foreground font-mono text-[10px]">{prod.sku}</span></TableCell>
                                <TableCell className="py-0.5"><Input type="number" min={1} value={inp.qty} onChange={e => updateInRowInput(prod.id, { qty: parseInt(e.target.value) || 1 })} className="h-5 text-[11px] w-20 text-right" /></TableCell>
                                <TableCell className="py-0.5"><Select value={inp.unit} onValueChange={v => updateInRowInput(prod.id, { unit: v })}><SelectTrigger className="h-5 text-[11px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-36">{SORTED_MEASUREMENTS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></TableCell>
                                <TableCell className="py-0.5"><Input type="number" step="0.01" min={0} value={inp.costPerUnit || ''} onChange={e => updateInRowInput(prod.id, { costPerUnit: parseFloat(e.target.value) || 0 })} className="h-5 text-[11px] w-20 text-right" /></TableCell>
                                <TableCell className="py-0.5"><PaginatedCombobox items={conditions.filter(c=>c.enterpriseId===eid||role==='super_admin').map(c=>({value:String(c.id),label:c.name}))} value={inp.conditionId ? String(inp.conditionId) : ''} onChange={v => updateInRowInput(prod.id, { conditionId: parseInt(v) })} placeholder="Condition —" compact contentClassName="w-56" /></TableCell>
                                <TableCell className="py-0.5 text-right"><Button size="sm" disabled={addingItem} className="h-5 text-[10px] bg-emerald-600 text-white px-1.5" onClick={() => { if (!inp.qty || inp.qty < 1) { toast({ title: 'Qty ≥ 1', variant: 'destructive' }); return }; addPendingInItem(r.id, { productId: prod.id, warehouseId: r.warehouseId, quantity: inp.qty, unit: inp.unit, costPerUnit: inp.costPerUnit || 0, notes: inp.notes || '', conditionId: inp.conditionId ?? null }); updateInRowInput(prod.id, { qty: 1, unit: 'pcs', costPerUnit: 0, notes: '', conditionId: null }) }}>{addingItem ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}</Button></TableCell>
                              </TableRow>)})}
                          </TableBody></Table></div>
                          <Pager page={stockInProductPage} totalPages={totalPages} onPageChange={setStockInProductPage} />
                        </div>)
                      })()
                    )}
                  </div>
                </div>)}
              </CardContent></Card>)})}
            <Pager page={stockInRecPage} totalPages={recTotalPages} onPageChange={setStockInRecPage} />
          </>)
        })()}
      </div>
    )

    // ─── STOCK OUT
    if (page === 'stockOut') return (
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div><h1 className="text-lg font-bold flex items-center gap-1.5"><ArrowUpFromLine className="w-4 h-4 text-orange-500" />Stock Out</h1></div>
          <Button size="sm" onClick={() => openCreate('stockOut')} className="bg-gradient-to-r from-orange-500 to-red-500 text-white h-7 text-xs"><Plus className="w-3 h-3 mr-1" />New Recorder</Button>
        </div>

        {/* ── Filters ── */}
        <FilterPanel
          activeCount={(stockOutFilterSearch ? 1 : 0) + (stockOutFilterDateFrom ? 1 : 0) + (stockOutFilterDateTo ? 1 : 0) + (stockOutFilterStatus ? 1 : 0) + (stockOutFilterPerson ? 1 : 0) + (stockOutFilterWarehouse !== '' ? 1 : 0) + (stockOutFilterCondition !== '' ? 1 : 0) + (stockOutHasAttachments ? 1 : 0) + (stockOutAttSearch ? 1 : 0)}
          onClear={() => { setStockOutFilterSearch(''); setStockOutFilterDateFrom(''); setStockOutFilterDateTo(''); setStockOutFilterStatus(''); setStockOutFilterPerson(''); setStockOutFilterWarehouse(''); setStockOutFilterCondition(''); setStockOutHasAttachments(false); setStockOutAttSearch(''); setStockOutRecPage(1) }}
          resultLabel={`${stockOutData.length} recorders`}
        >
          <FilterField label="Search" width="w-48">
            <div className="relative"><Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Code, person, notes..." value={stockOutFilterSearch} onChange={e => { setStockOutFilterSearch(e.target.value); setStockOutRecPage(1) }} className="h-8 text-xs pl-7" /></div>
          </FilterField>
          <FilterField label="Date From" width="w-32"><CustomDatePicker compact value={stockOutFilterDateFrom} onChange={v => { setStockOutFilterDateFrom(v); setStockOutRecPage(1) }} /></FilterField>
          <FilterField label="Date To" width="w-32"><CustomDatePicker compact value={stockOutFilterDateTo} onChange={v => { setStockOutFilterDateTo(v); setStockOutRecPage(1) }} /></FilterField>
          <FilterField label="Warehouse" width="w-44"><PaginatedCombobox
            items={warehouses.map(w => ({ value: String(w.id), label: w.name, sublabel: w.code }))}
            value={stockOutFilterWarehouse === '' ? '_all' : String(stockOutFilterWarehouse)}
            onChange={v => { setStockOutFilterWarehouse(v === '_all' ? '' : parseInt(v)); setStockOutRecPage(1) }}
            allLabel="All Warehouses"
            placeholder="All"
          /></FilterField>
          <FilterField label="Status" width="w-32"><Select value={stockOutFilterStatus || '_all'} onValueChange={v => { setStockOutFilterStatus(v === '_all' ? '' : v); setStockOutRecPage(1) }}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="_all">All</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="partial_return">Partial Return</SelectItem><SelectItem value="returned">Returned</SelectItem></SelectContent></Select></FilterField>
          <FilterField label="Person" width="w-40"><Input value={stockOutFilterPerson} onChange={e => { setStockOutFilterPerson(e.target.value); setStockOutRecPage(1) }} placeholder="Search name..." className="h-8 text-xs" /></FilterField>
          <FilterField label="Condition" width="w-44">
            <PaginatedCombobox
              items={conditions.filter(c => role === 'super_admin' || c.enterpriseId === eid).map(c => ({ value: String(c.id), label: c.name }))}
              value={stockOutFilterCondition === '' ? '_all' : String(stockOutFilterCondition)}
              onChange={v => { setStockOutFilterCondition(v === '_all' ? '' : parseInt(v)); setStockOutRecPage(1) }}
              allLabel="All Conditions"
              placeholder="All"
            />
          </FilterField>
          <FilterField label="Has Attachments" width="w-36"><div className="flex items-center gap-1.5 h-8"><Switch checked={stockOutHasAttachments} onCheckedChange={v => { setStockOutHasAttachments(v); setStockOutRecPage(1) }} /><span className="text-xs text-muted-foreground">{stockOutHasAttachments ? 'Yes' : 'Any'}</span></div></FilterField>
          <FilterField label="Attachment Content" width="w-48"><div className="relative"><Paperclip className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Title, file name, meta key/value..." value={stockOutAttSearch} onChange={e => { setStockOutAttSearch(e.target.value); setStockOutRecPage(1) }} className="h-8 text-xs pl-7" /></div></FilterField>
        </FilterPanel>

        {(() => {
          // Filter recorders
          let filtered = [...stockOutData].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          if (stockOutFilterDateFrom) filtered = filtered.filter(r => new Date(r.createdAt) >= new Date(stockOutFilterDateFrom + 'T00:00:00'))
          if (stockOutFilterDateTo) filtered = filtered.filter(r => new Date(r.createdAt) <= new Date(stockOutFilterDateTo + 'T23:59:59'))
          if (stockOutFilterStatus) filtered = filtered.filter(r => r.status === stockOutFilterStatus)
          if (stockOutFilterPerson) filtered = filtered.filter(r => (r.personName || '').toLowerCase().includes(stockOutFilterPerson.toLowerCase()))
          if (stockOutFilterWarehouse !== '') filtered = filtered.filter(r => r.warehouseId === stockOutFilterWarehouse)
          if (stockOutFilterCondition !== '') filtered = filtered.filter(r => (r.items || []).some((it: any) => it.conditionId === stockOutFilterCondition))
          if (stockOutFilterSearch) { const q = stockOutFilterSearch.toLowerCase(); filtered = filtered.filter(r => (r.recorderCode || '').toLowerCase().includes(q) || (r.personName || '').toLowerCase().includes(q) || (r.notes || '').toLowerCase().includes(q)) }
          if (stockOutHasAttachments) filtered = filtered.filter(r => attachmentsData.some(a => (a.entityType === 'stock_out' || a.entityType === 'stock_out_item') && (a.entityId === r.id || (r.items || []).some((it: any) => it.id === a.entityId))))
          if (stockOutAttSearch) {
            const q = stockOutAttSearch.toLowerCase()
            filtered = filtered.filter(r => attachmentsData.some(a => {
              const matchesRecorder = a.entityType === 'stock_out' && a.entityId === r.id
              const matchesItem = a.entityType === 'stock_out_item' && (r.items || []).some((it: any) => it.id === a.entityId)
              if (!matchesRecorder && !matchesItem) return false
              if (a.title?.toLowerCase().includes(q)) return true
              if (a.fileName?.toLowerCase().includes(q)) return true
              if (a.description?.toLowerCase().includes(q)) return true
              if (a.mimeType?.toLowerCase().includes(q)) return true
              if ((a.metaFields || []).some(m => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q) || m.description.toLowerCase().includes(q))) return true
              return false
            }))
          }

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
                    <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); openAttLink('stock_out', r.id, `${r.recorderCode} — ${r.personName || 'Dispatch'}`, r.warehouseId) }} className="h-5 w-5 p-0 text-violet-600" title="Attach files to this dispatch"><Paperclip className="w-2.5 h-2.5" /></Button>
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
                        {/* Mobile: stacked cards */}
                        <div className="sm:hidden space-y-1.5">
                          {paged.map((item: any) => { const prod = products.find(p => p.id === item.productId); const cond = conditions.find(c => c.id === item.conditionId)
                            return (<div key={item.id} className={`rounded-md border p-2 space-y-1 ${item._pending ? 'bg-amber-50/50 dark:bg-amber-500/5 border-dashed border-amber-300 dark:border-amber-600' : ''}`}>
                              <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium truncate flex items-center gap-1">{prod?.name || `#${item.productId}`}{cond && <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border-0 text-[9px] h-4 shrink-0">{cond.name}</Badge>}</span>{item._pending ? <Badge variant="outline" className="text-[9px] h-4 border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400 shrink-0">Pend</Badge> : <Badge variant="outline" className="text-[9px] h-4 border-emerald-300 text-emerald-700 dark:border-emerald-600 dark:text-emerald-400 shrink-0">Saved</Badge>}</div>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                                <div><span className="text-muted-foreground">Qty: </span><span className="font-mono">{item.quantity}</span></div>
                                <div><span className="text-muted-foreground">Unit: </span>{item.unit}</div>
                                <div><span className="text-muted-foreground">Returnable: </span>{item.isReturnable ? <span className="text-emerald-600">Yes</span> : <span className="text-red-400">No</span>}</div>
                                <div><span className="text-muted-foreground">Deadline: </span>{item.returnDeadline || '—'}</div>
                              </div>
                              <div className="flex justify-end pt-0.5 border-t gap-1">{!item._pending && <Button size="sm" variant="ghost" onClick={() => openAttLink('stock_out_item', item.id, `${prod?.name || `#${item.productId}`} — Qty ${item.quantity} ${item.unit}`, r.warehouseId)} className="text-violet-600 h-5 w-5 p-0" title="Attach files to this item"><Paperclip className="w-2.5 h-2.5" /></Button>}<Button size="sm" variant="ghost" onClick={() => item._pending ? removePendingItem(r.id, item.tempId) : crud.remove(`/stock-out/${r.id}/item/${item.id}`)} disabled={!item._pending && isCrudLoading('remove', `/stock-out/${r.id}/item/${item.id}`)} className="text-red-500 h-5 w-5 p-0">{!item._pending && isCrudLoading('remove', `/stock-out/${r.id}/item/${item.id}`) ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}</Button></div>
                            </div>)})}
                        </div>
                        {/* Desktop: table */}
                        <div className="hidden sm:block rounded-md border overflow-hidden"><Table><TableHeader><TableRow>
                          <TableHead className="h-6 text-[10px]">Product</TableHead><TableHead className="h-6 text-[10px] text-right w-14">Qty</TableHead><TableHead className="h-6 text-[10px] w-14">Unit</TableHead><TableHead className="h-6 text-[10px] text-center w-14">Ret</TableHead><TableHead className="h-6 text-[10px] w-20">Deadline</TableHead><TableHead className="h-6 text-[10px] w-20">Condition</TableHead><TableHead className="h-6 text-[10px] text-center w-14">Status</TableHead><TableHead className="h-6 w-10"></TableHead>
                        </TableRow></TableHeader><TableBody>
                          {paged.map((item: any) => { const prod = products.find(p => p.id === item.productId); const cond = conditions.find(c => c.id === item.conditionId)
                            return (<TableRow key={item.id} className={item._pending ? 'bg-amber-50/50 dark:bg-amber-500/5 border-dashed' : ''}>
                              <TableCell className="py-1 text-[11px] font-medium">{prod?.name || `#${item.productId}`}</TableCell>
                              <TableCell className="py-1 text-[11px] text-right font-mono">{item.quantity}</TableCell>
                              <TableCell className="py-1 text-[11px] text-muted-foreground">{item.unit}</TableCell>
                              <TableCell className="py-1 text-center">{item.isReturnable ? <RotateCcw className="w-2.5 h-2.5 text-emerald-500 inline" /> : <X className="w-2.5 h-2.5 text-red-400 inline" />}</TableCell>
                              <TableCell className="py-1 text-[11px] text-muted-foreground">{item.returnDeadline || '—'}</TableCell>
                              <TableCell className="py-1">{cond ? <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border-0 text-[9px] h-4">{cond.name}</Badge> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                              <TableCell className="py-1 text-center">{item._pending ? <Badge variant="outline" className="text-[9px] h-4 border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400">Pend</Badge> : <Badge variant="outline" className="text-[9px] h-4 border-emerald-300 text-emerald-700 dark:border-emerald-600 dark:text-emerald-400">Saved</Badge>}</TableCell>
                              <TableCell className="py-1 text-right"><div className="flex items-center justify-end gap-0.5">{!item._pending && <Button size="sm" variant="ghost" onClick={() => openAttLink('stock_out_item', item.id, `${prod?.name || `#${item.productId}`} — Qty ${item.quantity} ${item.unit}`, r.warehouseId)} className="text-violet-600 h-4 w-4 p-0" title="Attach files to this item"><Paperclip className="w-2.5 h-2.5" /></Button>}<Button size="sm" variant="ghost" onClick={() => item._pending ? removePendingItem(r.id, item.tempId) : crud.remove(`/stock-out/${r.id}/item/${item.id}`)} disabled={!item._pending && isCrudLoading('remove', `/stock-out/${r.id}/item/${item.id}`)} className="text-red-500 h-4 w-4 p-0">{!item._pending && isCrudLoading('remove', `/stock-out/${r.id}/item/${item.id}`) ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}</Button></div></TableCell>
                            </TableRow>)})}
                        </TableBody></Table></div>
                        <Pager page={stockOutItemPage} totalPages={totalPages} onPageChange={setStockOutItemPage} />
                      </>) : <div className="text-[10px] text-muted-foreground text-center py-2">No items yet</div>}
                    </div>)})()}

                  {/* Submit pending button */}
                  {pendingItems.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" disabled={submittingRecorder === r.id} onClick={() => submitPendingItems(r.id, r.enterpriseId || eid || 0)} className="bg-emerald-600 text-white h-6 text-[11px]">{submittingRecorder === r.id ? <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" /> : <Check className="w-2.5 h-2.5 mr-0.5" />}Submit {pendingItems.length}</Button>
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
                        const sel = (stockOutPickInputs['_selected'] || { productId: 0, qty: 1, unit: 'pcs', isReturnable: false, returnDeadline: '', conditionId: null }) as { productId: number; qty: number; unit: string; isReturnable: boolean; returnDeadline: string; conditionId: number | null }
                        const pickItems = products.filter(p => !stockOutSearch || p.name.toLowerCase().includes(stockOutSearch.toLowerCase()) || p.sku.toLowerCase().includes(stockOutSearch.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ value: String(p.id), label: p.name, sublabel: p.sku, badge: `(${getAvailableStock(p.id, r.warehouseId)})` }))
                        return (<div className="space-y-1.5">
                          <div className="relative"><Search className="w-3 h-3 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Filter products..." value={stockOutSearch} onChange={e => setStockOutSearch(e.target.value)} className="h-6 text-[11px] pl-7" /></div>
                          {/* Mobile: stacked form */}
                          <div className="sm:hidden rounded-md border border-dashed border-blue-300 dark:border-blue-600 p-2 space-y-1.5">
                            <PaginatedCombobox
                              items={pickItems}
                              value={sel.productId ? String(sel.productId) : ''}
                              onChange={v => { setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], productId: parseInt(v), qty: prev['_selected']?.qty || 1, unit: prev['_selected']?.unit || 'pcs', isReturnable: prev['_selected']?.isReturnable || false, returnDeadline: prev['_selected']?.returnDeadline || '', conditionId: prev['_selected']?.conditionId ?? null } })) }}
                              placeholder="Select product..."
                              perPage={20}
                              contentClassName="w-64"
                              compact
                            />
                            <div className="grid grid-cols-3 gap-1.5">
                              <Input type="number" min={1} max={sel.productId ? getAvailableStock(sel.productId, r.warehouseId) : undefined} value={sel.qty || 1} onChange={e => setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], qty: parseInt(e.target.value) || 1 } }))} placeholder="Qty" className="h-7 text-[11px] text-right" />
                              <Select value={sel.unit || 'pcs'} onValueChange={v => setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], unit: v } }))}><SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-36">{SORTED_MEASUREMENTS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                              <div className="flex items-center justify-center gap-1"><Switch checked={sel.isReturnable || false} onCheckedChange={v => setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], isReturnable: v } }))} className="scale-75" /><span className="text-[9px] text-muted-foreground">Ret</span></div>
                            </div>
                            {sel.isReturnable && <CustomDatePicker value={sel.returnDeadline || ''} onChange={v => setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], returnDeadline: v } }))} />}
                            <PaginatedCombobox items={conditions.filter(c=>c.enterpriseId===eid||role==='super_admin').map(c=>({value:String(c.id),label:c.name}))} value={sel.conditionId ? String(sel.conditionId) : ''} onChange={v => setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], conditionId: parseInt(v) } }))} placeholder="Condition —" compact contentClassName="w-56" />
                            <Button size="sm" disabled={addingItem || !sel.productId} className="h-7 text-[11px] bg-blue-600 text-white w-full" onClick={() => { if (!sel.productId) { toast({ title: 'Select a product', variant: 'destructive' }); return }; if (!sel.qty || sel.qty < 1) { toast({ title: 'Qty ≥ 1', variant: 'destructive' }); return }; const avail = getAvailableStock(sel.productId, r.warehouseId); if (sel.qty > avail) { toast({ title: `Only ${avail} in stock`, variant: 'destructive' }); return }; addPendingItem(r.id, { productId: sel.productId, warehouseId: r.warehouseId, quantity: sel.qty, unit: sel.unit || 'pcs', isReturnable: sel.isReturnable || false, returnDeadline: sel.returnDeadline || null, notes: '', conditionId: sel.conditionId ?? null }); setStockOutPickInputs(prev => { const n = { ...prev }; delete n['_selected']; return n }) }}>{addingItem ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}Add to recorder</Button>
                          </div>
                          {/* Desktop: table */}
                          <div className="hidden sm:block rounded-md border overflow-hidden"><Table><TableHeader><TableRow>
                            <TableHead className="h-5 text-[10px]">Product</TableHead><TableHead className="h-5 text-[10px] text-right w-16">In Stock</TableHead><TableHead className="h-5 text-[10px] text-right w-20">Qty</TableHead><TableHead className="h-5 text-[10px] w-14">Unit</TableHead><TableHead className="h-5 text-[10px] text-center w-12">Ret?</TableHead><TableHead className="h-5 text-[10px] w-20">Deadline</TableHead><TableHead className="h-5 text-[10px] w-28">Condition</TableHead><TableHead className="h-5 w-10"></TableHead>
                          </TableRow></TableHeader><TableBody><TableRow className="border-dashed border-b-blue-300 dark:border-b-blue-600">
                            <TableCell className="py-0.5">
                              <PaginatedCombobox
                                items={pickItems}
                                value={sel.productId ? String(sel.productId) : ''}
                                onChange={v => { setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], productId: parseInt(v), qty: prev['_selected']?.qty || 1, unit: prev['_selected']?.unit || 'pcs', isReturnable: prev['_selected']?.isReturnable || false, returnDeadline: prev['_selected']?.returnDeadline || '', conditionId: prev['_selected']?.conditionId ?? null } })) }}
                                placeholder="Select product..."
                                perPage={20}
                                contentClassName="w-64"
                                compact
                              />
                            </TableCell>
                            <TableCell className="py-0.5 text-[11px] text-right font-mono">{sel.productId ? <span className={getAvailableStock(sel.productId, r.warehouseId) > 0 ? 'text-emerald-600' : 'text-red-500'}>{getAvailableStock(sel.productId, r.warehouseId)}</span> : '—'}</TableCell>
                            <TableCell className="py-0.5"><Input type="number" min={1} max={sel.productId ? getAvailableStock(sel.productId, r.warehouseId) : undefined} value={sel.qty || 1} onChange={e => setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], qty: parseInt(e.target.value) || 1 } }))} className="h-5 text-[11px] w-20 text-right" /></TableCell>
                            <TableCell className="py-0.5"><Select value={sel.unit || 'pcs'} onValueChange={v => setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], unit: v } }))}><SelectTrigger className="h-5 text-[11px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-36">{SORTED_MEASUREMENTS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></TableCell>
                            <TableCell className="py-0.5 text-center"><Switch checked={sel.isReturnable || false} onCheckedChange={v => setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], isReturnable: v } }))} className="scale-75" /></TableCell>
                            <TableCell className="py-0.5">{sel.isReturnable ? <CustomDatePicker value={sel.returnDeadline || ''} onChange={v => setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], returnDeadline: v } }))} /> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="py-0.5"><PaginatedCombobox items={conditions.filter(c=>c.enterpriseId===eid||role==='super_admin').map(c=>({value:String(c.id),label:c.name}))} value={sel.conditionId ? String(sel.conditionId) : ''} onChange={v => setStockOutPickInputs(prev => ({ ...prev, _selected: { ...prev['_selected'], conditionId: parseInt(v) } }))} placeholder="Condition —" compact contentClassName="w-56" /></TableCell>
                            <TableCell className="py-0.5 text-right"><Button size="sm" disabled={addingItem || !sel.productId} className="h-5 text-[10px] bg-blue-600 text-white px-1.5" onClick={() => { if (!sel.productId) { toast({ title: 'Select a product', variant: 'destructive' }); return }; if (!sel.qty || sel.qty < 1) { toast({ title: 'Qty ≥ 1', variant: 'destructive' }); return }; const avail = getAvailableStock(sel.productId, r.warehouseId); if (sel.qty > avail) { toast({ title: `Only ${avail} in stock`, variant: 'destructive' }); return }; addPendingItem(r.id, { productId: sel.productId, warehouseId: r.warehouseId, quantity: sel.qty, unit: sel.unit || 'pcs', isReturnable: sel.isReturnable || false, returnDeadline: sel.returnDeadline || null, notes: '', conditionId: sel.conditionId ?? null }); setStockOutPickInputs(prev => { const n = { ...prev }; delete n['_selected']; return n }) }}>{addingItem ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}</Button></TableCell>
                          </TableRow></TableBody></Table></div>
                        </div>)
                      })()
                    ) : (
                      // ── Table Mode: each product = its own row (spreadsheet), with pagination ──
                      (() => { const sortedProds = [...products].sort((a, b) => a.name.localeCompare(b.name)); const totalPages = Math.ceil(sortedProds.length / STOCK_OUT_PRODUCTS_PER_PAGE); const paged = sortedProds.slice((stockOutProductPage - 1) * STOCK_OUT_PRODUCTS_PER_PAGE, stockOutProductPage * STOCK_OUT_PRODUCTS_PER_PAGE)
                        return (<div>
                          {/* Mobile: stacked cards */}
                          <div className="sm:hidden space-y-1.5">
                            {paged.map(prod => { const inp = getRowInput(prod.id); const stk = getAvailableStock(prod.id, r.warehouseId)
                              return (<div key={prod.id} className="rounded-md border p-2 space-y-1.5">
                                <div className="flex items-center justify-between gap-2"><div className="text-[11px] min-w-0"><span className="font-medium">{prod.name}</span> <span className="text-muted-foreground font-mono text-[10px]">{prod.sku}</span></div><span className={`text-[11px] font-mono font-semibold shrink-0 ${stk > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{stk}</span></div>
                                <div className="grid grid-cols-3 gap-1.5">
                                  <Input type="number" min={1} max={stk} value={inp.qty} onChange={e => updateRowInput(prod.id, { qty: parseInt(e.target.value) || 1 })} placeholder="Qty" className="h-6 text-[11px] text-right" />
                                  <Select value={inp.unit} onValueChange={v => updateRowInput(prod.id, { unit: v })}><SelectTrigger className="h-6 text-[11px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-36">{SORTED_MEASUREMENTS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                                  <div className="flex items-center justify-center gap-1"><Switch checked={inp.isReturnable} onCheckedChange={v => updateRowInput(prod.id, { isReturnable: v })} className="scale-75" /><span className="text-[9px] text-muted-foreground">Ret</span></div>
                                </div>
                                {inp.isReturnable && <CustomDatePicker value={inp.returnDeadline} onChange={v => updateRowInput(prod.id, { returnDeadline: v })} />}
                                <PaginatedCombobox items={conditions.filter(c=>c.enterpriseId===eid||role==='super_admin').map(c=>({value:String(c.id),label:c.name}))} value={inp.conditionId ? String(inp.conditionId) : ''} onChange={v => updateRowInput(prod.id, { conditionId: parseInt(v) })} placeholder="Condition —" compact contentClassName="w-56" />
                                <Button size="sm" disabled={addingItem || stk <= 0} className="h-6 text-[10px] bg-blue-600 text-white w-full" onClick={() => { if (!inp.qty || inp.qty < 1) { toast({ title: 'Qty ≥ 1', variant: 'destructive' }); return }; if (inp.qty > stk) { toast({ title: `Only ${stk} in stock`, variant: 'destructive' }); return }; addPendingItem(r.id, { productId: prod.id, warehouseId: r.warehouseId, quantity: inp.qty, unit: inp.unit, isReturnable: inp.isReturnable, returnDeadline: inp.returnDeadline || null, notes: '', conditionId: inp.conditionId ?? null }); updateRowInput(prod.id, { qty: 1, unit: 'pcs', isReturnable: false, returnDeadline: '', conditionId: null }) }}>{addingItem ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}Add</Button>
                              </div>)})}
                          </div>
                          {/* Desktop: table */}
                          <div className="hidden sm:block rounded-md border overflow-hidden"><Table><TableHeader><TableRow>
                            <TableHead className="h-5 text-[10px]">Product</TableHead><TableHead className="h-5 text-[10px] text-right w-16">In Stock</TableHead><TableHead className="h-5 text-[10px] text-right w-20">Qty</TableHead><TableHead className="h-5 text-[10px] w-14">Unit</TableHead><TableHead className="h-5 text-[10px] text-center w-12">Ret?</TableHead><TableHead className="h-5 text-[10px] w-20">Deadline</TableHead><TableHead className="h-5 text-[10px] w-28">Condition</TableHead><TableHead className="h-5 w-10"></TableHead>
                          </TableRow></TableHeader><TableBody>
                            {paged.map(prod => { const inp = getRowInput(prod.id); const stk = getAvailableStock(prod.id, r.warehouseId)
                              return (<TableRow key={prod.id}>
                                <TableCell className="py-0.5 text-[11px]"><span className="font-medium">{prod.name}</span> <span className="text-muted-foreground font-mono text-[10px]">{prod.sku}</span></TableCell>
                                <TableCell className="py-0.5 text-[11px] text-right font-mono"><span className={stk > 0 ? 'text-emerald-600' : 'text-red-500'}>{stk}</span></TableCell>
                                <TableCell className="py-0.5"><Input type="number" min={1} max={stk} value={inp.qty} onChange={e => updateRowInput(prod.id, { qty: parseInt(e.target.value) || 1 })} className="h-5 text-[11px] w-20 text-right" /></TableCell>
                                <TableCell className="py-0.5"><Select value={inp.unit} onValueChange={v => updateRowInput(prod.id, { unit: v })}><SelectTrigger className="h-5 text-[11px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-36">{SORTED_MEASUREMENTS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></TableCell>
                                <TableCell className="py-0.5 text-center"><Switch checked={inp.isReturnable} onCheckedChange={v => updateRowInput(prod.id, { isReturnable: v })} className="scale-75" /></TableCell>
                                <TableCell className="py-0.5">{inp.isReturnable ? <CustomDatePicker value={inp.returnDeadline} onChange={v => updateRowInput(prod.id, { returnDeadline: v })} /> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                                <TableCell className="py-0.5"><PaginatedCombobox items={conditions.filter(c=>c.enterpriseId===eid||role==='super_admin').map(c=>({value:String(c.id),label:c.name}))} value={inp.conditionId ? String(inp.conditionId) : ''} onChange={v => updateRowInput(prod.id, { conditionId: parseInt(v) })} placeholder="Condition —" compact contentClassName="w-56" /></TableCell>
                                <TableCell className="py-0.5 text-right"><Button size="sm" disabled={addingItem || stk <= 0} className="h-5 text-[10px] bg-blue-600 text-white px-1.5" onClick={() => { if (!inp.qty || inp.qty < 1) { toast({ title: 'Qty ≥ 1', variant: 'destructive' }); return }; if (inp.qty > stk) { toast({ title: `Only ${stk} in stock`, variant: 'destructive' }); return }; addPendingItem(r.id, { productId: prod.id, warehouseId: r.warehouseId, quantity: inp.qty, unit: inp.unit, isReturnable: inp.isReturnable, returnDeadline: inp.returnDeadline || null, notes: '', conditionId: inp.conditionId ?? null }); updateRowInput(prod.id, { qty: 1, unit: 'pcs', isReturnable: false, returnDeadline: '', conditionId: null }) }}>{addingItem ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}</Button></TableCell>
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

    // ─── RETURNS
    if (page === 'returns') return (
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div><h1 className="text-lg font-bold flex items-center gap-1.5"><RotateCcw className="w-4 h-4 text-violet-500" />Returns</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Process returns for stock-outed items — or mark flagged items as non-returnable when they cannot be returned (with a reason).</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={openNewGroupNonRetDlg} className="bg-gradient-to-r from-rose-600 to-red-600 text-white h-7 text-xs"><Plus className="w-3 h-3 mr-1" />New Group Non-Returnable</Button>
            <Button size="sm" onClick={openNewGroupReturnDlg} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white h-7 text-xs"><Plus className="w-3 h-3 mr-1" />New Group Return</Button>
          </div>
        </div>

        <Tabs value={returnsTab} onValueChange={v => setReturnsTab(v as 'flagged' | 'not_flagged' | 'records' | 'non_returnable')}>
          <TabsList className="grid grid-cols-4 w-full max-w-3xl h-9">
            <TabsTrigger value="flagged" className="text-xs gap-1"><RotateCcw className="w-3 h-3" />Flagged for Return</TabsTrigger>
            <TabsTrigger value="not_flagged" className="text-xs gap-1"><Package className="w-3 h-3" />Other Stock-Outs</TabsTrigger>
            <TabsTrigger value="records" className="text-xs gap-1"><Layers className="w-3 h-3" />Return Records</TabsTrigger>
            <TabsTrigger value="non_returnable" className="text-xs gap-1"><Ban className="w-3 h-3" />Non-Returnable</TabsTrigger>
          </TabsList>

          {/* Items view — rendered for both 'flagged' and 'not_flagged' tabs */}
          {returnsTab !== 'records' && returnsTab !== 'non_returnable' && (
          <div className="mt-3 space-y-3">
            {/* Advanced Filters */}
            <FilterPanel
              activeCount={(returnsSearch ? 1 : 0) + (returnsWarehouseFilter !== '' ? 1 : 0) + (returnsFilterDateFrom ? 1 : 0) + (returnsFilterDateTo ? 1 : 0) + (returnsFilterRecorder ? 1 : 0) + (returnsFilterProgress ? 1 : 0) + (returnsFilterCategory !== '' ? 1 : 0) + (returnsFilterPerson.trim() ? 1 : 0) + (returnsFilterCondition !== '' ? 1 : 0) + (returnsAttSearch ? 1 : 0)}
              onClear={() => { setReturnsSearch(''); setReturnsWarehouseFilter(''); setReturnsFilterDateFrom(''); setReturnsFilterDateTo(''); setReturnsFilterRecorder(''); setReturnsFilterProgress(''); setReturnsFilterCategory(''); setReturnsFilterPerson(''); setReturnsFilterCondition(''); setReturnsAttSearch(''); setReturnsPage(1) }}
              resultLabel={`${returnsData.length} item(s)`}
            >
              <FilterField label="Search" width="w-56">
                <div className="relative"><Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Product, SKU, person, code..." value={returnsSearch} onChange={e => { setReturnsSearch(e.target.value); setReturnsPage(1) }} className="h-8 text-xs pl-7" /></div>
              </FilterField>
              <FilterField label="Warehouse" width="w-44">
                <Popover open={returnsWhComboOpen} onOpenChange={o => { setReturnsWhComboOpen(o); if (!o) setReturnsWhComboSearch('') }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="h-8 text-xs justify-between w-full font-normal px-2">
                      <span className="truncate">{returnsWarehouseFilter === '' ? 'All Warehouses' : (warehouses.find(w => w.id === returnsWarehouseFilter)?.name || `#${returnsWarehouseFilter}`)}</span>
                      <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-0" align="start">
                    <div className="p-1.5 border-b sticky top-0 bg-popover">
                      <div className="relative"><Search className="w-3 h-3 text-muted-foreground absolute left-1.5 top-1/2 -translate-y-1/2" /><Input placeholder="Search warehouse..." value={returnsWhComboSearch} onChange={e => setReturnsWhComboSearch(e.target.value)} className="h-7 text-xs pl-6" /></div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <button onClick={() => { setReturnsWarehouseFilter(''); setReturnsPage(1); setReturnsWhComboOpen(false) }} className={`w-full text-left px-2 py-1.5 text-xs hover:bg-violet-50 dark:hover:bg-violet-500/10 ${returnsWarehouseFilter === '' ? 'bg-violet-50 dark:bg-violet-500/10 font-medium text-violet-700 dark:text-violet-400' : ''}`}>All Warehouses</button>
                      {warehouses.filter(w => { const s = returnsWhComboSearch.toLowerCase(); return !s || w.name.toLowerCase().includes(s) || (w.code || '').toLowerCase().includes(s) }).map(w => (
                        <button key={w.id} onClick={() => { setReturnsWarehouseFilter(w.id); setReturnsPage(1); setReturnsWhComboOpen(false) }} className={`w-full text-left px-2 py-1.5 text-xs hover:bg-violet-50 dark:hover:bg-violet-500/10 ${returnsWarehouseFilter === w.id ? 'bg-violet-50 dark:bg-violet-500/10 font-medium text-violet-700 dark:text-violet-400' : ''}`}>{w.name} <span className="text-[9px] text-muted-foreground font-mono">{w.code}</span></button>
                      ))}
                      {warehouses.filter(w => { const s = returnsWhComboSearch.toLowerCase(); return !s || w.name.toLowerCase().includes(s) || (w.code || '').toLowerCase().includes(s) }).length === 0 && <div className="px-2 py-2 text-[11px] text-muted-foreground text-center">No warehouse matches.</div>}
                    </div>
                  </PopoverContent>
                </Popover>
              </FilterField>
              <FilterField label="Category" width="w-44">
                <PaginatedCombobox
                  items={categories.filter(c => role === 'super_admin' || c.enterpriseId === eid).map(c => ({ value: String(c.id), label: c.name }))}
                  value={returnsFilterCategory === '' ? '_all' : String(returnsFilterCategory)}
                  onChange={v => { setReturnsFilterCategory(v === '_all' ? '' : parseInt(v)); setReturnsPage(1) }}
                  allLabel="All Categories"
                  placeholder="All"
                />
              </FilterField>
              <FilterField label="Condition" width="w-44">
                <PaginatedCombobox
                  items={conditions.filter(c => role === 'super_admin' || c.enterpriseId === eid).map(c => ({ value: String(c.id), label: c.name }))}
                  value={returnsFilterCondition === '' ? '_all' : String(returnsFilterCondition)}
                  onChange={v => { setReturnsFilterCondition(v === '_all' ? '' : parseInt(v)); setReturnsPage(1) }}
                  allLabel="All Conditions"
                  placeholder="All"
                />
              </FilterField>
              <FilterField label="Person / Supplier" width="w-44">
                <Input value={returnsFilterPerson} onChange={e => { setReturnsFilterPerson(e.target.value); setReturnsPage(1) }} placeholder="Name contains..." className="h-8 text-xs" />
              </FilterField>
              <FilterField label="Out Date From" width="w-32"><CustomDatePicker compact value={returnsFilterDateFrom} onChange={v => { setReturnsFilterDateFrom(v); setReturnsPage(1) }} /></FilterField>
              <FilterField label="Out Date To" width="w-32"><CustomDatePicker compact value={returnsFilterDateTo} onChange={v => { setReturnsFilterDateTo(v); setReturnsPage(1) }} /></FilterField>
              <FilterField label="Recorder Code" width="w-40"><Input value={returnsFilterRecorder} onChange={e => { setReturnsFilterRecorder(e.target.value); setReturnsPage(1) }} placeholder="SOUT-..." className="h-8 text-xs" /></FilterField>
              <FilterField label="Return Progress" width="w-40">
                <Select value={returnsFilterProgress || '_all'} onValueChange={v => { setReturnsFilterProgress(v === '_all' ? '' : v as 'none' | 'partial' | 'full'); setReturnsPage(1) }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent><SelectItem value="_all">All</SelectItem><SelectItem value="none">Not started</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="full">Fully returned</SelectItem></SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Attachment Content" width="w-48"><div className="relative"><Paperclip className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Title, file name, meta key/value..." value={returnsAttSearch} onChange={e => { setReturnsAttSearch(e.target.value); setReturnsPage(1) }} className="h-8 text-xs pl-7" /></div></FilterField>
            </FilterPanel>

            {returnsLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-violet-500" /><span className="ml-2 text-sm text-muted-foreground">Loading returns...</span></div>
            ) : (() => {
              // Apply search + advanced filters
              const q = returnsSearch.toLowerCase()
              const recQ = returnsFilterRecorder.toLowerCase()
              const personQ = returnsFilterPerson.toLowerCase().trim()
              const filtered = returnsData.filter(it => {
                if (returnsWarehouseFilter !== '' && it.warehouseId !== returnsWarehouseFilter) return false
                if (returnsFilterCategory !== '' && it.product?.categoryId !== returnsFilterCategory) return false
                if (returnsFilterCondition !== '' && it.conditionId !== returnsFilterCondition) return false
                if (personQ && !(it.recorder?.personName || '').toLowerCase().includes(personQ)) return false
                if (returnsFilterDateFrom && new Date(it.createdAt) < new Date(returnsFilterDateFrom + 'T00:00:00')) return false
                if (returnsFilterDateTo && new Date(it.createdAt) > new Date(returnsFilterDateTo + 'T23:59:59')) return false
                if (recQ && !(it.recorder?.recorderCode || '').toLowerCase().includes(recQ)) return false
                if (returnsFilterProgress) {
                  if (returnsFilterProgress === 'none' && it.returnedQty > 0) return false
                  if (returnsFilterProgress === 'partial' && !(it.returnedQty > 0 && it.remainingQty > 0)) return false
                  if (returnsFilterProgress === 'full' && it.remainingQty > 0) return false
                }
                if (returnsAttSearch) {
                  const aq = returnsAttSearch.toLowerCase()
                  // Collect all attachment IDs relevant to this returnable item:
                  //   - stock_out_item attachments on this item
                  //   - return attachments on any Return row linked to this item
                  //   - non_returnable attachments on any NonReturnable row linked to this item
                  const returnIds = (it.returns || []).map(r => r.id)
                  const nonRetIds = (it.nonReturnables || []).map(n => n.id)
                  const matches = attachmentsData.some(a => {
                    const linked = (a.entityType === 'stock_out_item' && a.entityId === it.id)
                      || (a.entityType === 'return' && returnIds.includes(a.entityId as number))
                      || (a.entityType === 'non_returnable' && nonRetIds.includes(a.entityId as number))
                    if (!linked) return false
                    if (a.title?.toLowerCase().includes(aq)) return true
                    if (a.fileName?.toLowerCase().includes(aq)) return true
                    if (a.description?.toLowerCase().includes(aq)) return true
                    if (a.mimeType?.toLowerCase().includes(aq)) return true
                    if ((a.metaFields || []).some(m => m.key.toLowerCase().includes(aq) || m.value.toLowerCase().includes(aq) || m.description.toLowerCase().includes(aq))) return true
                    return false
                  })
                  if (!matches) return false
                }
                if (!q) return true
                return (it.product?.name || '').toLowerCase().includes(q)
                  || (it.product?.sku || '').toLowerCase().includes(q)
                  || (it.recorder?.personName || '').toLowerCase().includes(q)
                  || (it.recorder?.recorderCode || '').toLowerCase().includes(q)
              })
              const totalPages = Math.ceil(filtered.length / RETURNS_PER_PAGE) || 1
              const safePage = Math.min(returnsPage, totalPages)
              const paged = filtered.slice((safePage - 1) * RETURNS_PER_PAGE, safePage * RETURNS_PER_PAGE)

              // Group by personName for the "Group Return" feature
              const groups: Record<string, ReturnableItem[]> = {}
              for (const it of filtered) {
                const key = it.recorder?.personName?.trim() || '(no person)'
                if (!groups[key]) groups[key] = []
                groups[key].push(it)
              }
              const groupEntries = Object.entries(groups).filter(([, items]) => items.length > 0).sort((a, b) => a[0].localeCompare(b[0]))

              if (filtered.length === 0) return <div className="text-center text-sm text-muted-foreground py-10">No items to return in this tab.</div>

              return (<>
                {/* Group return bar — paginated person buttons */}
                {groupEntries.length > 0 && (() => {
                  const grpTotalPages = Math.ceil(groupEntries.length / RETURNS_GROUP_PER_PAGE) || 1
                  const grpSafePage = Math.min(returnsGroupPage, grpTotalPages)
                  const grpPaged = groupEntries.slice((grpSafePage - 1) * RETURNS_GROUP_PER_PAGE, grpSafePage * RETURNS_GROUP_PER_PAGE)
                  return (
                  <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-md p-2">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5"><Users className="w-3 h-3 text-violet-600" /><span className="text-[10px] font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wider">Group Return by Person</span><Badge className="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-0 text-[9px] h-4">{groupEntries.length}</Badge></div>
                      <span className="text-[10px] text-muted-foreground">{grpSafePage}/{grpTotalPages}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {grpPaged.map(([person, items]) => (
                        <button key={person} onClick={() => openGroupReturnDlg(person, items)} className="text-[11px] px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-500/30 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition flex items-center gap-1">
                          <Users className="w-3 h-3 text-violet-500" />
                          <span className="font-medium">{person}</span>
                          <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-0 text-[9px] h-4">{items.length}</Badge>
                        </button>
                      ))}
                    </div>
                    {grpTotalPages > 1 && (
                      <div className="flex items-center justify-end gap-1 mt-1.5 pt-1.5 border-t border-violet-200 dark:border-violet-500/20">
                        <Button size="sm" variant="outline" disabled={grpSafePage <= 1} onClick={() => setReturnsGroupPage(grpSafePage - 1)} className="h-6 w-6 p-0"><ChevronLeft className="w-3 h-3" /></Button>
                        <Button size="sm" variant="outline" disabled={grpSafePage >= grpTotalPages} onClick={() => setReturnsGroupPage(grpSafePage + 1)} className="h-6 w-6 p-0"><ChevronRight className="w-3 h-3" /></Button>
                      </div>
                    )}
                  </div>
                  )
                })()}

                {/* Mobile: stacked cards */}
                <div className="sm:hidden space-y-2">
                  {paged.map(it => {
                    const wh = warehouses.find(w => w.id === it.warehouseId); const cond = conditions.find(c => c.id === it.conditionId)
                    return (<Card key={it.id} className="shadow-sm"><CardContent className="p-2.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><div className="text-[11px] font-medium truncate flex items-center gap-1">{it.product?.name || `#${it.productId}`}{cond && <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border-0 text-[9px] h-4 shrink-0">{cond.name}</Badge>}</div>
                          <div className="text-[9px] text-muted-foreground font-mono">{it.product?.sku}</div></div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button size="sm" variant="ghost" onClick={() => openReturnSourceDlg(it)} className="h-5 w-5 p-0 text-muted-foreground" title="View source record"><Eye className="w-3 h-3" /></Button>
                          <Button size="sm" onClick={() => openReturnDlg(it)} className="h-5 text-[10px] bg-violet-600 text-white px-1.5" title="Return this item"><RotateCcw className="w-2.5 h-2.5 mr-0.5" />Return</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                        <div><span className="text-muted-foreground">Out: </span><span className="font-mono font-medium">{it.quantity}</span> <span className="text-muted-foreground">{it.unit}</span></div>
                        <div><span className="text-muted-foreground">Returned: </span><span className="font-mono font-medium text-emerald-600">{it.returnedQty}</span></div>
                        {returnsTab === 'flagged' && (it.nonReturnableQty || 0) > 0 && <div><span className="text-muted-foreground">Non-Ret: </span><span className="font-mono font-medium text-rose-600">{it.nonReturnableQty}</span></div>}
                        <div><span className="text-muted-foreground">Remaining: </span><span className="font-mono font-medium text-violet-600">{it.remainingQty}</span></div>
                        <div><span className="text-muted-foreground">Warehouse: </span><span className="font-medium truncate">{wh?.name || `#${it.warehouseId}`}</span></div>
                        <div className="col-span-2"><span className="text-muted-foreground">Person: </span><span className="font-medium">{it.recorder?.personName || '—'}</span></div>
                        <div className="col-span-2"><span className="text-muted-foreground">Recorder: </span><span className="font-mono text-[10px]">{it.recorder?.recorderCode}</span> <span className="text-muted-foreground">· {new Date(it.createdAt).toLocaleDateString()}</span></div>
                        {it.returnDeadline && <div className="col-span-2"><span className="text-muted-foreground">Deadline: </span><span className="font-medium text-amber-600">{it.returnDeadline}</span></div>}
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-violet-500" style={{ width: `${Math.min(100, (it.returnedQty / it.quantity) * 100)}%` }} /></div>
                    </CardContent></Card>
                  )
                  })}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block rounded-md border overflow-hidden"><Table>
                  <TableHeader><TableRow>
                    <TableHead className="h-7 text-[10px]">Product</TableHead>
                    <TableHead className="h-7 text-[10px]">Person</TableHead>
                    <TableHead className="h-7 text-[10px]">Recorder</TableHead>
                    <TableHead className="h-7 text-[10px] text-right w-14">Out</TableHead>
                    <TableHead className="h-7 text-[10px] text-right w-16">Returned</TableHead>
                    {returnsTab === 'flagged' && <TableHead className="h-7 text-[10px] text-right w-16">Non-Ret</TableHead>}
                    <TableHead className="h-7 text-[10px] text-right w-16">Remaining</TableHead>
                    <TableHead className="h-7 text-[10px] w-24">Deadline</TableHead>
                    <TableHead className="h-7 text-[10px] w-20">Condition</TableHead>
                    <TableHead className="h-7 text-[10px] w-28">Progress</TableHead>
                    <TableHead className="h-7 w-20 text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {paged.map(it => {
                      const wh = warehouses.find(w => w.id === it.warehouseId); const cond = conditions.find(c => c.id === it.conditionId)
                      const pct = Math.min(100, (it.returnedQty / it.quantity) * 100)
                      return (<TableRow key={it.id}>
                        <TableCell className="py-1 text-[11px]"><div className="font-medium truncate">{it.product?.name || `#${it.productId}`}</div><div className="text-[9px] text-muted-foreground font-mono">{it.product?.sku}</div><div className="text-[9px] text-muted-foreground">{wh?.name || `#${it.warehouseId}`}</div></TableCell>
                        <TableCell className="py-1 text-[11px]">{it.recorder?.personName || '—'}</TableCell>
                        <TableCell className="py-1 text-[11px]"><span className="font-mono">{it.recorder?.recorderCode}</span><div className="text-[9px] text-muted-foreground">{new Date(it.createdAt).toLocaleDateString()}</div></TableCell>
                        <TableCell className="py-1 text-[11px] text-right font-mono">{it.quantity} <span className="text-muted-foreground">{it.unit}</span></TableCell>
                        <TableCell className="py-1 text-[11px] text-right font-mono text-emerald-600">{it.returnedQty}</TableCell>
                        {returnsTab === 'flagged' && <TableCell className="py-1 text-[11px] text-right font-mono text-rose-600">{it.nonReturnableQty || 0}</TableCell>}
                        <TableCell className="py-1 text-[11px] text-right font-mono text-violet-600 font-semibold">{it.remainingQty}</TableCell>
                        <TableCell className="py-1 text-[11px]">{it.returnDeadline ? <span className="text-amber-600">{it.returnDeadline}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="py-1">{cond ? <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border-0 text-[9px] h-4">{cond.name}</Badge> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="py-1"><div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-violet-500" style={{ width: `${pct}%` }} /></div><div className="text-[9px] text-muted-foreground mt-0.5 text-center">{pct.toFixed(0)}%</div></TableCell>
                        <TableCell className="py-1 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button size="sm" variant="ghost" onClick={() => openReturnSourceDlg(it)} className="h-5 w-5 p-0 text-muted-foreground" title="View source record"><Eye className="w-3 h-3" /></Button>
                            <Button size="sm" onClick={() => openReturnDlg(it)} className="h-5 text-[10px] bg-violet-600 text-white px-1.5" title="Return this item"><RotateCcw className="w-2.5 h-2.5 mr-0.5" />Return</Button>
                            {returnsTab === 'flagged' && <Button size="sm" onClick={() => openNonRetDlg(it)} className="h-5 text-[10px] bg-rose-600 text-white px-1.5" title="Mark as non-returnable (with reason)"><Ban className="w-2.5 h-2.5 mr-0.5" />Non-Ret</Button>}
                          </div>
                        </TableCell>
                      </TableRow>)
                    })}
                  </TableBody>
                </Table></div>
                <Pager page={safePage} totalPages={totalPages} onPageChange={setReturnsPage} />
              </>)
            })()}
          </div>
          )}

          {/* ── Return Records tab (3rd tab) — paginated list of created group-return records ── */}
          {returnsTab === 'records' && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-xs font-semibold">Return Records</span>
                <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-0 text-[9px] h-4">{groupReturnRecords.length}</Badge>
                <span className="text-[10px] text-muted-foreground hidden sm:inline">· group-return records created via "New Group Return" (each restocks inventory &amp; creates a Lot)</span>
              </div>
              {groupReturnRecordsLoading && <Loader2 className="w-3 h-3 animate-spin text-violet-500" />}
            </div>
            {groupReturnRecordsLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-violet-500" /><span className="ml-2 text-sm text-muted-foreground">Loading return records...</span></div>
            ) : groupReturnRecords.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-10">No group-return records yet. Click <span className="font-semibold text-violet-600">New Group Return</span> to create one.</div>
            ) : (() => {
              const recTotalPages = Math.ceil(groupReturnRecords.length / RETURN_RECORDS_PER_PAGE) || 1
              const recSafePage = Math.min(returnRecordsPage, recTotalPages)
              const recPaged = groupReturnRecords.slice((recSafePage - 1) * RETURN_RECORDS_PER_PAGE, recSafePage * RETURN_RECORDS_PER_PAGE)
              return (<>
                <div className="space-y-1.5">
                  {recPaged.map(r => {
                    const isExp = expandedReturnRec === r.id
                    return (<Card key={r.id} className="shadow-sm border-violet-100 dark:border-violet-500/20"><CardContent className="p-2.5">
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedReturnRec(isExp ? null : r.id)}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <ChevronRight className={`w-3.5 h-3.5 text-violet-500 transition-transform ${isExp ? 'rotate-90' : ''}`} />
                          <span className="text-xs font-mono font-semibold">{r.recorderCode}</span>
                          <Badge className={`${r.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : r.status === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'} border-0 text-[9px] h-4`}>{r.status}</Badge>
                          {r.personName && <span className="text-xs font-medium">{r.personName}</span>}
                          <span className="text-[10px] text-muted-foreground">{r.itemCount} item(s) · {r.totalQty} qty</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      {isExp && (<div className="mt-2 space-y-2 border-t pt-2">
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          {r.personPhone && <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{r.personPhone}</span>}
                          {r.personEmail && <span className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{r.personEmail}</span>}
                          {r.personAddress && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{r.personAddress}</span>}
                          {r.notes && <span className="flex items-center gap-0.5"><FileText className="w-2.5 h-2.5" />{r.notes}</span>}
                        </div>
                        {r.returns && r.returns.length > 0 ? (
                          <div className="rounded-md border overflow-hidden">
                            <Table>
                              <TableHeader><TableRow>
                                <TableHead className="h-6 text-[10px]">Product</TableHead>
                                <TableHead className="h-6 text-[10px] text-right w-16">Qty</TableHead>
                                <TableHead className="h-6 text-[10px] w-14">Unit</TableHead>
                                <TableHead className="h-6 text-[10px]">From Item</TableHead>
                                <TableHead className="h-6 text-[10px] w-28">Returned At</TableHead>
                              </TableRow></TableHeader>
                              <TableBody>
                                {r.returns.map(rt => (
                                  <TableRow key={rt.id}>
                                    <TableCell className="py-1 text-[11px] font-medium">{rt.stockOutItem?.product?.name || `#${rt.stockOutItemId}`}</TableCell>
                                    <TableCell className="py-1 text-[11px] text-right font-mono text-emerald-600">+{rt.quantity}</TableCell>
                                    <TableCell className="py-1 text-[11px] text-muted-foreground">{rt.unit}</TableCell>
                                    <TableCell className="py-1 text-[11px] font-mono text-muted-foreground">#{rt.stockOutItemId}</TableCell>
                                    <TableCell className="py-1 text-[10px] text-muted-foreground">{new Date(rt.returnedAt).toLocaleString()}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : <div className="text-xs text-muted-foreground">No items in this record.</div>}
                      </div>)}
                    </CardContent></Card>)
                  })}
                </div>
                <Pager page={recSafePage} totalPages={recTotalPages} onPageChange={setReturnRecordsPage} />
              </>)
            })()}
          </div>
          )}

          {/* ── Non-Returnable tab (4th tab) — mirrors the Flagged tab + Return Records section,
              but with rose/red accents and "Mark Non-Returnable" actions instead of "Return".
              Also adds a "Reason" filter and shows nonReturnableQty per item. ── */}
          {returnsTab === 'non_returnable' && (
          <div className="mt-3 space-y-3">
            {/* Advanced Filters (rose theme) */}
            <FilterPanel
              activeCount={(nonRetSearch ? 1 : 0) + (nonRetWarehouseFilter !== '' ? 1 : 0) + (nonRetFilterDateFrom ? 1 : 0) + (nonRetFilterDateTo ? 1 : 0) + (nonRetFilterRecorder ? 1 : 0) + (nonRetFilterProgress ? 1 : 0) + (nonRetFilterCategory !== '' ? 1 : 0) + (nonRetFilterPerson.trim() ? 1 : 0) + (nonRetFilterReason ? 1 : 0) + (nonRetFilterCondition !== '' ? 1 : 0) + (nonRetAttSearch ? 1 : 0)}
              onClear={() => { setNonRetSearch(''); setNonRetWarehouseFilter(''); setNonRetFilterDateFrom(''); setNonRetFilterDateTo(''); setNonRetFilterRecorder(''); setNonRetFilterProgress(''); setNonRetFilterCategory(''); setNonRetFilterPerson(''); setNonRetFilterReason(''); setNonRetFilterCondition(''); setNonRetAttSearch(''); setNonRetPage(1) }}
              resultLabel={`${nonRetData.length} item(s)`}
            >
              <FilterField label="Search" width="w-56">
                <div className="relative"><Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Product, SKU, person, code..." value={nonRetSearch} onChange={e => { setNonRetSearch(e.target.value); setNonRetPage(1) }} className="h-8 text-xs pl-7" /></div>
              </FilterField>
              <FilterField label="Warehouse" width="w-44">
                <Popover open={nonRetWhComboOpen} onOpenChange={o => { setNonRetWhComboOpen(o); if (!o) setNonRetWhComboSearch('') }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="h-8 text-xs justify-between w-full font-normal px-2">
                      <span className="truncate">{nonRetWarehouseFilter === '' ? 'All Warehouses' : (warehouses.find(w => w.id === nonRetWarehouseFilter)?.name || `#${nonRetWarehouseFilter}`)}</span>
                      <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-0" align="start">
                    <div className="p-1.5 border-b sticky top-0 bg-popover">
                      <div className="relative"><Search className="w-3 h-3 text-muted-foreground absolute left-1.5 top-1/2 -translate-y-1/2" /><Input placeholder="Search warehouse..." value={nonRetWhComboSearch} onChange={e => setNonRetWhComboSearch(e.target.value)} className="h-7 text-xs pl-6" /></div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <button onClick={() => { setNonRetWarehouseFilter(''); setNonRetPage(1); setNonRetWhComboOpen(false) }} className={`w-full text-left px-2 py-1.5 text-xs hover:bg-rose-50 dark:hover:bg-rose-500/10 ${nonRetWarehouseFilter === '' ? 'bg-rose-50 dark:bg-rose-500/10 font-medium text-rose-700 dark:text-rose-400' : ''}`}>All Warehouses</button>
                      {warehouses.filter(w => { const s = nonRetWhComboSearch.toLowerCase(); return !s || w.name.toLowerCase().includes(s) || (w.code || '').toLowerCase().includes(s) }).map(w => (
                        <button key={w.id} onClick={() => { setNonRetWarehouseFilter(w.id); setNonRetPage(1); setNonRetWhComboOpen(false) }} className={`w-full text-left px-2 py-1.5 text-xs hover:bg-rose-50 dark:hover:bg-rose-500/10 ${nonRetWarehouseFilter === w.id ? 'bg-rose-50 dark:bg-rose-500/10 font-medium text-rose-700 dark:text-rose-400' : ''}`}>{w.name} <span className="text-[9px] text-muted-foreground font-mono">{w.code}</span></button>
                      ))}
                      {warehouses.filter(w => { const s = nonRetWhComboSearch.toLowerCase(); return !s || w.name.toLowerCase().includes(s) || (w.code || '').toLowerCase().includes(s) }).length === 0 && <div className="px-2 py-2 text-[11px] text-muted-foreground text-center">No warehouse matches.</div>}
                    </div>
                  </PopoverContent>
                </Popover>
              </FilterField>
              <FilterField label="Category" width="w-44">
                <PaginatedCombobox
                  items={categories.filter(c => role === 'super_admin' || c.enterpriseId === eid).map(c => ({ value: String(c.id), label: c.name }))}
                  value={nonRetFilterCategory === '' ? '_all' : String(nonRetFilterCategory)}
                  onChange={v => { setNonRetFilterCategory(v === '_all' ? '' : parseInt(v)); setNonRetPage(1) }}
                  allLabel="All Categories"
                  placeholder="All"
                />
              </FilterField>
              <FilterField label="Condition" width="w-44">
                <PaginatedCombobox
                  items={conditions.filter(c => role === 'super_admin' || c.enterpriseId === eid).map(c => ({ value: String(c.id), label: c.name }))}
                  value={nonRetFilterCondition === '' ? '_all' : String(nonRetFilterCondition)}
                  onChange={v => { setNonRetFilterCondition(v === '_all' ? '' : parseInt(v)); setNonRetPage(1) }}
                  allLabel="All Conditions"
                  placeholder="All"
                />
              </FilterField>
              <FilterField label="Person / Supplier" width="w-44">
                <Input value={nonRetFilterPerson} onChange={e => { setNonRetFilterPerson(e.target.value); setNonRetPage(1) }} placeholder="Name contains..." className="h-8 text-xs" />
              </FilterField>
              <FilterField label="Out Date From" width="w-32"><CustomDatePicker compact value={nonRetFilterDateFrom} onChange={v => { setNonRetFilterDateFrom(v); setNonRetPage(1) }} /></FilterField>
              <FilterField label="Out Date To" width="w-32"><CustomDatePicker compact value={nonRetFilterDateTo} onChange={v => { setNonRetFilterDateTo(v); setNonRetPage(1) }} /></FilterField>
              <FilterField label="Recorder Code" width="w-40"><Input value={nonRetFilterRecorder} onChange={e => { setNonRetFilterRecorder(e.target.value); setNonRetPage(1) }} placeholder="SOUT-..." className="h-8 text-xs" /></FilterField>
              <FilterField label="Progress" width="w-40">
                <Select value={nonRetFilterProgress || '_all'} onValueChange={v => { setNonRetFilterProgress(v === '_all' ? '' : v as 'none' | 'partial' | 'full'); setNonRetPage(1) }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent><SelectItem value="_all">All</SelectItem><SelectItem value="none">Not started</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="full">Fully resolved</SelectItem></SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Reason" width="w-48">
                <PaginatedCombobox
                  items={NON_RETURNABLE_REASONS.map(r => ({ value: r.key, label: r.label }))}
                  value={nonRetFilterReason || '_all'}
                  onChange={v => { setNonRetFilterReason(v === '_all' ? '' : v); setNonRetPage(1) }}
                  allLabel="All Reasons"
                  placeholder="All"
                  perPage={12}
                />
              </FilterField>
              <FilterField label="Attachment Content" width="w-48"><div className="relative"><Paperclip className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" /><Input placeholder="Title, file name, meta key/value..." value={nonRetAttSearch} onChange={e => { setNonRetAttSearch(e.target.value); setNonRetPage(1) }} className="h-8 text-xs pl-7" /></div></FilterField>
            </FilterPanel>

            {nonRetLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-rose-500" /><span className="ml-2 text-sm text-muted-foreground">Loading non-returnable items...</span></div>
            ) : (() => {
              // Apply search + advanced filters (mirrors the Returns filter chain, + reason filter)
              const q = nonRetSearch.toLowerCase()
              const recQ = nonRetFilterRecorder.toLowerCase()
              const personQ = nonRetFilterPerson.toLowerCase().trim()
              const filtered = nonRetData.filter(it => {
                if (nonRetWarehouseFilter !== '' && it.warehouseId !== nonRetWarehouseFilter) return false
                if (nonRetFilterCategory !== '' && it.product?.categoryId !== nonRetFilterCategory) return false
                if (nonRetFilterCondition !== '' && it.conditionId !== nonRetFilterCondition) return false
                if (personQ && !(it.recorder?.personName || '').toLowerCase().includes(personQ)) return false
                if (nonRetFilterDateFrom && new Date(it.createdAt) < new Date(nonRetFilterDateFrom + 'T00:00:00')) return false
                if (nonRetFilterDateTo && new Date(it.createdAt) > new Date(nonRetFilterDateTo + 'T23:59:59')) return false
                if (recQ && !(it.recorder?.recorderCode || '').toLowerCase().includes(recQ)) return false
                if (nonRetFilterProgress) {
                  if (nonRetFilterProgress === 'none' && (it.returnedQty > 0 || it.nonReturnableQty > 0)) return false
                  if (nonRetFilterProgress === 'partial' && !((it.returnedQty > 0 || it.nonReturnableQty > 0) && it.remainingQty > 0)) return false
                  if (nonRetFilterProgress === 'full' && it.remainingQty > 0) return false
                }
                // Reason filter: match if any of the item's nonReturnables has this reason
                if (nonRetFilterReason && !(it.nonReturnables || []).some(n => n.reason === nonRetFilterReason)) return false
                if (nonRetAttSearch) {
                  const aq = nonRetAttSearch.toLowerCase()
                  const returnIds = (it.returns || []).map(r => r.id)
                  const nonRetIds = (it.nonReturnables || []).map(n => n.id)
                  const matches = attachmentsData.some(a => {
                    const linked = (a.entityType === 'stock_out_item' && a.entityId === it.id)
                      || (a.entityType === 'return' && returnIds.includes(a.entityId as number))
                      || (a.entityType === 'non_returnable' && nonRetIds.includes(a.entityId as number))
                    if (!linked) return false
                    if (a.title?.toLowerCase().includes(aq)) return true
                    if (a.fileName?.toLowerCase().includes(aq)) return true
                    if (a.description?.toLowerCase().includes(aq)) return true
                    if (a.mimeType?.toLowerCase().includes(aq)) return true
                    if ((a.metaFields || []).some(m => m.key.toLowerCase().includes(aq) || m.value.toLowerCase().includes(aq) || m.description.toLowerCase().includes(aq))) return true
                    return false
                  })
                  if (!matches) return false
                }
                if (!q) return true
                return (it.product?.name || '').toLowerCase().includes(q)
                  || (it.product?.sku || '').toLowerCase().includes(q)
                  || (it.recorder?.personName || '').toLowerCase().includes(q)
                  || (it.recorder?.recorderCode || '').toLowerCase().includes(q)
              })
              const totalPages = Math.ceil(filtered.length / NON_RET_PER_PAGE) || 1
              const safePage = Math.min(nonRetPage, totalPages)
              const paged = filtered.slice((safePage - 1) * NON_RET_PER_PAGE, safePage * NON_RET_PER_PAGE)

              // Group by personName for the "Group Non-Returnable by Person" feature
              const groups: Record<string, ReturnableItem[]> = {}
              for (const it of filtered) {
                const key = it.recorder?.personName?.trim() || '(no person)'
                if (!groups[key]) groups[key] = []
                groups[key].push(it)
              }
              const groupEntries = Object.entries(groups).filter(([, items]) => items.length > 0).sort((a, b) => a[0].localeCompare(b[0]))

              if (filtered.length === 0) return <div className="text-center text-sm text-muted-foreground py-10">No flagged items to mark as non-returnable. Items that "should be returned" (isReturnable=true) appear here.</div>

              return (<>
                {/* Group non-returnable bar — paginated person buttons (rose theme) */}
                {groupEntries.length > 0 && (() => {
                  const grpTotalPages = Math.ceil(groupEntries.length / NON_RET_GROUP_PER_PAGE) || 1
                  const grpSafePage = Math.min(nonRetGroupPage, grpTotalPages)
                  const grpPaged = groupEntries.slice((grpSafePage - 1) * NON_RET_GROUP_PER_PAGE, grpSafePage * NON_RET_GROUP_PER_PAGE)
                  return (
                  <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-md p-2">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5"><Users className="w-3 h-3 text-rose-600" /><span className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Group Non-Returnable by Person</span><Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border-0 text-[9px] h-4">{groupEntries.length}</Badge></div>
                      <span className="text-[10px] text-muted-foreground">{grpSafePage}/{grpTotalPages}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {grpPaged.map(([person, items]) => (
                        <button key={person} onClick={() => openGroupNonRetDlg(person, items)} className="text-[11px] px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition flex items-center gap-1">
                          <Users className="w-3 h-3 text-rose-500" />
                          <span className="font-medium">{person}</span>
                          <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border-0 text-[9px] h-4">{items.length}</Badge>
                        </button>
                      ))}
                    </div>
                    {grpTotalPages > 1 && (
                      <div className="flex items-center justify-end gap-1 mt-1.5 pt-1.5 border-t border-rose-200 dark:border-rose-500/20">
                        <Button size="sm" variant="outline" disabled={grpSafePage <= 1} onClick={() => setNonRetGroupPage(grpSafePage - 1)} className="h-6 w-6 p-0"><ChevronLeft className="w-3 h-3" /></Button>
                        <Button size="sm" variant="outline" disabled={grpSafePage >= grpTotalPages} onClick={() => setNonRetGroupPage(grpSafePage + 1)} className="h-6 w-6 p-0"><ChevronRight className="w-3 h-3" /></Button>
                      </div>
                    )}
                  </div>
                  )
                })()}

                {/* Mobile: stacked cards */}
                <div className="sm:hidden space-y-2">
                  {paged.map(it => {
                    const wh = warehouses.find(w => w.id === it.warehouseId); const cond = conditions.find(c => c.id === it.conditionId)
                    return (<Card key={it.id} className="shadow-sm"><CardContent className="p-2.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><div className="text-[11px] font-medium truncate flex items-center gap-1">{it.product?.name || `#${it.productId}`}{cond && <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border-0 text-[9px] h-4 shrink-0">{cond.name}</Badge>}</div>
                          <div className="text-[9px] text-muted-foreground font-mono">{it.product?.sku}</div></div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button size="sm" variant="ghost" onClick={() => openReturnSourceDlg(it)} className="h-5 w-5 p-0 text-muted-foreground" title="View source record"><Eye className="w-3 h-3" /></Button>
                          <Button size="sm" onClick={() => openNonRetDlg(it)} className="h-5 text-[10px] bg-rose-600 text-white px-1.5" title="Mark as non-returnable"><Ban className="w-2.5 h-2.5 mr-0.5" />Non-Ret</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                        <div><span className="text-muted-foreground">Out: </span><span className="font-mono font-medium">{it.quantity}</span> <span className="text-muted-foreground">{it.unit}</span></div>
                        <div><span className="text-muted-foreground">Returned: </span><span className="font-mono font-medium text-emerald-600">{it.returnedQty}</span></div>
                        <div><span className="text-muted-foreground">Non-Ret: </span><span className="font-mono font-medium text-rose-600">{it.nonReturnableQty || 0}</span></div>
                        <div><span className="text-muted-foreground">Remaining: </span><span className="font-mono font-medium text-violet-600">{it.remainingQty}</span></div>
                        <div><span className="text-muted-foreground">Warehouse: </span><span className="font-medium truncate">{wh?.name || `#${it.warehouseId}`}</span></div>
                        <div className="col-span-2"><span className="text-muted-foreground">Person: </span><span className="font-medium">{it.recorder?.personName || '—'}</span></div>
                        <div className="col-span-2"><span className="text-muted-foreground">Recorder: </span><span className="font-mono text-[10px]">{it.recorder?.recorderCode}</span> <span className="text-muted-foreground">· {new Date(it.createdAt).toLocaleDateString()}</span></div>
                      </div>
                      {/* Non-Returnable reasons already applied (small badges) */}
                      {it.nonReturnables && it.nonReturnables.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 border-t">
                          {it.nonReturnables.slice(0, 4).map(n => (<Badge key={n.id} className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border-0 text-[9px] h-4">{REASON_LABELS[n.reason] || n.reason} ×{n.quantity}</Badge>))}
                          {it.nonReturnables.length > 4 && <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border-0 text-[9px] h-4">+{it.nonReturnables.length - 4} more</Badge>}
                        </div>
                      )}
                    </CardContent></Card>
                  )
                  })}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block rounded-md border overflow-hidden"><Table>
                  <TableHeader><TableRow>
                    <TableHead className="h-7 text-[10px]">Product</TableHead>
                    <TableHead className="h-7 text-[10px]">Person</TableHead>
                    <TableHead className="h-7 text-[10px]">Recorder</TableHead>
                    <TableHead className="h-7 text-[10px] text-right w-14">Out</TableHead>
                    <TableHead className="h-7 text-[10px] text-right w-16">Returned</TableHead>
                    <TableHead className="h-7 text-[10px] text-right w-16">Non-Ret</TableHead>
                    <TableHead className="h-7 text-[10px] text-right w-16">Remaining</TableHead>
                    <TableHead className="h-7 text-[10px] w-20">Condition</TableHead>
                    <TableHead className="h-7 text-[10px] w-28">Reasons</TableHead>
                    <TableHead className="h-7 w-24 text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {paged.map(it => {
                      const wh = warehouses.find(w => w.id === it.warehouseId); const cond = conditions.find(c => c.id === it.conditionId)
                      return (<TableRow key={it.id}>
                        <TableCell className="py-1 text-[11px]"><div className="font-medium truncate">{it.product?.name || `#${it.productId}`}</div><div className="text-[9px] text-muted-foreground font-mono">{it.product?.sku}</div><div className="text-[9px] text-muted-foreground">{wh?.name || `#${it.warehouseId}`}</div></TableCell>
                        <TableCell className="py-1 text-[11px]">{it.recorder?.personName || '—'}</TableCell>
                        <TableCell className="py-1 text-[11px]"><span className="font-mono">{it.recorder?.recorderCode}</span><div className="text-[9px] text-muted-foreground">{new Date(it.createdAt).toLocaleDateString()}</div></TableCell>
                        <TableCell className="py-1 text-[11px] text-right font-mono">{it.quantity} <span className="text-muted-foreground">{it.unit}</span></TableCell>
                        <TableCell className="py-1 text-[11px] text-right font-mono text-emerald-600">{it.returnedQty}</TableCell>
                        <TableCell className="py-1 text-[11px] text-right font-mono text-rose-600 font-semibold">{it.nonReturnableQty || 0}</TableCell>
                        <TableCell className="py-1 text-[11px] text-right font-mono text-violet-600 font-semibold">{it.remainingQty}</TableCell>
                        <TableCell className="py-1">{cond ? <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border-0 text-[9px] h-4">{cond.name}</Badge> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="py-1">
                          {it.nonReturnables && it.nonReturnables.length > 0 ? (
                            <div className="flex flex-wrap gap-0.5">{it.nonReturnables.slice(0, 2).map(n => (<Badge key={n.id} className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border-0 text-[8px] h-3.5 px-1">{REASON_LABELS[n.reason] || n.reason}×{n.quantity}</Badge>))}{it.nonReturnables.length > 2 && <span className="text-[9px] text-muted-foreground">+{it.nonReturnables.length - 2}</span>}</div>
                          ) : <span className="text-[9px] text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="py-1 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button size="sm" variant="ghost" onClick={() => openReturnSourceDlg(it)} className="h-5 w-5 p-0 text-muted-foreground" title="View source record"><Eye className="w-3 h-3" /></Button>
                            <Button size="sm" onClick={() => openNonRetDlg(it)} className="h-5 text-[10px] bg-rose-600 text-white px-1.5" title="Mark as non-returnable (with reason)"><Ban className="w-2.5 h-2.5 mr-0.5" />Non-Ret</Button>
                          </div>
                        </TableCell>
                      </TableRow>)
                    })}
                  </TableBody>
                </Table></div>
                <Pager page={safePage} totalPages={totalPages} onPageChange={setNonRetPage} />
              </>)
            })()}
          </div>
          )}

          {/* ── Non-Returnable Records section (inside the Non-Returnable tab, below the items) ── */}
          {returnsTab === 'non_returnable' && (
          <div className="mt-4 space-y-3 border-t pt-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-xs font-semibold">Non-Returnable Records</span>
                <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border-0 text-[9px] h-4">{groupNonRetRecords.length}</Badge>
                <span className="text-[10px] text-muted-foreground hidden sm:inline">· group non-returnable decisions created via "New Group Non-Returnable" (each records the reason per item; does NOT restock inventory)</span>
              </div>
              {groupNonRetRecordsLoading && <Loader2 className="w-3 h-3 animate-spin text-rose-500" />}
            </div>
            {groupNonRetRecordsLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-rose-500" /><span className="ml-2 text-sm text-muted-foreground">Loading non-returnable records...</span></div>
            ) : groupNonRetRecords.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-10">No non-returnable records yet. Click <span className="font-semibold text-rose-600">New Group Non-Returnable</span> to create one, or mark individual items from the list above.</div>
            ) : (() => {
              const recTotalPages = Math.ceil(groupNonRetRecords.length / NON_RET_RECORDS_PER_PAGE) || 1
              const recSafePage = Math.min(nonRetRecordsPage, recTotalPages)
              const recPaged = groupNonRetRecords.slice((recSafePage - 1) * NON_RET_RECORDS_PER_PAGE, recSafePage * NON_RET_RECORDS_PER_PAGE)
              return (<>
                <div className="space-y-1.5">
                  {recPaged.map(r => {
                    const isExp = expandedNonRetRec === r.id
                    return (<Card key={r.id} className="shadow-sm border-rose-100 dark:border-rose-500/20"><CardContent className="p-2.5">
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedNonRetRec(isExp ? null : r.id)}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <ChevronRight className={`w-3.5 h-3.5 text-rose-500 transition-transform ${isExp ? 'rotate-90' : ''}`} />
                          <span className="text-xs font-mono font-semibold">{r.recorderCode}</span>
                          <Badge className={`${r.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : r.status === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'} border-0 text-[9px] h-4`}>{r.status}</Badge>
                          {r.personName && <span className="text-xs font-medium">{r.personName}</span>}
                          <span className="text-[10px] text-muted-foreground">{r.itemCount} item(s) · {r.totalQty} qty</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      {isExp && (<div className="mt-2 space-y-2 border-t pt-2">
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          {r.personPhone && <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{r.personPhone}</span>}
                          {r.personEmail && <span className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{r.personEmail}</span>}
                          {r.personAddress && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{r.personAddress}</span>}
                          {r.notes && <span className="flex items-center gap-0.5"><FileText className="w-2.5 h-2.5" />{r.notes}</span>}
                        </div>
                        {r.nonReturnables && r.nonReturnables.length > 0 ? (
                          <div className="rounded-md border overflow-hidden">
                            <Table>
                              <TableHeader><TableRow>
                                <TableHead className="h-6 text-[10px]">Product</TableHead>
                                <TableHead className="h-6 text-[10px] text-right w-16">Qty</TableHead>
                                <TableHead className="h-6 text-[10px] w-32">Reason</TableHead>
                                <TableHead className="h-6 text-[10px]">Detail / Notes</TableHead>
                                <TableHead className="h-6 text-[10px] w-28">Decided At</TableHead>
                              </TableRow></TableHeader>
                              <TableBody>
                                {r.nonReturnables.map(nr => (
                                  <TableRow key={nr.id}>
                                    <TableCell className="py-1 text-[11px] font-medium">{nr.stockOutItem?.product?.name || `#${nr.stockOutItemId}`}</TableCell>
                                    <TableCell className="py-1 text-[11px] text-right font-mono text-rose-600">×{nr.quantity}</TableCell>
                                    <TableCell className="py-1 text-[11px]"><Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border-0 text-[9px] h-4">{REASON_LABELS[nr.reason] || nr.reason}</Badge></TableCell>
                                    <TableCell className="py-1 text-[11px] text-muted-foreground">{nr.reasonDetail || nr.notes || '—'}</TableCell>
                                    <TableCell className="py-1 text-[10px] text-muted-foreground">{new Date(nr.decidedAt).toLocaleString()}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : <div className="text-xs text-muted-foreground">No items in this record.</div>}
                      </div>)}
                    </CardContent></Card>)
                  })}
                </div>
                <Pager page={recSafePage} totalPages={recTotalPages} onPageChange={setNonRetRecordsPage} />
              </>)
            })()}
          </div>
          )}
        </Tabs>
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

          <nav className="flex-1 overflow-y-auto p-3 space-y-3">
            {(() => {
              // Sidebar grouping:
              // - Top (no header): dashboard
              // - "Organization" group: enterprises, branches, warehouses, users
              // - "Inventory" group: products, stock, stockIn, stockOut, returns
              // - Bottom "More" group: categories, orders, suppliers, audit, features
              const ORG_KEYS = new Set(['enterprises', 'branches', 'warehouses', 'users'])
              const INV_KEYS = new Set(['products', 'stock', 'stockIn', 'stockOut', 'returns'])
              const MORE_KEYS = new Set(['categories', 'conditions', 'orders', 'suppliers', 'audit', 'features', 'attachments'])
              const present = new Set(navItems.map(n => n.key))
              const top = navItems.filter(n => n.key === 'dashboard')
              const org = navItems.filter(n => ORG_KEYS.has(n.key))
              const inv = navItems.filter(n => INV_KEYS.has(n.key))
              const more = navItems.filter(n => MORE_KEYS.has(n.key))
              const renderBtn = (item: typeof navItems[number]) => { const Icon = ICONS[item.icon] || Box; const active = page === item.key
                return (<button key={item.key} onClick={() => { setPage(item.key); setSidebarOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${active ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}>
                  <Icon className="w-4 h-4" /><span>{item.label}</span></button>) }
              const renderGroup = (label: string, items: typeof navItems) => items.length === 0 ? null : (
                <div className="space-y-0.5">
                  <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{label}</div>
                  {items.map(renderBtn)}
                </div>
              )
              // any items not in known groups → render at the end (defensive)
              const knownKeys = new Set([...ORG_KEYS, ...INV_KEYS, ...MORE_KEYS, 'dashboard'])
              const others = navItems.filter(n => !knownKeys.has(n.key))
              return (<>
                {top.length > 0 && <div className="space-y-0.5">{top.map(renderBtn)}</div>}
                {renderGroup('Organization', org)}
                {renderGroup('Inventory', inv)}
                {others.length > 0 && <div className="space-y-0.5">{others.map(renderBtn)}</div>}
                {renderGroup('More', more)}
              </>)
              // 'present' kept for future per-item visibility checks; reference to avoid unused warning
              void present
            })()}
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
        <main className="flex-1 min-w-0 flex flex-col">
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
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">{renderPage()}</div>
          <footer className="mt-auto border-t bg-card px-4 py-3 text-center text-xs text-muted-foreground">Enterprise IMS • Multi-Tenant Inventory Management</footer>
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
                  <div className="space-y-1"><IconLabel icon={Building2}>Enterprise</IconLabel><PaginatedCombobox items={enterprises.map(e=>({value:String(e.id),label:e.name}))} value={dlgData.enterpriseId ? String(dlgData.enterpriseId) : ''} onChange={v=>setDlgData({...dlgData,enterpriseId:parseInt(v)})} placeholder="Select..." perPage={10} /></div>
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
                  <div className="space-y-1"><IconLabel icon={Building2}>Enterprise</IconLabel><PaginatedCombobox items={enterprises.map(e=>({value:String(e.id),label:e.name}))} value={dlgData.enterpriseId ? String(dlgData.enterpriseId) : ''} onChange={v=>setDlgData({...dlgData,enterpriseId:parseInt(v)})} placeholder="Select..." perPage={10} /></div>
                </div>}
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={GitBranch}>Branch</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={GitBranch}>Branch</IconLabel><PaginatedCombobox items={branches.filter(b=>!dlgData.enterpriseId||b.enterpriseId===dlgData.enterpriseId).map(b=>({value:String(b.id),label:b.name}))} value={dlgData.branchId ? String(dlgData.branchId) : ''} onChange={v=>setDlgData({...dlgData,branchId:parseInt(v)})} placeholder="Select..." perPage={10} /></div>
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
                  <div className="space-y-1"><IconLabel icon={Building2}>Enterprise</IconLabel><PaginatedCombobox items={enterprises.map(e=>({value:String(e.id),label:e.name}))} value={dlgData.enterpriseId ? String(dlgData.enterpriseId) : ''} onChange={v=>setDlgData({...dlgData,enterpriseId:parseInt(v)})} placeholder="Select..." perPage={10} /></div>
                </div>}
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={GitBranch}>Assignment</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={GitBranch}>Branch</IconLabel><PaginatedCombobox items={branches.filter(b=>!dlgData.enterpriseId||b.enterpriseId===dlgData.enterpriseId).map(b=>({value:String(b.id),label:b.name}))} value={dlgData.branchId ? String(dlgData.branchId) : '0'} onChange={v=>setDlgData({...dlgData,branchId:parseInt(v)})} allLabel="None" allValue="0" placeholder="None" perPage={10} /></div>
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
                  <div className="space-y-1"><IconLabel icon={Tag}>Category</IconLabel><PaginatedCombobox items={categories.filter(c=>c.enterpriseId===eid||role==='super_admin').map(c=>({value:String(c.id),label:c.name}))} value={dlgData.categoryId ? String(dlgData.categoryId) : ''} onChange={v=>setDlgData({...dlgData,categoryId:parseInt(v)})} placeholder="Select category..." /></div>
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
                  <div className="space-y-1"><IconLabel icon={WHIcon}>Warehouse</IconLabel><PaginatedCombobox items={warehouses.filter(w=>w.isActive).map(w=>({value:String(w.id),label:w.name,sublabel:w.code}))} value={dlgData.warehouseId ? String(dlgData.warehouseId) : ''} onChange={v=>setDlgData({...dlgData,warehouseId:parseInt(v)})} placeholder="Select warehouse..." /></div>
                  <div className="space-y-1"><IconLabel icon={ArrowUpFromLine}>Initial Quantity</IconLabel><Input type="number" min="0" value={dlgData.quantity||''} onChange={e=>setDlgData({...dlgData,quantity:parseInt(e.target.value)||0})} placeholder="Enter quantity..." className="h-8 text-sm rounded-md" /></div>
                  <div className="space-y-1"><IconLabel icon={ClipboardCheck}>Condition</IconLabel><PaginatedCombobox items={conditions.filter(c=>c.enterpriseId===eid||role==='super_admin').map(c=>({value:String(c.id),label:c.name}))} value={dlgData.conditionId ? String(dlgData.conditionId) : ''} onChange={v=>setDlgData({...dlgData,conditionId:parseInt(v)})} placeholder="Condition —" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <AttachmentPicker
                    files={dlgData.pendingFiles || []}
                    onFilesChange={f => setDlgData({ ...dlgData, pendingFiles: f })}
                    metaFields={dlgData.pendingMetaFields || []}
                    onMetaChange={m => setDlgData({ ...dlgData, pendingMetaFields: m })}
                    title={dlgData.pendingAttTitle || ''}
                    onTitleChange={s => setDlgData({ ...dlgData, pendingAttTitle: s })}
                    description={dlgData.pendingAttDesc || ''}
                    onDescChange={s => setDlgData({ ...dlgData, pendingAttDesc: s })}
                    accent="emerald"
                    hint="Attach product photos, spec sheets, or manuals. Linked to THIS product (entityType=product)."
                  />
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
                    : <PaginatedCombobox items={products.filter(p=>p.isActive).sort((a,b)=>a.name.localeCompare(b.name)).map(p=>({value:String(p.id),label:p.name,sublabel:p.sku}))} value={dlgData.productId ? String(dlgData.productId) : ''} onChange={v=>setDlgData({...dlgData,productId:parseInt(v)})} placeholder="Select product..." perPage={10} />}
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={WHIcon}>Warehouse</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={WHIcon}>Warehouse</IconLabel><PaginatedCombobox items={warehouses.filter(w=>w.isActive).map(w=>({value:String(w.id),label:w.name,sublabel:w.code}))} value={dlgData.warehouseId ? String(dlgData.warehouseId) : ''} onChange={v=>setDlgData({...dlgData,warehouseId:parseInt(v)})} placeholder="Select warehouse..." /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={ArrowUpFromLine}>Quantity In</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={ArrowUpFromLine}>Quantity</IconLabel><Input type="number" min="1" value={dlgData.quantity||''} onChange={e=>setDlgData({...dlgData,quantity:parseInt(e.target.value)||0})} placeholder="Enter quantity..." className="h-8 text-sm rounded-md" /></div>
                  {dlgData.productId && <div className="text-[11px] text-muted-foreground mt-1">Current stock: {stockData.filter(s=>s.productId===dlgData.productId).reduce((sum,s)=>sum+s.quantity,0)} {products.find(p=>p.id===dlgData.productId)?.unit || 'pcs'} across all warehouses</div>}
                  <div className="space-y-1"><IconLabel icon={ClipboardCheck}>Condition</IconLabel><PaginatedCombobox items={conditions.filter(c=>c.enterpriseId===eid||role==='super_admin').map(c=>({value:String(c.id),label:c.name}))} value={dlgData.conditionId ? String(dlgData.conditionId) : ''} onChange={v=>setDlgData({...dlgData,conditionId:parseInt(v)})} placeholder="Condition —" /></div>
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
                  <div className="space-y-1"><IconLabel icon={WHIcon}>Warehouse</IconLabel><PaginatedCombobox items={warehouses.map(w=>({value:String(w.id),label:w.name,sublabel:w.code}))} value={dlgData.warehouseId ? String(dlgData.warehouseId) : ''} onChange={v=>setDlgData({...dlgData,warehouseId:parseInt(v)})} placeholder="Select..." /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={FileText}>Notes</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={FileText}>Notes</IconLabel><Textarea value={dlgData.notes||''} onChange={e=>setDlgData({...dlgData,notes:e.target.value})} className="rounded-md" /></div>
                </div>
                <AttachmentPicker
                    files={dlgData.pendingFiles || []}
                    onFilesChange={f => setDlgData({ ...dlgData, pendingFiles: f })}
                    metaFields={dlgData.pendingMetaFields || []}
                    onMetaChange={m => setDlgData({ ...dlgData, pendingMetaFields: m })}
                    title={dlgData.pendingAttTitle || ''}
                    onTitleChange={s => setDlgData({ ...dlgData, pendingAttTitle: s })}
                    description={dlgData.pendingAttDesc || ''}
                    onDescChange={s => setDlgData({ ...dlgData, pendingAttDesc: s })}
                    accent="blue"
                    hint="Attach purchase agreements, sales contracts, or delivery specs. Linked to THIS order (entityType=order)."
                  />
              </>}

              {/* ─── StockOut ─── */}
              {dlgType === 'stockOut' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={WHIcon}>Warehouse</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={WHIcon}>Warehouse</IconLabel><PaginatedCombobox items={warehouses.map(w=>({value:String(w.id),label:w.name,sublabel:w.code}))} value={dlgData.warehouseId ? String(dlgData.warehouseId) : ''} onChange={v=>setDlgData({...dlgData,warehouseId:parseInt(v)})} placeholder="Select..." /></div>
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
                <AttachmentPicker
                    files={dlgData.pendingFiles || []}
                    onFilesChange={f => setDlgData({ ...dlgData, pendingFiles: f })}
                    metaFields={dlgData.pendingMetaFields || []}
                    onMetaChange={m => setDlgData({ ...dlgData, pendingMetaFields: m })}
                    title={dlgData.pendingAttTitle || ''}
                    onTitleChange={s => setDlgData({ ...dlgData, pendingAttTitle: s })}
                    description={dlgData.pendingAttDesc || ''}
                    onDescChange={s => setDlgData({ ...dlgData, pendingAttDesc: s })}
                    accent="blue"
                    hint="Attach delivery notes, photos, or documents. Linked to THIS dispatch recorder (entityType=stock_out)."
                  />
              </>}

              {/* ─── StockOutItem ─── */}
              {dlgType === 'stockOutItem' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Package}>Product</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Package}>Product</IconLabel><PaginatedCombobox items={products.map(p=>({value:String(p.id),label:p.name}))} value={dlgData.productId ? String(dlgData.productId) : ''} onChange={v=>setDlgData({...dlgData,productId:parseInt(v)})} placeholder="Select..." perPage={10} /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Hash}>Quantity</SectionHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><IconLabel icon={Hash}>Quantity</IconLabel><Input type="number" value={dlgData.quantity||''} onChange={e=>setDlgData({...dlgData,quantity:parseInt(e.target.value)||0})} className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={Box}>Unit</IconLabel><Select value={dlgData.unit||'pcs'} onValueChange={v=>setDlgData({...dlgData,unit:v})}><SelectTrigger className="h-8 text-sm rounded-md"><SelectValue /></SelectTrigger><SelectContent className="max-h-60">{SORTED_MEASUREMENTS.map(m=><SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div className="space-y-1"><IconLabel icon={ClipboardCheck}>Condition</IconLabel><PaginatedCombobox items={conditions.filter(c=>c.enterpriseId===eid||role==='super_admin').map(c=>({value:String(c.id),label:c.name}))} value={dlgData.conditionId ? String(dlgData.conditionId) : ''} onChange={v=>setDlgData({...dlgData,conditionId:parseInt(v)})} placeholder="Condition —" /></div>
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
                <AttachmentPicker
                    files={dlgData.pendingFiles || []}
                    onFilesChange={f => setDlgData({ ...dlgData, pendingFiles: f })}
                    metaFields={dlgData.pendingMetaFields || []}
                    onMetaChange={m => setDlgData({ ...dlgData, pendingMetaFields: m })}
                    title={dlgData.pendingAttTitle || ''}
                    onTitleChange={s => setDlgData({ ...dlgData, pendingAttTitle: s })}
                    description={dlgData.pendingAttDesc || ''}
                    onDescChange={s => setDlgData({ ...dlgData, pendingAttDesc: s })}
                    accent="blue"
                    hint="Attach photos, serial numbers, or documents to THIS item (entityType=stock_out_item). Linked to the specific line item, not the whole dispatch."
                  />
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
                {role==='super_admin' && <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Building2}>Organization</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Building2}>Enterprise</IconLabel><PaginatedCombobox items={enterprises.map(e=>({value:String(e.id),label:e.name}))} value={dlgData.enterpriseId ? String(dlgData.enterpriseId) : ''} onChange={v=>setDlgData({...dlgData,enterpriseId:parseInt(v)})} placeholder="Select enterprise..." perPage={10} /></div>
                </div>}
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Tag}>Details</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Tag}>Name</IconLabel><Input value={dlgData.name||''} onChange={e=>setDlgData({...dlgData,name:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={FileText}>Description</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={FileText}>Description</IconLabel><Input value={dlgData.description||''} onChange={e=>setDlgData({...dlgData,description:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
              </>}

              {/* ─── Condition (mirrors Category — managed list of inventory conditions) ─── */}
              {dlgType === 'condition' && <>
                {role==='super_admin' && <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Building2}>Organization</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Building2}>Enterprise</IconLabel><PaginatedCombobox items={enterprises.map(e=>({value:String(e.id),label:e.name}))} value={dlgData.enterpriseId ? String(dlgData.enterpriseId) : ''} onChange={v=>setDlgData({...dlgData,enterpriseId:parseInt(v)})} placeholder="Select enterprise..." perPage={10} /></div>
                </div>}
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={ClipboardCheck}>Details</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={ClipboardCheck}>Name</IconLabel><Input value={dlgData.name||''} onChange={e=>setDlgData({...dlgData,name:e.target.value})} placeholder="e.g. New, Used, Refurbished, Damaged" className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={FileText}>Description</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={FileText}>Description</IconLabel><Input value={dlgData.description||''} onChange={e=>setDlgData({...dlgData,description:e.target.value})} placeholder="Optional description..." className="h-8 text-sm rounded-md" /></div>
                </div>
              </>}

              {/* ─── Stock In Recorder (Task 1-b: mirrors Stock Out recorder) ─── */}
              {dlgType === 'stockInRecorder' && <>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={WHIcon}>Warehouse</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={WHIcon}>Warehouse</IconLabel><PaginatedCombobox items={warehouses.filter(w=>w.isActive).map(w=>({value:String(w.id),label:w.name,sublabel:w.code}))} value={dlgData.warehouseId ? String(dlgData.warehouseId) : ''} onChange={v=>setDlgData({...dlgData,warehouseId:parseInt(v)})} placeholder="Select warehouse..." /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Truck}>Supplier</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Users}>Supplier Name</IconLabel><Input value={dlgData.personName||''} onChange={e=>setDlgData({...dlgData,personName:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><IconLabel icon={Phone}>Phone</IconLabel><Input value={dlgData.personPhone||''} onChange={e=>setDlgData({...dlgData,personPhone:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                    <div className="space-y-1"><IconLabel icon={Mail}>Email</IconLabel><Input value={dlgData.personEmail||''} onChange={e=>setDlgData({...dlgData,personEmail:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                  </div>
                  <div className="space-y-1"><IconLabel icon={MapPin}>Address</IconLabel><Input value={dlgData.personAddress||''} onChange={e=>setDlgData({...dlgData,personAddress:e.target.value})} className="h-8 text-sm rounded-md" /></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={FileText}>Notes</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={FileText}>Notes</IconLabel><Textarea value={dlgData.notes||''} onChange={e=>setDlgData({...dlgData,notes:e.target.value})} className="h-8 text-sm rounded-md min-h-[60px]" /></div>
                </div>
                <AttachmentPicker
                    files={dlgData.pendingFiles || []}
                    onFilesChange={f => setDlgData({ ...dlgData, pendingFiles: f })}
                    metaFields={dlgData.pendingMetaFields || []}
                    onMetaChange={m => setDlgData({ ...dlgData, pendingMetaFields: m })}
                    title={dlgData.pendingAttTitle || ''}
                    onTitleChange={s => setDlgData({ ...dlgData, pendingAttTitle: s })}
                    description={dlgData.pendingAttDesc || ''}
                    onDescChange={s => setDlgData({ ...dlgData, pendingAttDesc: s })}
                    accent="emerald"
                    hint="Attach invoices, photos, or documents. Linked to THIS receipt (entityType=stock_in)."
                  />
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
                if (dlgType==='stockOut'&&!sd.enterpriseId) sd.enterpriseId=eid
                if (dlgType==='stockInRecorder'&&!sd.enterpriseId) sd.enterpriseId=eid
                if (dlgType==='category'&&!sd.enterpriseId) sd.enterpriseId=eid
                if (dlgType==='condition'&&!sd.enterpriseId) sd.enterpriseId=eid
                // Normalize conditionId (empty string/undefined → null)
                if (dlgType==='registerItem' || dlgType==='stockIn' || dlgType==='stockOutItem') {
                  if (!sd.conditionId || sd.conditionId === 0) sd.conditionId = null
                }
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
                    await apiFetch('/stock', { method: 'POST', body: JSON.stringify({ action: 'stockIn', productId: prodRes.id, warehouseId: dlgData.warehouseId, quantity: dlgData.quantity, conditionId: dlgData.conditionId || null }) })
                    toast({ title: `Registered: ${dlgData.name} with ${dlgData.quantity} ${dlgData.unit || 'pcs'}` })
                  } catch (e: any) {
                    toast({ title: `Product created but stock-in failed: ${e.message}. Add stock manually.`, variant: 'destructive' })
                  }
                  // Product-level attachments (entityType='product', entityId=prodRes.id)
                  if (dlgData.pendingFiles?.length && prodRes.id) {
                    await uploadAttachmentsFor('product', prodRes.id, dlgData.warehouseId, dlgData.pendingFiles, { metaFields: dlgData.pendingMetaFields, title: dlgData.pendingAttTitle, description: dlgData.pendingAttDesc })
                  }
                  await loadData()
                }
                else if (dlgType==='stockIn') {
                  if (!dlgData.productId) { toast({ title: 'Select a product', variant: 'destructive' }); return }
                  if (!dlgData.warehouseId) { toast({ title: 'Select a warehouse', variant: 'destructive' }); return }
                  if (!dlgData.quantity || dlgData.quantity <= 0) { toast({ title: 'Enter a positive quantity', variant: 'destructive' }); return }
                  try {
                    await apiFetch('/stock', { method: 'POST', body: JSON.stringify({ action: 'stockIn', productId: dlgData.productId, warehouseId: dlgData.warehouseId, quantity: dlgData.quantity, conditionId: dlgData.conditionId || null }) })
                    toast({ title: `Stock in: +${dlgData.quantity} added` })
                  } catch (e: any) {
                    toast({ title: `Stock in failed: ${e.message}`, variant: 'destructive' })
                  }
                  await loadData()
                }
                else if (dlgType==='stockOutItem') {
                  const recorderId = sd.recorderId
                  if (!recorderId) { toast({ title: 'No recorder selected', variant: 'destructive' }); return }
                  if (!sd.enterpriseId) sd.enterpriseId = eid
                  // Capture created item ID so we can attach files at the item level (stock_out_item)
                  const createdItem = await apiFetch(`/stock-out/${recorderId}/item`, { method: 'POST', body: JSON.stringify(sd) })
                  if (dlgData.pendingFiles?.length && createdItem?.id) {
                    await uploadAttachmentsFor('stock_out_item', createdItem.id, dlgData.warehouseId, dlgData.pendingFiles, { metaFields: dlgData.pendingMetaFields, title: dlgData.pendingAttTitle, description: dlgData.pendingAttDesc })
                  }
                  await loadData()
                }
                else if (dlgEdit && dlgType==='stockInRecorder') { await crud.update(`/stock-in/${dlgEdit.id}`, sd); if (dlgData.pendingFiles?.length) await uploadAttachmentsFor('stock_in', dlgEdit.id, dlgData.warehouseId, dlgData.pendingFiles, { metaFields: dlgData.pendingMetaFields, title: dlgData.pendingAttTitle, description: dlgData.pendingAttDesc }) }
                else if (dlgType==='stockInRecorder') {
                  const rec = await apiFetch('/stock-in', { method: 'POST', body: JSON.stringify(sd) })
                  toast({ title: 'Created successfully' })
                  if (dlgData.pendingFiles?.length) await uploadAttachmentsFor('stock_in', rec.id, dlgData.warehouseId, dlgData.pendingFiles, { metaFields: dlgData.pendingMetaFields, title: dlgData.pendingAttTitle, description: dlgData.pendingAttDesc })
                  await loadData()
                }
                else if (dlgEdit && dlgType==='order') { await crud.update(`/orders/${dlgEdit.id}`, sd); if (dlgData.pendingFiles?.length) await uploadAttachmentsFor('order', dlgEdit.id, dlgData.warehouseId, dlgData.pendingFiles, { metaFields: dlgData.pendingMetaFields, title: dlgData.pendingAttTitle, description: dlgData.pendingAttDesc }) }
                else if (dlgType==='order') {
                  const ord = await apiFetch('/orders', { method: 'POST', body: JSON.stringify(sd) })
                  toast({ title: 'Order created' })
                  if (dlgData.pendingFiles?.length && ord?.id) await uploadAttachmentsFor('order', ord.id, dlgData.warehouseId, dlgData.pendingFiles, { metaFields: dlgData.pendingMetaFields, title: dlgData.pendingAttTitle, description: dlgData.pendingAttDesc })
                  await loadData()
                }
                else if (dlgEdit) await crud.update(dlgType==='stockOut' ? `/stock-out/${dlgEdit.id}` : `/${dlgType}s/${dlgEdit.id}`,sd)
                else if (dlgType==='stockOut') {
                  const rec = await apiFetch('/stock-out', { method: 'POST', body: JSON.stringify(sd) })
                  toast({ title: 'Created successfully' })
                  if (dlgData.pendingFiles?.length) await uploadAttachmentsFor('stock_out', rec.id, dlgData.warehouseId, dlgData.pendingFiles, { metaFields: dlgData.pendingMetaFields, title: dlgData.pendingAttTitle, description: dlgData.pendingAttDesc })
                  await loadData()
                }
                else await crud.create(`/${dlgType}s`, sd)
                } catch(e: any) { toast({ title: e.message, variant: 'destructive' }) }
                setDlgSubmitting(false)
                setDlgOpen(false)
              }} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">{dlgSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}{dlgEdit?t(locale,'save'):t(locale,'add')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── LOTS DIALOG (Change 2: View Lots for a product×warehouse) ─── */}
        <Dialog open={lotsDialog.open} onOpenChange={o => setLotsDialog(s => ({ ...s, open: o }))}>
          <DialogContent className="max-w-2xl w-[95vw]">
            <DialogHeader><DialogTitle className="text-base font-bold flex items-center gap-1.5"><Layers className="w-4 h-4 text-violet-500" />Lots for {lotsDialog.productName}</DialogTitle></DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {lotsLoading ? <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-violet-500" /></div> : lotsData.length === 0 ? <div className="text-center text-sm text-muted-foreground py-8">No lots found for this product in this warehouse.</div> : (
                <>
                {/* Mobile: stacked cards */}
                <div className="sm:hidden space-y-2">
                  {lotsData.slice((lotsPage - 1) * LOTS_PER_PAGE, lotsPage * LOTS_PER_PAGE).map(l => { const lcond = conditions.find(c => c.id === l.conditionId)
                    return (
                    <Card key={l.id} className="border-violet-100 dark:border-violet-500/20"><CardContent className="p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-mono font-semibold truncate">{l.lotNumber}</span><div className="flex items-center gap-1 shrink-0">{lcond && <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border-0 text-[9px]">{lcond.name}</Badge>}{l.status === 'open' ? <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-0 text-[9px] shrink-0">Open</Badge> : <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-0 text-[9px] shrink-0">Closed</Badge>}</div></div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                        <div><span className="text-muted-foreground">Qty: </span><span className="font-mono font-medium">{l.quantity}</span></div>
                        <div><span className="text-muted-foreground">Remaining: </span><span className="font-mono font-medium">{l.remainingQty}</span></div>
                        <div><span className="text-muted-foreground">Cost/U: </span><span className="font-medium">{fmt(l.costPerUnit)}</span></div>
                        <div><span className="text-muted-foreground">Source: </span><Badge className={`${l.source === 'stock_in' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : l.source === 'register_item' ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'} border-0 text-[9px]`}>{l.source.replace('_', ' ')}</Badge></div>
                        <div className="col-span-2"><span className="text-muted-foreground">Supplier: </span><span className="font-medium">{l.supplierName || '—'}</span></div>
                        <div className="col-span-2"><span className="text-muted-foreground">Received: </span><span className="font-medium">{new Date(l.receivedDate).toLocaleDateString()}</span></div>
                        {l.notes && <div className="col-span-2 text-muted-foreground italic truncate">{l.notes}</div>}
                      </div>
                    </CardContent></Card>)})}
                </div>
                {/* Desktop: table */}
                <div className="hidden sm:block rounded-md border"><Table>
                  <TableHeader><TableRow>
                    <TableHead className="h-7 text-[10px]">Lot Number</TableHead>
                    <TableHead className="h-7 text-[10px] text-right">Quantity</TableHead>
                    <TableHead className="h-7 text-[10px] text-right">Remaining</TableHead>
                    <TableHead className="h-7 text-[10px] text-right">Cost/Unit</TableHead>
                    <TableHead className="h-7 text-[10px]">Supplier</TableHead>
                    <TableHead className="h-7 text-[10px]">Source</TableHead>
                    <TableHead className="h-7 text-[10px]">Condition</TableHead>
                    <TableHead className="h-7 text-[10px]">Received</TableHead>
                    <TableHead className="h-7 text-[10px] text-center">Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {lotsData.slice((lotsPage - 1) * LOTS_PER_PAGE, lotsPage * LOTS_PER_PAGE).map(l => { const lcond = conditions.find(c => c.id === l.conditionId)
                      return (
                      <TableRow key={l.id}>
                        <TableCell className="py-1.5 text-[11px] font-mono">{l.lotNumber}</TableCell>
                        <TableCell className="py-1.5 text-[11px] text-right font-mono">{l.quantity}</TableCell>
                        <TableCell className="py-1.5 text-[11px] text-right font-mono">{l.remainingQty}</TableCell>
                        <TableCell className="py-1.5 text-[11px] text-right">{fmt(l.costPerUnit)}</TableCell>
                        <TableCell className="py-1.5 text-[11px] text-muted-foreground">{l.supplierName || '—'}</TableCell>
                        <TableCell className="py-1.5 text-[11px]"><Badge className={`${l.source === 'stock_in' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : l.source === 'register_item' ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'} border-0 text-[9px]`}>{l.source.replace('_', ' ')}</Badge></TableCell>
                        <TableCell className="py-1.5">{lcond ? <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border-0 text-[9px] h-4">{lcond.name}</Badge> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="py-1.5 text-[11px] text-muted-foreground">{new Date(l.receivedDate).toLocaleDateString()}</TableCell>
                        <TableCell className="py-1.5 text-center">{l.status === 'open' ? <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-0 text-[9px]">Open</Badge> : <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-0 text-[9px]">Closed</Badge>}</TableCell>
                      </TableRow>)})}
                  </TableBody>
                </Table></div>
                </>
              )}
            </div>
            {lotsData.length > LOTS_PER_PAGE && <Pager page={lotsPage} totalPages={Math.ceil(lotsData.length / LOTS_PER_PAGE)} onPageChange={setLotsPage} />}
            <DialogFooter><Button variant="ghost" onClick={() => setLotsDialog(s => ({ ...s, open: false }))} className="text-muted-foreground">{t(locale, 'cancel')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── RETURNS: single-item return dialog ─── */}
        <Dialog open={returnDlg.open} onOpenChange={o => setReturnDlg(s => ({ ...s, open: o }))}>
          <DialogContent className="max-w-md w-[95vw]">
            <DialogHeader><DialogTitle className="text-base font-bold flex items-center gap-1.5"><RotateCcw className="w-4 h-4 text-violet-500" />Process Return</DialogTitle></DialogHeader>
            {returnDlg.item && (() => { const it = returnDlg.item; const wh = warehouses.find(w => w.id === it.warehouseId)
              return (<div className="space-y-2.5">
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-1">
                  <div className="text-sm font-semibold">{it.product?.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{it.product?.sku} · {wh?.name || `WH #${it.warehouseId}`}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] mt-1">
                    <span className="text-muted-foreground">Out: <span className="font-mono font-medium text-foreground">{it.quantity} {it.unit}</span></span>
                    <span className="text-muted-foreground">Returned: <span className="font-mono font-medium text-emerald-600">{it.returnedQty}</span></span>
                    <span className="text-muted-foreground">Remaining: <span className="font-mono font-medium text-violet-600">{it.remainingQty}</span></span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">Recorder: <span className="font-mono">{it.recorder?.recorderCode}</span> · Person: <span className="font-medium text-foreground">{it.recorder?.personName || '—'}</span></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={RotateCcw}>Return Quantity</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Hash}>Quantity to return (max {it.remainingQty})</IconLabel>
                    <Input type="number" min={1} max={it.remainingQty} value={returnDlg.qty} onChange={e => setReturnDlg(s => ({ ...s, qty: parseInt(e.target.value) || 0 }))} className="h-9 text-sm rounded-md" />
                    <div className="flex gap-1.5 mt-1">
                      <Button size="sm" variant="outline" onClick={() => setReturnDlg(s => ({ ...s, qty: it.remainingQty }))} className="h-6 text-[10px]">Full ({it.remainingQty})</Button>
                      <Button size="sm" variant="outline" onClick={() => setReturnDlg(s => ({ ...s, qty: Math.max(1, Math.floor(it.remainingQty / 2)) }))} className="h-6 text-[10px]">Half</Button>
                    </div>
                  </div>
                  <div className="space-y-1"><IconLabel icon={FileText}>Notes (optional)</IconLabel>
                    <Textarea value={returnDlg.notes} onChange={e => setReturnDlg(s => ({ ...s, notes: e.target.value }))} placeholder="Reason for return, condition, etc." className="rounded-md min-h-[60px]" />
                  </div>
                </div>
                <AttachmentPicker
                    files={returnDlg.pendingFiles || []}
                    onFilesChange={f => setReturnDlg(s => ({ ...s, pendingFiles: f }))}
                    metaFields={returnDlg.pendingMetaFields || []}
                    onMetaChange={m => setReturnDlg(s => ({ ...s, pendingMetaFields: m }))}
                    title={returnDlg.pendingAttTitle || ''}
                    onTitleChange={s2 => setReturnDlg(s => ({ ...s, pendingAttTitle: s2 }))}
                    description={returnDlg.pendingAttDesc || ''}
                    onDescChange={s2 => setReturnDlg(s => ({ ...s, pendingAttDesc: s2 }))}
                    accent="violet"
                    hint="Attach return receipts, photos of the returned item, or condition evidence. Linked to THIS return (entityType=return)."
                  />
                <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-md p-2 text-[11px] text-violet-700 dark:text-violet-400 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>This will restock <span className="font-mono font-semibold">{returnDlg.qty || 0} {it.unit}</span> of <span className="font-semibold">{it.product?.name}</span> into <span className="font-semibold">{wh?.name || `WH #${it.warehouseId}`}</span> and create a Lot with source=<span className="font-mono">adjustment</span>.</span>
                </div>
              </div>)
            })()}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setReturnDlg(s => ({ ...s, open: false }))} className="text-muted-foreground" disabled={returnDlg.submitting}>{t(locale, 'cancel')}</Button>
              <Button onClick={submitReturn} disabled={returnDlg.submitting || !returnDlg.qty || (returnDlg.item ? returnDlg.qty > returnDlg.item.remainingQty : true)} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white">
                {returnDlg.submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RotateCcw className="w-4 h-4 mr-1.5" />}Process Return
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── RETURNS: source-record dialog (shows the StockOutRecorder + return history) ─── */}
        <Dialog open={returnSourceDlg.open} onOpenChange={o => setReturnSourceDlg(s => ({ ...s, open: o }))}>
          <DialogContent className="max-w-2xl w-[95vw]">
            <DialogHeader><DialogTitle className="text-base font-bold flex items-center gap-1.5"><Eye className="w-4 h-4 text-violet-500" />Source Record</DialogTitle></DialogHeader>
            {returnSourceDlg.loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-violet-500" /><span className="ml-2 text-sm text-muted-foreground">Loading source record...</span></div>
            ) : returnSourceDlg.item && (() => { const it = returnSourceDlg.item; const wh = warehouses.find(w => w.id === it.warehouseId); const rec = it.recorder
              return (<div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
                {/* Item summary */}
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-1">
                  <div className="text-sm font-semibold flex items-center gap-1.5 flex-wrap">{it.product?.name}{(() => { const c = conditions.find(x => x.id === it.conditionId); return c ? <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border-0 text-[9px] h-4">{c.name}</Badge> : null })()}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{it.product?.sku} · {wh?.name || `WH #${it.warehouseId}`}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] mt-1">
                    <span className="text-muted-foreground">Out: <span className="font-mono font-medium text-foreground">{it.quantity} {it.unit}</span></span>
                    <span className="text-muted-foreground">Returned: <span className="font-mono font-medium text-emerald-600">{it.returnedQty}</span></span>
                    <span className="text-muted-foreground">Remaining: <span className="font-mono font-medium text-violet-600">{it.remainingQty}</span></span>
                    {it.isReturnable ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-0 text-[9px] h-4">Flagged</Badge> : <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border-0 text-[9px] h-4">Not flagged</Badge>}
                  </div>
                </div>
                {/* Recorder (source record) details */}
                {rec && (<div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5">
                  <SectionHeader icon={ArrowUpFromLine}>From Stock-Out Recorder</SectionHeader>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold">{rec.recorderCode}</span>{statusBadge(rec.status)}<span className="text-[11px] text-muted-foreground">{new Date(rec.createdAt).toLocaleString()}</span></div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                    {rec.personName && <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5 text-muted-foreground" />{rec.personName}</span>}
                    {rec.personPhone && <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5 text-muted-foreground" />{rec.personPhone}</span>}
                    {rec.personEmail && <span className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5 text-muted-foreground" />{rec.personEmail}</span>}
                    {rec.personAddress && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5 text-muted-foreground" />{rec.personAddress}</span>}
                  </div>
                  {rec.notes && <div className="text-[11px] text-muted-foreground italic flex items-start gap-1"><FileText className="w-2.5 h-2.5 mt-0.5 shrink-0" />{rec.notes}</div>}
                  {/* All items in this recorder */}
                  {(rec as any).items && (rec as any).items.length > 0 && (<div className="pt-1.5 border-t mt-1.5">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">All Items in this Recorder ({(rec as any).items.length})</div>
                    <div className="space-y-0.5 max-h-32 overflow-y-auto">
                      {(rec as any).items.map((ri: any) => (
                        <div key={ri.id} className={`text-[11px] flex items-center justify-between gap-2 px-1.5 py-0.5 rounded ${ri.id === it.id ? 'bg-violet-100 dark:bg-violet-500/20 font-semibold' : ''}`}>
                          <span className="truncate flex items-center gap-1">{ri.product?.name || `#${ri.productId}`}{(() => { const c = conditions.find(x => x.id === ri.conditionId); return c ? <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border-0 text-[8px] h-3.5 px-1">{c.name}</Badge> : null })()}</span>
                          <span className="font-mono shrink-0">{ri.quantity} {ri.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>)}
                </div>)}
                {/* Return history */}
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5">
                  <SectionHeader icon={RotateCcw}>Return History ({it.returns?.length || 0})</SectionHeader>
                  {(!it.returns || it.returns.length === 0) ? (
                    <div className="text-[11px] text-muted-foreground text-center py-2">No returns processed yet.</div>
                  ) : (
                    <div className="space-y-1">
                      {it.returns.map(r => (
                        <div key={r.id} className="bg-background border rounded-md p-1.5 flex items-center justify-between gap-2">
                          <div className="min-w-0"><div className="text-[11px] font-mono"><span className="text-violet-600 font-semibold">+{r.quantity}</span> <span className="text-muted-foreground">{r.unit}</span></div>
                            {r.notes && <div className="text-[10px] text-muted-foreground italic truncate">{r.notes}</div>}</div>
                          <div className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{new Date(r.returnedAt).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Non-Returnable history (mirrors Return history, rose theme) */}
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5">
                  <SectionHeader icon={Ban}>Non-Returnable History ({it.nonReturnables?.length || 0})</SectionHeader>
                  {(!it.nonReturnables || it.nonReturnables.length === 0) ? (
                    <div className="text-[11px] text-muted-foreground text-center py-2">No non-returnable decisions yet.</div>
                  ) : (
                    <div className="space-y-1">
                      {it.nonReturnables.map(n => (
                        <div key={n.id} className="bg-background border rounded-md p-1.5 flex items-center justify-between gap-2">
                          <div className="min-w-0"><div className="text-[11px] font-mono flex items-center gap-1"><span className="text-rose-600 font-semibold">×{n.quantity}</span> <span className="text-muted-foreground">{n.unit}</span><Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border-0 text-[9px] h-4">{REASON_LABELS[n.reason] || n.reason}</Badge></div>
                            {(n.reasonDetail || n.notes) && <div className="text-[10px] text-muted-foreground italic truncate">{n.reasonDetail || n.notes}</div>}</div>
                          <div className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{new Date(n.decidedAt).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>)
            })()}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setReturnSourceDlg(s => ({ ...s, open: false }))} className="text-muted-foreground">Close</Button>
              {returnSourceDlg.item && returnSourceDlg.item.isReturnable && returnSourceDlg.item.remainingQty > 0 && <Button onClick={() => { const it: ReturnableItem | null = returnSourceDlg.item; if (!it) return; setReturnSourceDlg(s => ({ ...s, open: false })); openNonRetDlg(it); }} className="bg-gradient-to-r from-rose-600 to-red-600 text-white"><Ban className="w-4 h-4 mr-1.5" />Mark Non-Returnable</Button>}
              {returnSourceDlg.item && <Button onClick={() => { const it: ReturnableItem | null = returnSourceDlg.item; if (!it) return; setReturnSourceDlg(s => ({ ...s, open: false })); openReturnDlg(it); }} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white"><RotateCcw className="w-4 h-4 mr-1.5" />Return This Item</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── RETURNS: group-return dialog (mirrors Stock-In recorder creation) ─── */}
        <Dialog open={groupReturnDlg.open} onOpenChange={o => setGroupReturnDlg(s => ({ ...s, open: o }))}>
          <DialogContent className="max-w-2xl w-[95vw]">
            <DialogHeader><DialogTitle className="text-base font-bold flex items-center gap-1.5"><Users className="w-4 h-4 text-violet-500" />{groupReturnDlg.mode === 'new' ? 'New Group Return Record' : `Group Return: ${groupReturnDlg.personKey}`}</DialogTitle>
              <p className="text-[11px] text-muted-foreground font-normal">{groupReturnDlg.mode === 'new' ? 'Create a brand-new return record (like Stock-In "New Receipt"): enter the returning party, add items from any stock-out, then submit — this creates a RET- record that restocks inventory.' : 'Review the supplier/person, confirm the restock warehouse, then set the return quantity per item. Submitting creates a new RET- return record.'}</p>
            </DialogHeader>
            <div className="space-y-2.5 max-h-[62vh] overflow-y-auto pr-1">
              {/* ── Supplier / Person header (editable, mirrors Stock-In recorder) ── */}
              <div className="bg-violet-50/60 dark:bg-violet-500/5 rounded-lg p-2.5 space-y-2 border border-violet-100 dark:border-violet-500/20">
                <SectionHeader icon={Truck}>Supplier / Person (returning party)</SectionHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1"><IconLabel icon={Users}>Person Name</IconLabel><Input value={groupReturnDlg.personName} onChange={e => setGroupReturnDlg(s => ({ ...s, personName: e.target.value }))} placeholder="Enter name..." className="h-8 text-sm rounded-md" /></div>
                  <div className="space-y-1"><IconLabel icon={Phone}>Phone</IconLabel><Input value={groupReturnDlg.personPhone} onChange={e => setGroupReturnDlg(s => ({ ...s, personPhone: e.target.value }))} className="h-8 text-sm rounded-md" /></div>
                  <div className="space-y-1"><IconLabel icon={Mail}>Email</IconLabel><Input value={groupReturnDlg.personEmail} onChange={e => setGroupReturnDlg(s => ({ ...s, personEmail: e.target.value }))} className="h-8 text-sm rounded-md" /></div>
                  <div className="space-y-1"><IconLabel icon={MapPin}>Address</IconLabel><Input value={groupReturnDlg.personAddress} onChange={e => setGroupReturnDlg(s => ({ ...s, personAddress: e.target.value }))} className="h-8 text-sm rounded-md" /></div>
                </div>
              </div>

              {/* ── Restock warehouse ── */}
              {groupReturnDlg.mode === 'prefilled' ? (
                <div className="bg-violet-50/60 dark:bg-violet-500/5 rounded-lg p-2.5 space-y-1.5 border border-violet-100 dark:border-violet-500/20">
                  <SectionHeader icon={WHIcon}>Restock Warehouse</SectionHeader>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-0">{warehouses.find(w => w.id === groupReturnDlg.warehouseId)?.code || '—'}</Badge>
                    <span className="font-medium">{warehouses.find(w => w.id === groupReturnDlg.warehouseId)?.name || 'No warehouse'}</span>
                    <span className="text-muted-foreground">· items return to their original warehouse</span>
                  </div>
                </div>
              ) : (
                <div className="bg-violet-50/60 dark:bg-violet-500/5 rounded-lg p-2.5 space-y-1 border border-violet-100 dark:border-violet-500/20">
                  <SectionHeader icon={WHIcon}>Restock</SectionHeader>
                  <p className="text-[11px] text-muted-foreground">Each item returns to its original warehouse (shown per item below).</p>
                </div>
              )}

              {/* ── Item picker (NEW mode only) — search + ADVANCED collapsible filters + add items from ALL returnable stock-outs ── */}
              {groupReturnDlg.mode === 'new' && (
                <div className="bg-muted/30 rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Search className="w-3 h-3" />Add Items to Return</span>
                    {groupReturnDlg.loadingAvailable && <Loader2 className="w-3 h-3 animate-spin text-violet-500" />}
                  </div>
                  <Input value={groupReturnDlg.itemSearch} onChange={e => setGroupReturnDlg(s => ({ ...s, itemSearch: e.target.value, availPage: 1 }))} placeholder="Search by product, SKU, person, or recorder code..." className="h-8 text-xs" />
                  {(() => {
                    // active count for the advanced filter panel
                    const advActive = (groupReturnDlg.filterWarehouse !== '' ? 1 : 0)
                      + (groupReturnDlg.filterCategory !== '' ? 1 : 0)
                      + (groupReturnDlg.filterCondition !== '' ? 1 : 0)
                      + (groupReturnDlg.filterPerson.trim() ? 1 : 0)
                      + (groupReturnDlg.filterDateFrom ? 1 : 0)
                      + (groupReturnDlg.filterDateTo ? 1 : 0)
                      + (groupReturnDlg.filterProgress ? 1 : 0)
                      + (groupReturnDlg.filterFlagged ? 1 : 0)
                    const clearAdv = () => setGroupReturnDlg(s => ({ ...s, filterWarehouse: '', filterCategory: '', filterCondition: '', filterPerson: '', filterDateFrom: '', filterDateTo: '', filterProgress: '', filterFlagged: '', availPage: 1 }))
                    return (
                      <FilterPanel
                        activeCount={advActive}
                        onClear={clearAdv}
                        title="Advanced Filters"
                        defaultOpen={false}
                        resultLabel={`${groupReturnDlg.availableItems.length} returnable item(s)`}
                      >
                        <FilterField label="Warehouse" width="w-44">
                          <Popover open={groupReturnDlg.whComboOpen} onOpenChange={o => setGroupReturnDlg(s => ({ ...s, whComboOpen: o, whComboSearch: o ? s.whComboSearch : '' }))}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" className="h-8 text-xs justify-between w-full font-normal px-2">
                                <span className="truncate">{groupReturnDlg.filterWarehouse === '' ? 'All Warehouses' : (warehouses.find(w => w.id === groupReturnDlg.filterWarehouse)?.name || `#${groupReturnDlg.filterWarehouse}`)}</span>
                                <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-44 p-0" align="start">
                              <div className="p-1.5 border-b sticky top-0 bg-popover">
                                <div className="relative"><Search className="w-3 h-3 text-muted-foreground absolute left-1.5 top-1/2 -translate-y-1/2" /><Input placeholder="Search warehouse..." value={groupReturnDlg.whComboSearch} onChange={e => setGroupReturnDlg(s => ({ ...s, whComboSearch: e.target.value }))} className="h-7 text-xs pl-6" /></div>
                              </div>
                              <div className="max-h-40 overflow-y-auto">
                                <button onClick={() => { setGroupReturnDlg(s => ({ ...s, filterWarehouse: '', availPage: 1, whComboOpen: false })); }} className={`w-full text-left px-2 py-1.5 text-xs hover:bg-violet-50 dark:hover:bg-violet-500/10 ${groupReturnDlg.filterWarehouse === '' ? 'bg-violet-50 dark:bg-violet-500/10 font-medium text-violet-700 dark:text-violet-400' : ''}`}>All Warehouses</button>
                                {warehouses.filter(w => { const s = groupReturnDlg.whComboSearch.toLowerCase(); return !s || w.name.toLowerCase().includes(s) || (w.code || '').toLowerCase().includes(s) }).map(w => (
                                  <button key={w.id} onClick={() => { setGroupReturnDlg(s => ({ ...s, filterWarehouse: w.id, availPage: 1, whComboOpen: false })); }} className={`w-full text-left px-2 py-1.5 text-xs hover:bg-violet-50 dark:hover:bg-violet-500/10 ${groupReturnDlg.filterWarehouse === w.id ? 'bg-violet-50 dark:bg-violet-500/10 font-medium text-violet-700 dark:text-violet-400' : ''}`}>{w.name} <span className="text-[9px] text-muted-foreground font-mono">{w.code}</span></button>
                                ))}
                                {warehouses.filter(w => { const s = groupReturnDlg.whComboSearch.toLowerCase(); return !s || w.name.toLowerCase().includes(s) || (w.code || '').toLowerCase().includes(s) }).length === 0 && <div className="px-2 py-2 text-[11px] text-muted-foreground text-center">No warehouse matches.</div>}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </FilterField>
                        <FilterField label="Category" width="w-40">
                          <PaginatedCombobox
                            items={categories.map(c => ({ value: String(c.id), label: c.name }))}
                            value={groupReturnDlg.filterCategory === '' ? '_all' : String(groupReturnDlg.filterCategory)}
                            onChange={v => setGroupReturnDlg(s => ({ ...s, filterCategory: v === '_all' ? '' : Number(v), availPage: 1 }))}
                            allLabel="All Categories"
                            placeholder="All Categories"
                          />
                        </FilterField>
                        <FilterField label="Condition" width="w-40">
                          <PaginatedCombobox
                            items={conditions.map(c => ({ value: String(c.id), label: c.name }))}
                            value={groupReturnDlg.filterCondition === '' ? '_all' : String(groupReturnDlg.filterCondition)}
                            onChange={v => setGroupReturnDlg(s => ({ ...s, filterCondition: v === '_all' ? '' : Number(v), availPage: 1 }))}
                            allLabel="All Conditions"
                            placeholder="All Conditions"
                          />
                        </FilterField>
                        <FilterField label="Person / Supplier" width="w-44">
                          <Input value={groupReturnDlg.filterPerson} onChange={e => setGroupReturnDlg(s => ({ ...s, filterPerson: e.target.value, availPage: 1 }))} placeholder="Name contains..." className="h-8 text-xs" />
                        </FilterField>
                        <FilterField label="Stock-Out From" width="w-40">
                          <Input type="date" value={groupReturnDlg.filterDateFrom} onChange={e => setGroupReturnDlg(s => ({ ...s, filterDateFrom: e.target.value, availPage: 1 }))} className="h-8 text-xs" />
                        </FilterField>
                        <FilterField label="Stock-Out To" width="w-40">
                          <Input type="date" value={groupReturnDlg.filterDateTo} onChange={e => setGroupReturnDlg(s => ({ ...s, filterDateTo: e.target.value, availPage: 1 }))} className="h-8 text-xs" />
                        </FilterField>
                        <FilterField label="Return Progress" width="w-40">
                          <Select value={groupReturnDlg.filterProgress || '_all'} onValueChange={v => setGroupReturnDlg(s => ({ ...s, filterProgress: v === '_all' ? '' : v as 'none' | 'partial' | 'full', availPage: 1 }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                            <SelectContent><SelectItem value="_all">All</SelectItem><SelectItem value="none">Not started</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="full">Fully returned</SelectItem></SelectContent>
                          </Select>
                        </FilterField>
                        <FilterField label="Flagged Status" width="w-44">
                          <Select value={groupReturnDlg.filterFlagged || '_all'} onValueChange={v => setGroupReturnDlg(s => ({ ...s, filterFlagged: v === '_all' ? '' : v as 'flagged' | 'not_flagged', availPage: 1 }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                            <SelectContent><SelectItem value="_all">All (both tabs)</SelectItem><SelectItem value="flagged">Should be returned</SelectItem><SelectItem value="not_flagged">Other stock-outs</SelectItem></SelectContent>
                          </Select>
                        </FilterField>
                      </FilterPanel>
                    )
                  })()}
                  <div className="max-h-56 overflow-y-auto rounded-md border bg-background">
                    {(() => {
                      const q = groupReturnDlg.itemSearch.toLowerCase().trim()
                      const personQ = groupReturnDlg.filterPerson.toLowerCase().trim()
                      const addedIds = new Set(groupReturnDlg.items.map(x => x.item.id))
                      const flaggedSet = new Set(groupReturnDlg.availableFlaggedIds)
                      const avail = groupReturnDlg.availableItems
                        .filter(it => !addedIds.has(it.id))
                        // search
                        .filter(it => !q || (it.product?.name || '').toLowerCase().includes(q) || (it.product?.sku || '').toLowerCase().includes(q) || (it.recorder?.personName || '').toLowerCase().includes(q) || (it.recorder?.recorderCode || '').toLowerCase().includes(q))
                        // warehouse
                        .filter(it => groupReturnDlg.filterWarehouse === '' || it.warehouseId === groupReturnDlg.filterWarehouse)
                        // category
                        .filter(it => groupReturnDlg.filterCategory === '' || it.product?.categoryId === groupReturnDlg.filterCategory)
                        // condition
                        .filter(it => groupReturnDlg.filterCondition === '' || it.conditionId === groupReturnDlg.filterCondition)
                        // person
                        .filter(it => !personQ || (it.recorder?.personName || '').toLowerCase().includes(personQ))
                        // date range (based on stock-out item createdAt)
                        .filter(it => !groupReturnDlg.filterDateFrom || new Date(it.createdAt || it.recorder?.createdAt || '') >= new Date(groupReturnDlg.filterDateFrom + 'T00:00:00'))
                        .filter(it => !groupReturnDlg.filterDateTo || new Date(it.createdAt || it.recorder?.createdAt || '') <= new Date(groupReturnDlg.filterDateTo + 'T23:59:59'))
                        // return progress
                        .filter(it => {
                          if (!groupReturnDlg.filterProgress) return true
                          if (groupReturnDlg.filterProgress === 'none') return it.returnedQty <= 0
                          if (groupReturnDlg.filterProgress === 'partial') return it.returnedQty > 0 && it.remainingQty > 0
                          if (groupReturnDlg.filterProgress === 'full') return it.remainingQty <= 0
                          return true
                        })
                        // flagged status
                        .filter(it => {
                          if (!groupReturnDlg.filterFlagged) return true
                          const isFlagged = flaggedSet.has(it.id)
                          return groupReturnDlg.filterFlagged === 'flagged' ? isFlagged : !isFlagged
                        })
                      if (groupReturnDlg.loadingAvailable) return <div className="text-center text-[11px] text-muted-foreground py-3">Loading returnable items...</div>
                      if (avail.length === 0) return <div className="text-center text-[11px] text-muted-foreground py-3">{addedIds.size === groupReturnDlg.availableItems.length ? 'All returnable items added.' : 'No items match your filters.'}</div>
                      const perPage = 8
                      const totalPages = Math.ceil(avail.length / perPage) || 1
                      const safePage = Math.min(groupReturnDlg.availPage, totalPages)
                      const paged = avail.slice((safePage - 1) * perPage, safePage * perPage)
                      return (<>
                        <div className="divide-y">
                          {paged.map(it => { const wh = warehouses.find(w => w.id === it.warehouseId); const isFlagged = flaggedSet.has(it.id); const gcond = conditions.find(c => c.id === it.conditionId)
                            return (<div key={it.id} className="flex items-center justify-between gap-2 p-1.5 hover:bg-violet-50/50 dark:hover:bg-violet-500/5">
                              <div className="min-w-0"><div className="text-[11px] font-medium truncate flex items-center gap-1">{it.product?.name || `#${it.productId}`} <span className="text-[9px] text-muted-foreground font-mono">{it.product?.sku}</span>{gcond && <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border-0 text-[8px] h-3.5 px-1">{gcond.name}</Badge>}{isFlagged && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-0 text-[8px] h-3.5 px-1">flagged</Badge>}</div><div className="text-[9px] text-muted-foreground">{wh?.name || `#${it.warehouseId}`} · {it.recorder?.personName || '—'} · {it.recorder?.recorderCode} · Remaining: <span className="font-mono font-medium text-violet-600">{it.remainingQty}</span></div></div>
                              <Button size="sm" variant="outline" onClick={() => addReturnItemToGroup(it)} className="h-6 text-[10px] px-2 shrink-0 border-violet-300 text-violet-700 dark:border-violet-500/40 dark:text-violet-400"><Plus className="w-2.5 h-2.5 mr-0.5" />Add</Button>
                            </div>)
                          })}
                        </div>
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between gap-1 p-1 border-t bg-muted/30">
                            <span className="text-[10px] text-muted-foreground px-1">{safePage}/{totalPages} · {avail.length} available</span>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setGroupReturnDlg(s => ({ ...s, availPage: safePage - 1 }))} className="h-6 w-6 p-0"><ChevronLeft className="w-3 h-3" /></Button>
                              <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setGroupReturnDlg(s => ({ ...s, availPage: safePage + 1 }))} className="h-6 w-6 p-0"><ChevronRight className="w-3 h-3" /></Button>
                            </div>
                          </div>
                        )}
                      </>)
                    })()}
                  </div>
                </div>
              )}

              {/* ── Items table (per-row qty input + Full; Remove in NEW mode, Switch in prefilled) ── */}
              <div className="bg-muted/30 rounded-lg p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Items to Return ({groupReturnDlg.items.length})</span>
                  {groupReturnDlg.mode === 'prefilled' && <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setGroupReturnDlg(s => ({ ...s, items: s.items.map(x => ({ ...x, selected: true })) }))} className="h-5 text-[10px] text-muted-foreground px-1.5">Select all</Button>
                    <Button size="sm" variant="ghost" onClick={() => setGroupReturnDlg(s => ({ ...s, items: s.items.map(x => ({ ...x, selected: false })) }))} className="h-5 text-[10px] text-muted-foreground px-1.5">None</Button>
                  </div>}
                </div>
                {groupReturnDlg.items.length === 0 ? <div className="text-center text-sm text-muted-foreground py-4">{groupReturnDlg.mode === 'new' ? 'No items added yet — search and add items above.' : 'No items in this group.'}</div> : (
                  (() => {
                    const perPage = 6
                    const totalPages = Math.ceil(groupReturnDlg.items.length / perPage) || 1
                    const safePage = Math.min(groupReturnDlg.itemsPage, totalPages)
                    const paged = groupReturnDlg.items.slice((safePage - 1) * perPage, safePage * perPage)
                    return (<>
                  <div className="space-y-1.5">
                    {paged.map(entry => {
                      const it = entry.item; const wh = warehouses.find(w => w.id === it.warehouseId)
                      return (<div key={it.id} className={`rounded-md border p-2 ${entry.selected ? 'bg-violet-50/40 dark:bg-violet-500/5 border-violet-200 dark:border-violet-500/30' : 'bg-muted/20'}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {groupReturnDlg.mode === 'prefilled' ? (
                              <Switch checked={entry.selected} onCheckedChange={v => setGroupReturnDlg(s => ({ ...s, items: s.items.map(x => x.item.id === it.id ? { ...x, selected: v } : x) }))} className="scale-75" />
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => removeReturnItemFromGroup(it.id)} className="h-5 w-5 p-0 text-red-500 shrink-0" title="Remove"><X className="w-3 h-3" /></Button>
                            )}
                            <div className="min-w-0"><div className="text-[11px] font-medium truncate">{it.product?.name || `#${it.productId}`}</div><div className="text-[9px] text-muted-foreground font-mono">{it.product?.sku} · {wh?.name || `#${it.warehouseId}`}{groupReturnDlg.mode === 'new' && <span> · {it.recorder?.personName || '—'}</span>}</div></div>
                          </div>
                          <div className="text-[10px] text-muted-foreground shrink-0 text-right">
                            <div>Out: <span className="font-mono font-medium text-foreground">{it.quantity}</span></div>
                            <div>Remaining: <span className="font-mono font-medium text-violet-600">{it.remainingQty}</span></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 pl-6">
                          <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Qty to return:</Label>
                          <Input type="number" min={1} max={it.remainingQty} value={entry.qty} onChange={e => setGroupReturnDlg(s => ({ ...s, items: s.items.map(x => x.item.id === it.id ? { ...x, qty: parseInt(e.target.value) || 0 } : x) }))} className="h-6 text-[11px] w-20" />
                          <Button size="sm" variant="outline" onClick={() => setGroupReturnDlg(s => ({ ...s, items: s.items.map(x => x.item.id === it.id ? { ...x, qty: it.remainingQty } : x) }))} className="h-6 text-[10px] px-1.5">Full</Button>
                        </div>
                      </div>)
                    })}
                  </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between gap-1 pt-1">
                          <span className="text-[10px] text-muted-foreground">Page {safePage} of {totalPages} · {groupReturnDlg.items.length} item(s)</span>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setGroupReturnDlg(s => ({ ...s, itemsPage: safePage - 1 }))} className="h-6 w-6 p-0"><ChevronLeft className="w-3 h-3" /></Button>
                            <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setGroupReturnDlg(s => ({ ...s, itemsPage: safePage + 1 }))} className="h-6 w-6 p-0"><ChevronRight className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      )}
                    </>)
                    })()
                  )}
              </div>

              {/* ── Notes (mirrors Stock-In recorder notes) ── */}
              <div className="bg-muted/30 rounded-lg p-2 space-y-1.5">
                <SectionHeader icon={FileText}>Return Notes (applies to all items in this group)</SectionHeader>
                <Textarea value={groupReturnDlg.notes} onChange={e => setGroupReturnDlg(s => ({ ...s, notes: e.target.value }))} placeholder="Optional notes for this group return..." className="text-sm rounded-md min-h-[50px]" />
              </div>

              {/* ── Summary bar ── */}
              <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-md p-2 text-[11px] text-violet-700 dark:text-violet-400">
                {groupReturnDlg.items.filter(i => (groupReturnDlg.mode === 'new' || i.selected) && i.qty > 0).length} item(s) selected · Total qty to return: {groupReturnDlg.items.filter(i => (groupReturnDlg.mode === 'new' || i.selected) && i.qty > 0).reduce((s, i) => s + i.qty, 0)}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setGroupReturnDlg(s => ({ ...s, open: false }))} className="text-muted-foreground" disabled={groupReturnDlg.submitting}>{t(locale, 'cancel')}</Button>
              <Button onClick={submitGroupReturn} disabled={groupReturnDlg.submitting || groupReturnDlg.items.filter(i => (groupReturnDlg.mode === 'new' || i.selected) && i.qty > 0).length === 0 || (groupReturnDlg.mode === 'new' && !groupReturnDlg.personName.trim())} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white">
                {groupReturnDlg.submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RotateCcw className="w-4 h-4 mr-1.5" />}Create Return Record
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── NON-RETURNABLES: single-item "mark as non-returnable" dialog (mirrors returnDlg) ─── */}
        <Dialog open={nonRetDlg.open} onOpenChange={o => setNonRetDlg(s => ({ ...s, open: o }))}>
          <DialogContent className="max-w-md w-[95vw]">
            <DialogHeader><DialogTitle className="text-base font-bold flex items-center gap-1.5"><Ban className="w-4 h-4 text-rose-500" />Mark as Non-Returnable</DialogTitle></DialogHeader>
            {nonRetDlg.item && (() => { const it = nonRetDlg.item; const wh = warehouses.find(w => w.id === it.warehouseId)
              return (<div className="space-y-2.5">
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-1">
                  <div className="text-sm font-semibold">{it.product?.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{it.product?.sku} · {wh?.name || `WH #${it.warehouseId}`}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] mt-1">
                    <span className="text-muted-foreground">Out: <span className="font-mono font-medium text-foreground">{it.quantity} {it.unit}</span></span>
                    <span className="text-muted-foreground">Returned: <span className="font-mono font-medium text-emerald-600">{it.returnedQty}</span></span>
                    <span className="text-muted-foreground">Non-Ret: <span className="font-mono font-medium text-rose-600">{it.nonReturnableQty || 0}</span></span>
                    <span className="text-muted-foreground">Remaining: <span className="font-mono font-medium text-violet-600">{it.remainingQty}</span></span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">Recorder: <span className="font-mono">{it.recorder?.recorderCode}</span> · Person: <span className="font-medium text-foreground">{it.recorder?.personName || '—'}</span></div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
                  <SectionHeader icon={Ban}>Non-Returnable Decision</SectionHeader>
                  <div className="space-y-1"><IconLabel icon={Hash}>Quantity to mark (max {it.remainingQty})</IconLabel>
                    <Input type="number" min={1} max={it.remainingQty} value={nonRetDlg.qty} onChange={e => setNonRetDlg(s => ({ ...s, qty: parseInt(e.target.value) || 0 }))} className="h-9 text-sm rounded-md" />
                    <div className="flex gap-1.5 mt-1">
                      <Button size="sm" variant="outline" onClick={() => setNonRetDlg(s => ({ ...s, qty: it.remainingQty }))} className="h-6 text-[10px]">Full ({it.remainingQty})</Button>
                      <Button size="sm" variant="outline" onClick={() => setNonRetDlg(s => ({ ...s, qty: Math.max(1, Math.floor(it.remainingQty / 2)) }))} className="h-6 text-[10px]">Half</Button>
                    </div>
                  </div>
                  <div className="space-y-1"><IconLabel icon={AlertTriangle}>Reason <span className="text-rose-500">*</span></IconLabel>
                    <PaginatedCombobox
                      items={NON_RETURNABLE_REASONS.map(r => ({ value: r.key, label: r.label }))}
                      value={nonRetDlg.reason || ''}
                      onChange={v => setNonRetDlg(s => ({ ...s, reason: v }))}
                      placeholder="Choose a reason..."
                      perPage={12}
                      contentClassName="w-64"
                    />
                  </div>
                  {nonRetDlg.reason === 'other' && (
                    <div className="space-y-1"><IconLabel icon={FileText}>Reason Detail <span className="text-rose-500">*</span></IconLabel>
                      <Input value={nonRetDlg.reasonDetail} onChange={e => setNonRetDlg(s => ({ ...s, reasonDetail: e.target.value }))} placeholder="Specify the reason..." className="h-9 text-sm rounded-md" />
                    </div>
                  )}
                  <div className="space-y-1"><IconLabel icon={FileText}>Notes (optional)</IconLabel>
                    <Textarea value={nonRetDlg.notes} onChange={e => setNonRetDlg(s => ({ ...s, notes: e.target.value }))} placeholder="Additional context, condition, inspector notes, etc." className="rounded-md min-h-[60px]" />
                  </div>
                </div>
                <AttachmentPicker
                    files={nonRetDlg.pendingFiles || []}
                    onFilesChange={f => setNonRetDlg(s => ({ ...s, pendingFiles: f }))}
                    metaFields={nonRetDlg.pendingMetaFields || []}
                    onMetaChange={m => setNonRetDlg(s => ({ ...s, pendingMetaFields: m }))}
                    title={nonRetDlg.pendingAttTitle || ''}
                    onTitleChange={s2 => setNonRetDlg(s => ({ ...s, pendingAttTitle: s2 }))}
                    description={nonRetDlg.pendingAttDesc || ''}
                    onDescChange={s2 => setNonRetDlg(s => ({ ...s, pendingAttDesc: s2 }))}
                    accent="rose"
                    hint="Attach evidence photos (damage, alteration, etc.) or inspector notes. Linked to THIS non-returnable decision (entityType=non_returnable)."
                  />
                <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-md p-2 text-[11px] text-rose-700 dark:text-rose-400 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>This will mark <span className="font-mono font-semibold">{nonRetDlg.qty || 0} {it.unit}</span> of <span className="font-semibold">{it.product?.name}</span> as non-returnable with reason <span className="font-semibold">{REASON_LABELS[nonRetDlg.reason] || nonRetDlg.reason || '(none selected)'}</span>. Inventory is NOT restocked — the units are simply recorded as non-returnable.</span>
                </div>
              </div>)
            })()}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setNonRetDlg(s => ({ ...s, open: false }))} className="text-muted-foreground" disabled={nonRetDlg.submitting}>{t(locale, 'cancel')}</Button>
              <Button onClick={submitNonReturnable} disabled={nonRetDlg.submitting || !nonRetDlg.qty || !nonRetDlg.reason || (nonRetDlg.item ? nonRetDlg.qty > nonRetDlg.item.remainingQty : true) || (nonRetDlg.reason === 'other' && !nonRetDlg.reasonDetail.trim())} className="bg-gradient-to-r from-rose-600 to-red-600 text-white">
                {nonRetDlg.submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Ban className="w-4 h-4 mr-1.5" />}Mark Non-Returnable
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── NON-RETURNABLES: group dialog (mirrors groupReturnDlg, with per-item reason dropdown) ─── */}
        <Dialog open={groupNonRetDlg.open} onOpenChange={o => setGroupNonRetDlg(s => ({ ...s, open: o }))}>
          <DialogContent className="max-w-2xl w-[95vw]">
            <DialogHeader><DialogTitle className="text-base font-bold flex items-center gap-1.5"><Users className="w-4 h-4 text-rose-500" />{groupNonRetDlg.mode === 'new' ? 'New Group Non-Returnable Record' : `Group Non-Returnable: ${groupNonRetDlg.personKey}`}</DialogTitle>
              <p className="text-[11px] text-muted-foreground font-normal">{groupNonRetDlg.mode === 'new' ? 'Create a brand-new non-returnable record (NR-YYYY-NNNN): enter the inspector/party, add flagged items from any stock-out, choose a reason per item, then submit. This records the decision without restocking inventory.' : 'Review the person, confirm the restock warehouse, then set the quantity + reason per item. Submitting creates a new NR- non-returnable record.'}</p>
            </DialogHeader>
            <div className="space-y-2.5 max-h-[62vh] overflow-y-auto pr-1">
              {/* ── Person header (editable) ── */}
              <div className="bg-rose-50/60 dark:bg-rose-500/5 rounded-lg p-2.5 space-y-2 border border-rose-100 dark:border-rose-500/20">
                <SectionHeader icon={Truck}>Inspector / Party (making the decision)</SectionHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1"><IconLabel icon={Users}>Person Name</IconLabel><Input value={groupNonRetDlg.personName} onChange={e => setGroupNonRetDlg(s => ({ ...s, personName: e.target.value }))} placeholder="Enter name..." className="h-8 text-sm rounded-md" /></div>
                  <div className="space-y-1"><IconLabel icon={Phone}>Phone</IconLabel><Input value={groupNonRetDlg.personPhone} onChange={e => setGroupNonRetDlg(s => ({ ...s, personPhone: e.target.value }))} className="h-8 text-sm rounded-md" /></div>
                  <div className="space-y-1"><IconLabel icon={Mail}>Email</IconLabel><Input value={groupNonRetDlg.personEmail} onChange={e => setGroupNonRetDlg(s => ({ ...s, personEmail: e.target.value }))} className="h-8 text-sm rounded-md" /></div>
                  <div className="space-y-1"><IconLabel icon={MapPin}>Address</IconLabel><Input value={groupNonRetDlg.personAddress} onChange={e => setGroupNonRetDlg(s => ({ ...s, personAddress: e.target.value }))} className="h-8 text-sm rounded-md" /></div>
                </div>
              </div>

              {/* ── Item picker (NEW mode only) — search + ADVANCED collapsible filters ── */}
              {groupNonRetDlg.mode === 'new' && (
                <div className="bg-muted/30 rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Search className="w-3 h-3" />Add Items to Mark</span>
                    {groupNonRetDlg.loadingAvailable && <Loader2 className="w-3 h-3 animate-spin text-rose-500" />}
                  </div>
                  <Input value={groupNonRetDlg.itemSearch} onChange={e => setGroupNonRetDlg(s => ({ ...s, itemSearch: e.target.value, availPage: 1 }))} placeholder="Search by product, SKU, person, or recorder code..." className="h-8 text-xs" />
                  {(() => {
                    const advActive = (groupNonRetDlg.filterWarehouse !== '' ? 1 : 0)
                      + (groupNonRetDlg.filterCategory !== '' ? 1 : 0)
                      + (groupNonRetDlg.filterCondition !== '' ? 1 : 0)
                      + (groupNonRetDlg.filterPerson.trim() ? 1 : 0)
                      + (groupNonRetDlg.filterDateFrom ? 1 : 0)
                      + (groupNonRetDlg.filterDateTo ? 1 : 0)
                      + (groupNonRetDlg.filterProgress ? 1 : 0)
                      + (groupNonRetDlg.filterFlagged ? 1 : 0)
                    const clearAdv = () => setGroupNonRetDlg(s => ({ ...s, filterWarehouse: '', filterCategory: '', filterCondition: '', filterPerson: '', filterDateFrom: '', filterDateTo: '', filterProgress: '', filterFlagged: '', availPage: 1 }))
                    return (
                      <FilterPanel
                        activeCount={advActive}
                        onClear={clearAdv}
                        title="Advanced Filters"
                        defaultOpen={false}
                        resultLabel={`${groupNonRetDlg.availableItems.length} item(s)`}
                      >
                        <FilterField label="Warehouse" width="w-44">
                          <Popover open={groupNonRetDlg.whComboOpen} onOpenChange={o => setGroupNonRetDlg(s => ({ ...s, whComboOpen: o, whComboSearch: o ? s.whComboSearch : '' }))}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" className="h-8 text-xs justify-between w-full font-normal px-2">
                                <span className="truncate">{groupNonRetDlg.filterWarehouse === '' ? 'All Warehouses' : (warehouses.find(w => w.id === groupNonRetDlg.filterWarehouse)?.name || `#${groupNonRetDlg.filterWarehouse}`)}</span>
                                <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-44 p-0" align="start">
                              <div className="p-1.5 border-b sticky top-0 bg-popover">
                                <div className="relative"><Search className="w-3 h-3 text-muted-foreground absolute left-1.5 top-1/2 -translate-y-1/2" /><Input placeholder="Search warehouse..." value={groupNonRetDlg.whComboSearch} onChange={e => setGroupNonRetDlg(s => ({ ...s, whComboSearch: e.target.value }))} className="h-7 text-xs pl-6" /></div>
                              </div>
                              <div className="max-h-40 overflow-y-auto">
                                <button onClick={() => { setGroupNonRetDlg(s => ({ ...s, filterWarehouse: '', availPage: 1, whComboOpen: false })); }} className={`w-full text-left px-2 py-1.5 text-xs hover:bg-rose-50 dark:hover:bg-rose-500/10 ${groupNonRetDlg.filterWarehouse === '' ? 'bg-rose-50 dark:bg-rose-500/10 font-medium text-rose-700 dark:text-rose-400' : ''}`}>All Warehouses</button>
                                {warehouses.filter(w => { const s = groupNonRetDlg.whComboSearch.toLowerCase(); return !s || w.name.toLowerCase().includes(s) || (w.code || '').toLowerCase().includes(s) }).map(w => (
                                  <button key={w.id} onClick={() => { setGroupNonRetDlg(s => ({ ...s, filterWarehouse: w.id, availPage: 1, whComboOpen: false })); }} className={`w-full text-left px-2 py-1.5 text-xs hover:bg-rose-50 dark:hover:bg-rose-500/10 ${groupNonRetDlg.filterWarehouse === w.id ? 'bg-rose-50 dark:bg-rose-500/10 font-medium text-rose-700 dark:text-rose-400' : ''}`}>{w.name} <span className="text-[9px] text-muted-foreground font-mono">{w.code}</span></button>
                                ))}
                                {warehouses.filter(w => { const s = groupNonRetDlg.whComboSearch.toLowerCase(); return !s || w.name.toLowerCase().includes(s) || (w.code || '').toLowerCase().includes(s) }).length === 0 && <div className="px-2 py-2 text-[11px] text-muted-foreground text-center">No warehouse matches.</div>}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </FilterField>
                        <FilterField label="Category" width="w-40">
                          <PaginatedCombobox
                            items={categories.map(c => ({ value: String(c.id), label: c.name }))}
                            value={groupNonRetDlg.filterCategory === '' ? '_all' : String(groupNonRetDlg.filterCategory)}
                            onChange={v => setGroupNonRetDlg(s => ({ ...s, filterCategory: v === '_all' ? '' : Number(v), availPage: 1 }))}
                            allLabel="All Categories"
                            placeholder="All Categories"
                          />
                        </FilterField>
                        <FilterField label="Condition" width="w-40">
                          <PaginatedCombobox
                            items={conditions.map(c => ({ value: String(c.id), label: c.name }))}
                            value={groupNonRetDlg.filterCondition === '' ? '_all' : String(groupNonRetDlg.filterCondition)}
                            onChange={v => setGroupNonRetDlg(s => ({ ...s, filterCondition: v === '_all' ? '' : Number(v), availPage: 1 }))}
                            allLabel="All Conditions"
                            placeholder="All Conditions"
                          />
                        </FilterField>
                        <FilterField label="Person / Supplier" width="w-44">
                          <Input value={groupNonRetDlg.filterPerson} onChange={e => setGroupNonRetDlg(s => ({ ...s, filterPerson: e.target.value, availPage: 1 }))} placeholder="Name contains..." className="h-8 text-xs" />
                        </FilterField>
                        <FilterField label="Stock-Out From" width="w-40">
                          <Input type="date" value={groupNonRetDlg.filterDateFrom} onChange={e => setGroupNonRetDlg(s => ({ ...s, filterDateFrom: e.target.value, availPage: 1 }))} className="h-8 text-xs" />
                        </FilterField>
                        <FilterField label="Stock-Out To" width="w-40">
                          <Input type="date" value={groupNonRetDlg.filterDateTo} onChange={e => setGroupNonRetDlg(s => ({ ...s, filterDateTo: e.target.value, availPage: 1 }))} className="h-8 text-xs" />
                        </FilterField>
                        <FilterField label="Progress" width="w-40">
                          <Select value={groupNonRetDlg.filterProgress || '_all'} onValueChange={v => setGroupNonRetDlg(s => ({ ...s, filterProgress: v === '_all' ? '' : v as 'none' | 'partial' | 'full', availPage: 1 }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                            <SelectContent><SelectItem value="_all">All</SelectItem><SelectItem value="none">Not started</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="full">Fully resolved</SelectItem></SelectContent>
                          </Select>
                        </FilterField>
                        <FilterField label="Flagged Status" width="w-40">
                          <Select value={groupNonRetDlg.filterFlagged || '_all'} onValueChange={v => setGroupNonRetDlg(s => ({ ...s, filterFlagged: v === '_all' ? '' : v as 'flagged' | 'not_flagged', availPage: 1 }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                            <SelectContent><SelectItem value="_all">All (both tabs)</SelectItem><SelectItem value="flagged">Should be returned</SelectItem><SelectItem value="not_flagged">Other stock-outs</SelectItem></SelectContent>
                          </Select>
                        </FilterField>
                      </FilterPanel>
                    )
                  })()}
                  <div className="max-h-56 overflow-y-auto rounded-md border bg-background">
                    {(() => {
                      const q = groupNonRetDlg.itemSearch.toLowerCase().trim()
                      const personQ = groupNonRetDlg.filterPerson.toLowerCase().trim()
                      const addedIds = new Set(groupNonRetDlg.items.map(x => x.item.id))
                      const flaggedSet = new Set(groupNonRetDlg.availableFlaggedIds)
                      const avail = groupNonRetDlg.availableItems
                        .filter(it => !addedIds.has(it.id))
                        .filter(it => !q || (it.product?.name || '').toLowerCase().includes(q) || (it.product?.sku || '').toLowerCase().includes(q) || (it.recorder?.personName || '').toLowerCase().includes(q) || (it.recorder?.recorderCode || '').toLowerCase().includes(q))
                        .filter(it => groupNonRetDlg.filterWarehouse === '' || it.warehouseId === groupNonRetDlg.filterWarehouse)
                        .filter(it => groupNonRetDlg.filterCategory === '' || it.product?.categoryId === groupNonRetDlg.filterCategory)
                        .filter(it => groupNonRetDlg.filterCondition === '' || it.conditionId === groupNonRetDlg.filterCondition)
                        .filter(it => !personQ || (it.recorder?.personName || '').toLowerCase().includes(personQ))
                        .filter(it => !groupNonRetDlg.filterDateFrom || new Date(it.createdAt || it.recorder?.createdAt || '') >= new Date(groupNonRetDlg.filterDateFrom + 'T00:00:00'))
                        .filter(it => !groupNonRetDlg.filterDateTo || new Date(it.createdAt || it.recorder?.createdAt || '') <= new Date(groupNonRetDlg.filterDateTo + 'T23:59:59'))
                        .filter(it => {
                          if (!groupNonRetDlg.filterProgress) return true
                          if (groupNonRetDlg.filterProgress === 'none') return it.returnedQty <= 0 && it.nonReturnableQty <= 0
                          if (groupNonRetDlg.filterProgress === 'partial') return (it.returnedQty > 0 || it.nonReturnableQty > 0) && it.remainingQty > 0
                          if (groupNonRetDlg.filterProgress === 'full') return it.remainingQty <= 0
                          return true
                        })
                        .filter(it => {
                          if (!groupNonRetDlg.filterFlagged) return true
                          const isFlagged = flaggedSet.has(it.id)
                          return groupNonRetDlg.filterFlagged === 'flagged' ? isFlagged : !isFlagged
                        })
                      if (groupNonRetDlg.loadingAvailable) return <div className="text-center text-[11px] text-muted-foreground py-3">Loading items...</div>
                      if (avail.length === 0) return <div className="text-center text-[11px] text-muted-foreground py-3">{addedIds.size === groupNonRetDlg.availableItems.length ? 'All items added.' : 'No items match your filters.'}</div>
                      const perPage = 8
                      const totalPages = Math.ceil(avail.length / perPage) || 1
                      const safePage = Math.min(groupNonRetDlg.availPage, totalPages)
                      const paged = avail.slice((safePage - 1) * perPage, safePage * perPage)
                      return (<>
                        <div className="divide-y">
                          {paged.map(it => { const wh = warehouses.find(w => w.id === it.warehouseId); const isFlagged = flaggedSet.has(it.id); const gcond = conditions.find(c => c.id === it.conditionId)
                            return (<div key={it.id} className="flex items-center justify-between gap-2 p-1.5 hover:bg-rose-50/50 dark:hover:bg-rose-500/5">
                              <div className="min-w-0"><div className="text-[11px] font-medium truncate flex items-center gap-1">{it.product?.name || `#${it.productId}`} <span className="text-[9px] text-muted-foreground font-mono">{it.product?.sku}</span>{gcond && <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border-0 text-[8px] h-3.5 px-1">{gcond.name}</Badge>}{isFlagged && <span className="text-[8px] px-1 py-px rounded bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 font-medium">flagged</span>}</div><div className="text-[9px] text-muted-foreground">{wh?.name || `#${it.warehouseId}`} · {it.recorder?.personName || '—'} · {it.recorder?.recorderCode} · Remaining: <span className="font-mono font-medium text-violet-600">{it.remainingQty}</span></div></div>
                              <Button size="sm" variant="outline" onClick={() => addNonRetItemToGroup(it)} className="h-6 text-[10px] px-2 shrink-0 border-rose-300 text-rose-700 dark:border-rose-500/40 dark:text-rose-400"><Plus className="w-2.5 h-2.5 mr-0.5" />Add</Button>
                            </div>)
                          })}
                        </div>
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between gap-1 p-1 border-t bg-muted/30">
                            <span className="text-[10px] text-muted-foreground px-1">{safePage}/{totalPages} · {avail.length} available</span>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setGroupNonRetDlg(s => ({ ...s, availPage: safePage - 1 }))} className="h-6 w-6 p-0"><ChevronLeft className="w-3 h-3" /></Button>
                              <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setGroupNonRetDlg(s => ({ ...s, availPage: safePage + 1 }))} className="h-6 w-6 p-0"><ChevronRight className="w-3 h-3" /></Button>
                            </div>
                          </div>
                        )}
                      </>)
                    })()}
                  </div>
                </div>
              )}

              {/* ── Items table (per-row qty + reason dropdown + remove/switch) ── */}
              <div className="bg-muted/30 rounded-lg p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Items to Mark ({groupNonRetDlg.items.length})</span>
                  {groupNonRetDlg.mode === 'prefilled' && <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setGroupNonRetDlg(s => ({ ...s, items: s.items.map(x => ({ ...x, selected: true })) }))} className="h-5 text-[10px] text-muted-foreground px-1.5">Select all</Button>
                    <Button size="sm" variant="ghost" onClick={() => setGroupNonRetDlg(s => ({ ...s, items: s.items.map(x => ({ ...x, selected: false })) }))} className="h-5 text-[10px] text-muted-foreground px-1.5">None</Button>
                  </div>}
                </div>
                {groupNonRetDlg.items.length === 0 ? <div className="text-center text-sm text-muted-foreground py-4">{groupNonRetDlg.mode === 'new' ? 'No items added yet — search and add items above.' : 'No items in this group.'}</div> : (
                  (() => {
                    const perPage = 6
                    const totalPages = Math.ceil(groupNonRetDlg.items.length / perPage) || 1
                    const safePage = Math.min(groupNonRetDlg.itemsPage, totalPages)
                    const paged = groupNonRetDlg.items.slice((safePage - 1) * perPage, safePage * perPage)
                    return (<>
                  <div className="space-y-1.5">
                    {paged.map(entry => {
                      const it = entry.item; const wh = warehouses.find(w => w.id === it.warehouseId)
                      return (<div key={it.id} className={`rounded-md border p-2 ${entry.selected ? 'bg-rose-50/40 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/30' : 'bg-muted/20'}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {groupNonRetDlg.mode === 'prefilled' ? (
                              <Switch checked={entry.selected} onCheckedChange={v => setGroupNonRetDlg(s => ({ ...s, items: s.items.map(x => x.item.id === it.id ? { ...x, selected: v } : x) }))} className="scale-75" />
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => removeNonRetItemFromGroup(it.id)} className="h-5 w-5 p-0 text-red-500 shrink-0" title="Remove"><X className="w-3 h-3" /></Button>
                            )}
                            <div className="min-w-0"><div className="text-[11px] font-medium truncate">{it.product?.name || `#${it.productId}`}</div><div className="text-[9px] text-muted-foreground font-mono">{it.product?.sku} · {wh?.name || `#${it.warehouseId}`}{groupNonRetDlg.mode === 'new' && <span> · {it.recorder?.personName || '—'}</span>}</div></div>
                          </div>
                          <div className="text-[10px] text-muted-foreground shrink-0 text-right">
                            <div>Out: <span className="font-mono font-medium text-foreground">{it.quantity}</span></div>
                            <div>Remaining: <span className="font-mono font-medium text-violet-600">{it.remainingQty}</span></div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 pl-6">
                          <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Qty:</Label>
                          <Input type="number" min={1} max={it.remainingQty} value={entry.qty} onChange={e => setGroupNonRetDlg(s => ({ ...s, items: s.items.map(x => x.item.id === it.id ? { ...x, qty: parseInt(e.target.value) || 0 } : x) }))} className="h-6 text-[11px] w-16" />
                          <Button size="sm" variant="outline" onClick={() => setGroupNonRetDlg(s => ({ ...s, items: s.items.map(x => x.item.id === it.id ? { ...x, qty: it.remainingQty } : x) }))} className="h-6 text-[10px] px-1.5">Full</Button>
                          <Label className="text-[10px] text-muted-foreground whitespace-nowrap ml-1">Reason <span className="text-rose-500">*</span>:</Label>
                          <div className="flex-1 min-w-[140px]">
                            <PaginatedCombobox
                              items={NON_RETURNABLE_REASONS.map(r => ({ value: r.key, label: r.label }))}
                              value={entry.reason || ''}
                              onChange={v => setGroupNonRetDlg(s => ({ ...s, items: s.items.map(x => x.item.id === it.id ? { ...x, reason: v } : x) }))}
                              placeholder="Choose reason..."
                              perPage={12}
                              compact
                              contentClassName="w-56"
                            />
                          </div>
                        </div>
                        {entry.reason === 'other' && (
                          <div className="flex items-center gap-1.5 pl-6 mt-1">
                            <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Detail <span className="text-rose-500">*</span>:</Label>
                            <Input value={entry.reasonDetail} onChange={e => setGroupNonRetDlg(s => ({ ...s, items: s.items.map(x => x.item.id === it.id ? { ...x, reasonDetail: e.target.value } : x) }))} placeholder="Specify the reason..." className="h-6 text-[11px] flex-1" />
                          </div>
                        )}
                      </div>)
                    })}
                  </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between gap-1 pt-1">
                          <span className="text-[10px] text-muted-foreground">Page {safePage} of {totalPages} · {groupNonRetDlg.items.length} item(s)</span>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setGroupNonRetDlg(s => ({ ...s, itemsPage: safePage - 1 }))} className="h-6 w-6 p-0"><ChevronLeft className="w-3 h-3" /></Button>
                            <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setGroupNonRetDlg(s => ({ ...s, itemsPage: safePage + 1 }))} className="h-6 w-6 p-0"><ChevronRight className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      )}
                    </>)
                    })()
                  )}
              </div>

              {/* ── Notes ── */}
              <div className="bg-muted/30 rounded-lg p-2 space-y-1.5">
                <SectionHeader icon={FileText}>Group Notes (applies to all items in this record)</SectionHeader>
                <Textarea value={groupNonRetDlg.notes} onChange={e => setGroupNonRetDlg(s => ({ ...s, notes: e.target.value }))} placeholder="Optional notes for this group non-returnable decision..." className="text-sm rounded-md min-h-[50px]" />
              </div>

              {/* ── Summary bar ── */}
              <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-md p-2 text-[11px] text-rose-700 dark:text-rose-400">
                {groupNonRetDlg.items.filter(i => (groupNonRetDlg.mode === 'new' || i.selected) && i.qty > 0 && i.reason).length} item(s) ready · Total qty to mark: {groupNonRetDlg.items.filter(i => (groupNonRetDlg.mode === 'new' || i.selected) && i.qty > 0 && i.reason).reduce((s, i) => s + i.qty, 0)}{groupNonRetDlg.items.some(i => (groupNonRetDlg.mode === 'new' || i.selected) && i.qty > 0 && !i.reason) && <span className="ml-2 text-amber-600">· some items missing a reason</span>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setGroupNonRetDlg(s => ({ ...s, open: false }))} className="text-muted-foreground" disabled={groupNonRetDlg.submitting}>{t(locale, 'cancel')}</Button>
              <Button onClick={submitGroupNonReturnable} disabled={groupNonRetDlg.submitting || groupNonRetDlg.items.filter(i => (groupNonRetDlg.mode === 'new' || i.selected) && i.qty > 0 && i.reason).length === 0 || (groupNonRetDlg.mode === 'new' && !groupNonRetDlg.personName.trim())} className="bg-gradient-to-r from-rose-600 to-red-600 text-white">
                {groupNonRetDlg.submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Ban className="w-4 h-4 mr-1.5" />}Create Non-Returnable Record
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── ATTACHMENT UPLOAD DIALOG ─── */}
        <Dialog open={attUpload.open} onOpenChange={o => setAttUpload(s => ({ ...s, open: o }))}>
          <DialogContent className="max-w-lg w-[95vw]">
            <DialogHeader><DialogTitle className="text-base font-bold flex items-center gap-1.5"><Upload className="w-4 h-4 text-violet-500" />Upload Attachment</DialogTitle></DialogHeader>
            <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Files *</Label>
                <input type="file" multiple onChange={e => setAttUpload(s => ({ ...s, files: Array.from(e.target.files || []) }))} className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-violet-100 file:text-violet-700 file:text-xs file:font-medium hover:file:bg-violet-200 dark:file:bg-violet-500/20 dark:file:text-violet-300" />
                <p className="text-[10px] text-muted-foreground">Select one or more files — they'll be zipped into a single archive. Images will be previewable.</p>
                {attUpload.files.length > 0 && (
                  <div className="space-y-1 mt-1">
                    <div className="text-[10px] text-muted-foreground">{attUpload.files.length} file(s), total size {(attUpload.files.reduce((s, f) => s + f.size, 0) / 1024).toFixed(1)} KB</div>
                    {attUpload.files.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-muted/30 rounded-md px-2 py-1 text-[11px]">
                        <span className="flex-1 truncate">{f.name}</span>
                        <span className="text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</span>
                        {f.type.startsWith('image/') && <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-0 text-[9px]"><ImageIcon className="w-2.5 h-2.5 mr-0.5 inline" />IMG</Badge>}
                        <Button size="sm" variant="ghost" onClick={() => setAttUpload(s => ({ ...s, files: s.files.filter((_, j) => j !== i) }))} className="text-red-500 h-5 w-5 p-0"><X className="w-3 h-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1"><Label className="text-xs font-medium">Title</Label><Input value={attUpload.title} onChange={e => setAttUpload(s => ({ ...s, title: e.target.value }))} placeholder="Optional title..." className="h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs font-medium">Description</Label><Textarea value={attUpload.description} onChange={e => setAttUpload(s => ({ ...s, description: e.target.value }))} placeholder="Optional description..." className="h-8 text-sm min-h-[50px]" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs font-medium">Entity Type</Label><Select value={attUpload.entityType} onValueChange={v => setAttUpload(s => ({ ...s, entityType: v }))}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{ATTACHMENT_ENTITY_TYPES.map(et => <SelectItem key={et.key} value={et.key}>{et.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs font-medium">Entity ID {attUpload.entityType === 'standalone' && '(n/a)'}</Label><Input value={attUpload.entityId} onChange={e => setAttUpload(s => ({ ...s, entityId: e.target.value }))} placeholder="Record ID..." disabled={attUpload.entityType === 'standalone'} className="h-8 text-sm" /></div>
              </div>
              {role === 'super_admin' && (
                <div className="space-y-1"><Label className="text-xs font-medium">Owning Enterprise <span className="text-rose-500">*</span></Label>
                  <PaginatedCombobox items={enterprises.map(e => ({ value: String(e.id), label: e.name, sublabel: e.code }))} value={attUpload.enterpriseId} onChange={v => setAttUpload(s => ({ ...s, enterpriseId: v }))} placeholder="Select enterprise (required for super admin)..." perPage={10} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs font-medium">Branch (scope)</Label><PaginatedCombobox items={branches.filter(br => !attUpload.enterpriseId || br.enterpriseId === parseInt(attUpload.enterpriseId)).map(br => ({ value: String(br.id), label: br.name, sublabel: br.code }))} value={attUpload.branchId || '_all'} onChange={v => setAttUpload(s => ({ ...s, branchId: v === '_all' ? '' : v }))} allLabel="Enterprise-wide" placeholder="Enterprise-wide" /></div>
                <div className="space-y-1"><Label className="text-xs font-medium">Warehouse (scope)</Label><PaginatedCombobox items={warehouses.filter(w => !attUpload.enterpriseId || w.enterpriseId === parseInt(attUpload.enterpriseId)).map(w => ({ value: String(w.id), label: w.name, sublabel: w.code }))} value={attUpload.warehouseId || '_all'} onChange={v => setAttUpload(s => ({ ...s, warehouseId: v === '_all' ? '' : v }))} allLabel="Branch-wide" placeholder="Branch-wide" /></div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between"><Label className="text-xs font-semibold flex items-center gap-1"><Paperclip className="w-3 h-3" />Custom Metadata</Label><Button size="sm" variant="ghost" onClick={() => setAttUpload(s => ({ ...s, metaFields: [...s.metaFields, { key: '', value: '', description: '' }] }))} className="h-6 text-xs text-violet-600"><Plus className="w-3 h-3 mr-0.5" />Add Field</Button></div>
                <p className="text-[10px] text-muted-foreground">Add unlimited key-value-description fields to describe this attachment. These power the advanced filters.</p>
                {attUpload.metaFields.length === 0 && <div className="text-[10px] text-muted-foreground italic">No custom fields. Click "Add Field" to add one.</div>}
                {attUpload.metaFields.map((m, i) => (
                  <div key={i} className="space-y-1 bg-card rounded-md p-1.5 border">
                    <div className="flex gap-1">
                      <Input value={m.key} onChange={e => setAttUpload(s => ({ ...s, metaFields: s.metaFields.map((x, j) => j === i ? { ...x, key: e.target.value } : x) }))} placeholder="Key (e.g. batch)" className="h-7 text-xs flex-1" />
                      <Input value={m.value} onChange={e => setAttUpload(s => ({ ...s, metaFields: s.metaFields.map((x, j) => j === i ? { ...x, value: e.target.value } : x) }))} placeholder="Value (e.g. B-001)" className="h-7 text-xs flex-1" />
                      <Button size="sm" variant="ghost" onClick={() => setAttUpload(s => ({ ...s, metaFields: s.metaFields.filter((_, j) => j !== i) }))} className="text-red-500 h-7 w-7 p-0"><X className="w-3 h-3" /></Button>
                    </div>
                    <Input value={m.description} onChange={e => setAttUpload(s => ({ ...s, metaFields: s.metaFields.map((x, j) => j === i ? { ...x, description: e.target.value } : x) }))} placeholder="Description (optional)..." className="h-7 text-xs" />
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAttUpload(s => ({ ...s, open: false }))} disabled={attUpload.submitting} className="text-muted-foreground">Cancel</Button>
              <Button disabled={attUpload.submitting || attUpload.files.length === 0 || (role === 'super_admin' && !attUpload.enterpriseId)} onClick={async () => {
                if (attUpload.files.length === 0) { toast({ title: 'Select at least one file', variant: 'destructive' }); return }
                if (role === 'super_admin' && !attUpload.enterpriseId) { toast({ title: 'Select an owning enterprise', variant: 'destructive' }); return }
                setAttUpload(s => ({ ...s, submitting: true }))
                try {
                  const fd = new FormData()
                  for (const f of attUpload.files) fd.append('files', f)
                  if (attUpload.title) fd.append('title', attUpload.title)
                  if (attUpload.description) fd.append('description', attUpload.description)
                  fd.append('entityType', attUpload.entityType)
                  if (attUpload.entityId && attUpload.entityType !== 'standalone') fd.append('entityId', attUpload.entityId)
                  if (attUpload.branchId) fd.append('branchId', attUpload.branchId)
                  if (attUpload.warehouseId) fd.append('warehouseId', attUpload.warehouseId)
                  const cleanMeta = attUpload.metaFields.filter(m => m.key.trim())
                  if (cleanMeta.length > 0) fd.append('metaFields', JSON.stringify(cleanMeta))
                  // For super_admin, send the picked enterpriseId; for everyone else, the server derives it from ctx
                  if (role === 'super_admin' && attUpload.enterpriseId) fd.append('enterpriseId', attUpload.enterpriseId)
                  const res = await fetch(`${BASE}/api/attachments`, { method: 'POST', headers: useAuthStore.getState().getAuthHeaders(), body: fd })
                  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `Upload failed (${res.status})`) }
                  toast({ title: `Uploaded: ${attUpload.files.length} file(s) zipped` })
                  setAttUpload(s => ({ ...s, open: false, submitting: false, files: [], title: '', description: '', entityType: 'standalone', entityId: '', branchId: '', warehouseId: '', enterpriseId: '', metaFields: [] }))
                  await loadData()
                } catch (e: any) { toast({ title: e.message, variant: 'destructive' }); setAttUpload(s => ({ ...s, submitting: false })) }
              }} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white">{attUpload.submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Upload className="w-4 h-4 mr-1.5" />}Upload</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── ATTACHMENT EDIT DIALOG ─── */}
        <Dialog open={attEdit.open} onOpenChange={o => setAttEdit(s => ({ ...s, open: o }))}>
          <DialogContent className="max-w-lg w-[95vw]">
            <DialogHeader><DialogTitle className="text-base font-bold flex items-center gap-1.5"><Pencil className="w-4 h-4 text-violet-500" />Edit Attachment</DialogTitle></DialogHeader>
            <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
              {attEdit.attachment && <div className="text-[10px] text-muted-foreground bg-muted/30 rounded-md p-1.5 flex items-center gap-1"><FileText className="w-3 h-3" />{attEdit.attachment.fileName} — {(attEdit.attachment.originalSize / 1024).toFixed(1)} KB</div>}
              <div className="space-y-1"><Label className="text-xs font-medium">Title</Label><Input value={attEdit.title} onChange={e => setAttEdit(s => ({ ...s, title: e.target.value }))} className="h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs font-medium">Description</Label><Textarea value={attEdit.description} onChange={e => setAttEdit(s => ({ ...s, description: e.target.value }))} className="h-8 text-sm min-h-[50px]" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs font-medium">Entity Type</Label><Select value={attEdit.entityType} onValueChange={v => setAttEdit(s => ({ ...s, entityType: v }))}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{ATTACHMENT_ENTITY_TYPES.map(et => <SelectItem key={et.key} value={et.key}>{et.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs font-medium">Entity ID {attEdit.entityType === 'standalone' && '(n/a)'}</Label><Input value={attEdit.entityId} onChange={e => setAttEdit(s => ({ ...s, entityId: e.target.value }))} disabled={attEdit.entityType === 'standalone'} className="h-8 text-sm" /></div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between"><Label className="text-xs font-semibold flex items-center gap-1"><Paperclip className="w-3 h-3" />Custom Metadata</Label><Button size="sm" variant="ghost" onClick={() => setAttEdit(s => ({ ...s, metaFields: [...s.metaFields, { key: '', value: '', description: '' }] }))} className="h-6 text-xs text-violet-600"><Plus className="w-3 h-3 mr-0.5" />Add Field</Button></div>
                {attEdit.metaFields.length === 0 && <div className="text-[10px] text-muted-foreground italic">No custom fields.</div>}
                {attEdit.metaFields.map((m, i) => (
                  <div key={i} className="space-y-1 bg-card rounded-md p-1.5 border">
                    <div className="flex gap-1">
                      <Input value={m.key} onChange={e => setAttEdit(s => ({ ...s, metaFields: s.metaFields.map((x, j) => j === i ? { ...x, key: e.target.value } : x) }))} placeholder="Key" className="h-7 text-xs flex-1" />
                      <Input value={m.value} onChange={e => setAttEdit(s => ({ ...s, metaFields: s.metaFields.map((x, j) => j === i ? { ...x, value: e.target.value } : x) }))} placeholder="Value" className="h-7 text-xs flex-1" />
                      <Button size="sm" variant="ghost" onClick={() => setAttEdit(s => ({ ...s, metaFields: s.metaFields.filter((_, j) => j !== i) }))} className="text-red-500 h-7 w-7 p-0"><X className="w-3 h-3" /></Button>
                    </div>
                    <Input value={m.description} onChange={e => setAttEdit(s => ({ ...s, metaFields: s.metaFields.map((x, j) => j === i ? { ...x, description: e.target.value } : x) }))} placeholder="Description (optional)..." className="h-7 text-xs" />
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAttEdit(s => ({ ...s, open: false }))} disabled={attEdit.submitting} className="text-muted-foreground">Cancel</Button>
              <Button disabled={attEdit.submitting} onClick={async () => {
                if (!attEdit.attachment) return
                setAttEdit(s => ({ ...s, submitting: true }))
                try {
                  await apiFetch(`/attachments/${attEdit.attachment.id}`, { method: 'PUT', body: JSON.stringify({
                    title: attEdit.title, description: attEdit.description,
                    entityType: attEdit.entityType,
                    entityId: attEdit.entityType === 'standalone' ? null : (attEdit.entityId ? parseInt(attEdit.entityId) : null),
                    metaFields: attEdit.metaFields.filter(m => m.key.trim()),
                  }) })
                  toast({ title: 'Attachment updated' })
                  setAttEdit(s => ({ ...s, open: false, submitting: false }))
                  await loadData()
                } catch (e: any) { toast({ title: e.message, variant: 'destructive' }); setAttEdit(s => ({ ...s, submitting: false })) }
              }} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white">{attEdit.submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── ATTACHMENT IMAGE PREVIEW DIALOG ─── */}
        <Dialog open={attPreview.open} onOpenChange={o => setAttPreview(s => ({ ...s, open: o }))}>
          <DialogContent className="max-w-2xl w-[95vw]">
            <DialogHeader><DialogTitle className="text-base font-bold flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-violet-500" />{attPreview.attachment?.title || attPreview.attachment?.fileName || 'Preview'}</DialogTitle></DialogHeader>
            {attPreview.attachment && (() => {
              const a = attPreview.attachment
              const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/i
              let entries: AttachmentFileEntry[] = []
              try { const v = JSON.parse(a.fileListJson || '[]'); if (Array.isArray(v)) entries = v } catch {}
              const imageEntries = a.isMultiFile ? entries.map((e, i) => ({ name: e.name, size: e.size, mimeType: e.mimeType, idx: i })).filter(e => IMAGE_EXT.test(e.name)) : []
              const currentEntry = a.isMultiFile ? entries[attPreview.fileIndex] : null
              const entryName = a.isMultiFile ? (currentEntry?.name || `Entry #${attPreview.fileIndex + 1}`) : a.fileName
              const entryMime = a.isMultiFile ? (currentEntry?.mimeType || 'unknown') : a.mimeType
              const entrySize = a.isMultiFile ? (currentEntry?.size || 0) : a.originalSize
              const isCurrentImage = a.isImage || (a.isMultiFile && IMAGE_EXT.test(entryName))
              const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`
              return (
                <div className="space-y-2">
                  {/* Thumbnail strip for multi-file image entries */}
                  {a.isMultiFile && imageEntries.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {imageEntries.map(e => (
                        <button key={e.idx} onClick={() => setAttPreview(s => ({ ...s, fileIndex: e.idx }))} title={e.name} className={`flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition ${attPreview.fileIndex === e.idx ? 'border-violet-500' : 'border-transparent hover:border-muted-foreground/30'}`}>
                          <img src={`${BASE}/api/attachments/${a.id}/download?inline=1&fileIndex=${e.idx}`} alt={e.name} className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Main preview area */}
                  <div className="bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center max-h-[60vh]">
                    {isCurrentImage ? (
                      <img src={`${BASE}/api/attachments/${a.id}/download?inline=1&fileIndex=${attPreview.fileIndex}`} alt={entryName} className="max-w-full max-h-[60vh] object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
                        <FileIcon className="w-10 h-10 text-muted-foreground/50" />
                        <span>Download to view this file.</span>
                      </div>
                    )}
                  </div>
                  {/* File info — entry name from fileListJson when multi-file */}
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                    <span className="truncate max-w-[300px]" title={entryName}>{entryName}</span>
                    <span>•</span>
                    <span>{entryMime}</span>
                    <span>•</span>
                    <span>{fmtSize(entrySize)}</span>
                  </div>
                  {/* Meta fields badges */}
                  {(a.metaFields || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(a.metaFields || []).map(m => <Badge key={m.id} className="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 border-0 text-[10px] font-mono"><span className="font-semibold">{m.key}</span>: {m.value}</Badge>)}
                    </div>
                  )}
                </div>
              )
            })()}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAttPreview(s => ({ ...s, open: false }))}>Close</Button>
              {attPreview.attachment && <Button onClick={() => { const a = attPreview.attachment!; const url = `${BASE}/api/attachments/${a.id}/download`; fetch(url, { headers: useAuthStore.getState().getAuthHeaders() }).then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const link = document.createElement('a'); link.href = u; link.download = a.fileName; link.click(); URL.revokeObjectURL(u) }) }} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white"><Download className="w-4 h-4 mr-1.5" />Download</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── ATTACHMENT LINK DIALOG (attach files to ANY existing record/item) ─── */}
        {/* Lets the user attach multi-file + metadata to any already-created record,
            including stock_in_item and order_item which are created inline (no dialog). */}
        <Dialog open={attLink.open} onOpenChange={o => setAttLink(s => ({ ...s, open: o }))}>
          <DialogContent className="max-w-lg w-[95vw]">
            <DialogHeader><DialogTitle className="text-base font-bold flex items-center gap-1.5"><Paperclip className="w-4 h-4 text-violet-500" />Attach to {attLink.entityType.replace(/_/g, ' ')} #{attLink.entityId}</DialogTitle>
              <DialogDescription className="text-xs">{attLink.entityLabel}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
              <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-md p-2 text-[11px] text-violet-700 dark:text-violet-400 flex items-start gap-1.5">
                <Paperclip className="w-3 h-3 mt-0.5 shrink-0" />
                <span>Files will be zipped into a single archive and linked to <span className="font-mono font-semibold">{attLink.entityType}#{attLink.entityId}</span>. You can attach as many files as you want, and add unlimited metadata fields.</span>
              </div>
              <AttachmentPicker
                files={attLink.files}
                onFilesChange={f => setAttLink(s => ({ ...s, files: f }))}
                metaFields={attLink.metaFields}
                onMetaChange={m => setAttLink(s => ({ ...s, metaFields: m }))}
                title={attLink.title}
                onTitleChange={v => setAttLink(s => ({ ...s, title: v }))}
                description={attLink.description}
                onDescChange={v => setAttLink(s => ({ ...s, description: v }))}
                accent="violet"
                hint="Pick one or more files — they'll be zipped and linked to this record."
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAttLink(s => ({ ...s, open: false }))} disabled={attLink.submitting} className="text-muted-foreground">Cancel</Button>
              <Button disabled={attLink.submitting || attLink.files.length === 0} onClick={async () => {
                if (attLink.files.length === 0) { toast({ title: 'Select at least one file', variant: 'destructive' }); return }
                setAttLink(s => ({ ...s, submitting: true }))
                try {
                  await uploadAttachmentsFor(attLink.entityType, attLink.entityId, attLink.warehouseId, attLink.files, { metaFields: attLink.metaFields, title: attLink.title, description: attLink.description })
                  setAttLink(s => ({ ...s, open: false, submitting: false, files: [], title: '', description: '', metaFields: [] }))
                  await loadData()
                } catch (e: any) { toast({ title: e.message, variant: 'destructive' }); setAttLink(s => ({ ...s, submitting: false })) }
              }} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white">{attLink.submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Upload className="w-4 h-4 mr-1.5" />}Attach</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── AI ASSISTANT WIDGET (Task 1: floating chat) ─── */}
        {!aiChat.open ? (
          <button onClick={() => setAiChat({ ...aiChat, open: true })} className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/30 flex items-center justify-center hover:scale-105 transition" title="AI Inventory Assistant">
            <MessageSquare className="w-6 h-6" />
          </button>
        ) : (
          <div className="fixed bottom-6 right-6 z-50 w-[90vw] max-w-sm h-96 bg-card border rounded-2xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-t-2xl">
              <div className="flex items-center gap-2"><Sparkles className="w-4 h-4" /><span className="font-semibold text-sm">AI Inventory Assistant</span></div>
              <button onClick={() => setAiChat({ ...aiChat, open: false })} className="text-white/80 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/20">
              {aiChat.messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-lg text-xs ${m.role === 'user' ? 'bg-violet-600 text-white rounded-br-none' : 'bg-muted text-foreground rounded-bl-none'}`}>{m.content}</div>
                </div>
              ))}
              {aiChat.loading && <div className="flex justify-start"><div className="bg-muted px-3 py-2 rounded-lg text-xs flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />Thinking...</div></div>}
            </div>
            <div className="flex gap-2 p-3 border-t bg-card rounded-b-2xl">
              <Input value={aiChat.input} onChange={e => setAiChat({ ...aiChat, input: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage() } }} placeholder="Ask about inventory..." className="h-9 text-sm" />
              <Button size="sm" disabled={aiChat.loading || !aiChat.input.trim()} onClick={sendAiMessage} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white h-9 px-3">{aiChat.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
