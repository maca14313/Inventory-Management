import { NextResponse } from 'next/server'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'
import { seedDefaultPermissions } from '@/lib/permissions'
import { orm } from '@/lib/orm'

/** POST /api/branches/[id]/create-admin — create a branch_admin for the given branch.
 *  Requires 'branches:manage_admin' permission.
 *  Body: { username, fullName, email?, password? }
 *  If password is omitted, defaults to 'admin123' and mustResetPassword=true. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'branches:manage_admin')
    const { id } = await params
    const bid = parseInt(id, 10)
    if (!bid) return NextResponse.json({ error: 'Validation: invalid branch id' }, { status: 400 })

    const body = await req.json()
    const { username, fullName, email, password } = body || {}
    if (!username || !fullName) {
      return NextResponse.json({ error: 'Validation: username and fullName are required' }, { status: 400 })
    }

    const branch = await orm.branch.findUnique({ where: { id: bid } })
    if (!branch) return NextResponse.json({ error: 'Not found: branch' }, { status: 404 })

    const existing = await orm.user.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json({ error: 'Validation: username already taken' }, { status: 400 })
    }

    const bcrypt = await import('bcryptjs')
    const explicitPassword = password || 'admin123'
    const passwordHash = await bcrypt.hash(explicitPassword, 10)
    const forceReset = !password

    const admin = await orm.user.create({
      data: {
        username,
        fullName,
        email: email || '',
        role: 'branch_admin',
        enterpriseId: branch.enterpriseId,
        branchId: bid,
        isActive: true,
        passwordHash,
        mustResetPassword: forceReset,
      },
    })

    await seedDefaultPermissions(admin.id, 'branch_admin', ctx.userId || undefined)

    await orm.auditLog.create({
      data: {
        userId: ctx.userId,
        enterpriseId: branch.enterpriseId,
        action: 'branch.create_admin',
        entity: 'User',
        entityId: admin.id,
        details: `Created branch admin ${username} for branch #${bid}`,
      },
    })

    return NextResponse.json({
      ok: true,
      admin: { id: admin.id, username: admin.username, fullName: admin.fullName, forcedReset: forceReset },
    })
  } catch (e) { return handleError(e) }
}
