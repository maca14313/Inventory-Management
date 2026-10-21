import { NextResponse } from 'next/server'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'
import { orm } from '@/lib/orm'

/** POST /api/branches/[id]/reset-admin — reset the branch admin's password.
 *  Requires 'branches:reset_admin' permission.
 *  Body: { newPassword? } — if omitted, defaults to 'admin123' with forced reset. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'branches:reset_admin')
    const { id } = await params
    const bid = parseInt(id, 10)
    if (!bid) return NextResponse.json({ error: 'Validation: invalid branch id' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const newPassword = body?.newPassword || 'admin123'
    const forceReset = !body?.newPassword

    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash(newPassword, 10)

    const admin = await orm.user.findFirst({
      where: { branchId: bid, role: 'branch_admin' },
    })
    if (!admin) {
      return NextResponse.json({ error: 'Not found: no branch admin for this branch' }, { status: 404 })
    }

    await orm.user.update({
      where: { id: admin.id },
      data: { passwordHash, mustResetPassword: forceReset },
    })

    await orm.auditLog.create({
      data: {
        userId: ctx.userId,
        enterpriseId: admin.enterpriseId,
        action: 'branch.reset_admin',
        entity: 'User',
        entityId: admin.id,
        details: `Reset password for branch admin ${admin.username} (branch #${bid})`,
      },
    })

    return NextResponse.json({ ok: true, adminUsername: admin.username, forcedReset: forceReset })
  } catch (e) { return handleError(e) }
}
