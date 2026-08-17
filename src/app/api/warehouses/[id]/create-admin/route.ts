import { NextResponse } from 'next/server'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission, seedDefaultPermissions } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

/** POST /api/warehouses/[id]/create-admin — create a warehouse_admin for the given warehouse.
 *  Requires 'warehouses:manage_admin' permission.
 *  Body: { username, fullName, email?, password? }
 *  If password is omitted, defaults to 'admin123' and mustResetPassword=true. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'warehouses:manage_admin')
    const { id } = await params
    const wid = parseInt(id, 10)
    if (!wid) return NextResponse.json({ error: 'Validation: invalid warehouse id' }, { status: 400 })

    const body = await req.json()
    const { username, fullName, email, password } = body || {}
    if (!username || !fullName) {
      return NextResponse.json({ error: 'Validation: username and fullName are required' }, { status: 400 })
    }

    // Check warehouse exists + tenant scope
    const warehouse = await prisma.warehouse.findUnique({ where: { id: wid } })
    if (!warehouse) return NextResponse.json({ error: 'Not found: warehouse' }, { status: 404 })
    if (ctx.role !== 'super_admin') {
      if (ctx.role === 'enterprise_admin' && warehouse.enterpriseId !== ctx.enterpriseId) {
        return NextResponse.json({ error: 'FORBIDDEN: warehouse not in your enterprise' }, { status: 403 })
      }
      if (ctx.role === 'branch_admin' && warehouse.branchId !== ctx.branchId) {
        return NextResponse.json({ error: 'FORBIDDEN: warehouse not in your branch' }, { status: 403 })
      }
    }

    // Check username is unique
    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json({ error: 'Validation: username already taken' }, { status: 400 })
    }

    const bcrypt = await import('bcryptjs')
    const explicitPassword = password || 'admin123'
    const passwordHash = await bcrypt.hash(explicitPassword, 10)
    const forceReset = !password

    const admin = await prisma.user.create({
      data: {
        username,
        fullName,
        email: email || '',
        role: 'warehouse_admin',
        enterpriseId: warehouse.enterpriseId,
        branchId: warehouse.branchId,
        warehouseId: wid,
        isActive: true,
        passwordHash,
        mustResetPassword: forceReset,
      },
    })

    // Seed default permissions for the new warehouse_admin
    await seedDefaultPermissions(admin.id, 'warehouse_admin', ctx.userId || undefined)

    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        enterpriseId: warehouse.enterpriseId,
        action: 'warehouse.create_admin',
        entity: 'User',
        entityId: admin.id,
        details: `Created warehouse admin ${username} for warehouse #${wid}`,
      },
    })

    return NextResponse.json({
      ok: true,
      admin: { id: admin.id, username: admin.username, fullName: admin.fullName, forcedReset: forceReset },
    })
  } catch (e) { return handleError(e) }
}
