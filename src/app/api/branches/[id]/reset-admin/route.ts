import { NextResponse } from 'next/server'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

/** POST /api/branches/[id]/reset-admin — reset the branch admin's password.
 *  Requires 'branches:reset_admin' permission.
 *  Body: { newPassword? } — if omitted, a default 'admin123' is used and
 *  mustResetPassword=true is set so the admin is forced to change it on next login.
 *
 *  This endpoint finds the branch_admin user for the given branch and
 *  resets their password. If the branch has no admin yet, returns 404. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'branches:reset_admin')
    const { id } = await params
    const bid = parseInt(id, 10)
    if (!bid) return NextResponse.json({ error: 'Validation: invalid branch id' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const newPassword = body?.newPassword || 'admin123'
    const forceReset = !body?.newPassword // if no explicit password, force reset

    // Find the branch admin for this branch
    const admin = await prisma.user.findFirst({
      where: { branchId: bid, role: 'branch_admin' },
    })
    if (!admin) {
      return NextResponse.json({ error: 'Not found: no branch admin for this branch' }, { status: 404 })
    }

    // Tenant scope check
    if (ctx.role !== 'super_admin') {
      if (ctx.role === 'enterprise_admin' && admin.enterpriseId !== ctx.enterpriseId) {
        return NextResponse.json({ error: 'FORBIDDEN: branch admin not in your enterprise' }, { status: 403 })
      }
      if (ctx.role === 'branch_admin' && admin.branchId !== ctx.branchId) {
        return NextResponse.json({ error: 'FORBIDDEN: not in your branch' }, { status: 403 })
      }
    }

    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash, mustResetPassword: forceReset },
    })

    await prisma.auditLog.create({
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
