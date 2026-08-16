import { NextResponse } from 'next/server'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

/** POST /api/enterprises/[id]/reset-admin — reset the enterprise admin's password.
 *  Super_admin only (requires 'enterprises:reset_admin' permission).
 *  Body: { newPassword? } — if omitted, a default 'admin123' is used and
 *  mustResetPassword=true is set so the admin is forced to change it on next login.
 *
 *  This endpoint finds the enterprise_admin user for the given enterprise and
 *  resets their password. If the enterprise has no admin yet, returns 404. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'enterprises:reset_admin')
    const { id } = await params
    const eid = parseInt(id, 10)
    if (!eid) return NextResponse.json({ error: 'Validation: invalid enterprise id' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const newPassword = body?.newPassword || 'admin123'
    const forceReset = !body?.newPassword // if no explicit password, force reset

    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash(newPassword, 10)

    // Find the enterprise admin for this enterprise
    const admin = await prisma.user.findFirst({
      where: { enterpriseId: eid, role: 'enterprise_admin' },
    })
    if (!admin) {
      return NextResponse.json({ error: 'Not found: no enterprise admin for this enterprise' }, { status: 404 })
    }

    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash, mustResetPassword: forceReset },
    })

    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        enterpriseId: eid,
        action: 'enterprise.reset_admin',
        entity: 'User',
        entityId: admin.id,
        details: `Reset password for enterprise admin ${admin.username} (enterprise #${eid})`,
      },
    })

    return NextResponse.json({ ok: true, adminUsername: admin.username, forcedReset: forceReset })
  } catch (e) { return handleError(e) }
}
