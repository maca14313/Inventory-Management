import { NextResponse } from 'next/server'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'
import { requirePermission } from '@/lib/permissions'
import { seedDefaultPermissions } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

/** POST /api/enterprises/[id]/create-admin — create an enterprise_admin for the given enterprise.
 *  Super_admin only (requires 'enterprises:manage_admin' permission).
 *  Body: { username, fullName, email?, password? }
 *  If password is omitted, defaults to 'admin123' and mustResetPassword=true. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    await requirePermission(ctx, 'enterprises:manage_admin')
    const { id } = await params
    const eid = parseInt(id, 10)
    if (!eid) return NextResponse.json({ error: 'Validation: invalid enterprise id' }, { status: 400 })

    const body = await req.json()
    const { username, fullName, email, password } = body || {}
    if (!username || !fullName) {
      return NextResponse.json({ error: 'Validation: username and fullName are required' }, { status: 400 })
    }

    // Check enterprise exists
    const enterprise = await prisma.enterprise.findUnique({ where: { id: eid } })
    if (!enterprise) return NextResponse.json({ error: 'Not found: enterprise' }, { status: 404 })

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
        role: 'enterprise_admin',
        enterpriseId: eid,
        isActive: true,
        passwordHash,
        mustResetPassword: forceReset,
      },
    })

    // Seed default permissions for the new enterprise_admin
    await seedDefaultPermissions(admin.id, 'enterprise_admin', ctx.userId || undefined)

    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        enterpriseId: eid,
        action: 'enterprise.create_admin',
        entity: 'User',
        entityId: admin.id,
        details: `Created enterprise admin ${username} for enterprise #${eid}`,
      },
    })

    return NextResponse.json({
      ok: true,
      admin: { id: admin.id, username: admin.username, fullName: admin.fullName, forcedReset: forceReset },
    })
  } catch (e) { return handleError(e) }
}
