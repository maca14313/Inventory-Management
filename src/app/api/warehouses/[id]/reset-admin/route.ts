import { NextResponse } from 'next/server'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

/** POST /api/warehouses/[id]/reset-admin — reset the warehouse admin's password.
 *  Requires 'warehouses:reset_admin' permission.
 *  Body: { newPassword? } — if omitted, defaults to 'admin123' with forced reset. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'warehouses:reset_admin')
    const { id } = await params
    const wid = parseInt(id, 10)
    if (!wid) return NextResponse.json({ error: 'Validation: invalid warehouse id' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const newPassword = body?.newPassword || 'admin123'
    const forceReset = !body?.newPassword

    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash(newPassword, 10)

    const admin = await prisma.user.findFirst({
      where: { warehouseId: wid, role: 'warehouse_admin' },
    })
    if (!admin) {
      return NextResponse.json({ error: 'Not found: no warehouse admin for this warehouse' }, { status: 404 })
    }

    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash, mustResetPassword: forceReset },
    })

    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        enterpriseId: admin.enterpriseId,
        action: 'warehouse.reset_admin',
        entity: 'User',
        entityId: admin.id,
        details: `Reset password for warehouse admin ${admin.username} (warehouse #${wid})`,
      },
    })

    return NextResponse.json({ ok: true, adminUsername: admin.username, forcedReset: forceReset })
  } catch (e) { return handleError(e) }
}
