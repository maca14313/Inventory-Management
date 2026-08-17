import { NextResponse } from 'next/server'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission, seedDefaultPermissions } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

/** POST /api/branches/[id]/create-admin — create a branch_admin for the given branch.
 *  Requires 'branches:manage_admin' permission (super_admin implicit, enterprise_admin
 *  scoped to own enterprise, branch_admin scoped to own branch).
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

    // Check branch exists + tenant scope
    const branch = await prisma.branch.findUnique({ where: { id: bid } })
    if (!branch) return NextResponse.json({ error: 'Not found: branch' }, { status: 404 })
    // Tenant isolation: enterprise_admin must own the branch; branch_admin must own it
    if (ctx.role !== 'super_admin') {
      if (ctx.role === 'enterprise_admin' && branch.enterpriseId !== ctx.enterpriseId) {
        return NextResponse.json({ error: 'FORBIDDEN: branch not in your enterprise' }, { status: 403 })
      }
      if (ctx.role === 'branch_admin' && branch.id !== ctx.branchId) {
        return NextResponse.json({ error: 'FORBIDDEN: not your branch' }, { status: 403 })
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
        role: 'branch_admin',
        enterpriseId: branch.enterpriseId,
        branchId: bid,
        isActive: true,
        passwordHash,
        mustResetPassword: forceReset,
      },
    })

    // Seed default permissions for the new branch_admin
    await seedDefaultPermissions(admin.id, 'branch_admin', ctx.userId || undefined)

    await prisma.auditLog.create({
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
