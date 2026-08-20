import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const wh = await p.warehouse.findFirst({ where: { code: 'ACME-HQ-W1' }, select: { id: true, branchId: true, enterpriseId: true } })
  console.log('warehouse:', JSON.stringify(wh))
  if (!wh) { console.log('Warehouse not found'); process.exit(1) }
  const existing = await p.user.findUnique({ where: { username: 'acme_wh1_user' } })
  console.log('existing user:', !!existing)
  if (existing) { console.log('User already exists, done'); process.exit(0) }
  const bcrypt = await import('bcryptjs')
  const hash = await bcrypt.hash('admin123', 10)
  const user = await p.user.create({
    data: {
      username: 'acme_wh1_user',
      fullName: 'Warehouse Employee',
      email: 'employee@acme.com',
      role: 'user',
      enterpriseId: wh.enterpriseId,
      branchId: wh.branchId,
      warehouseId: wh.id,
      isActive: true,
      passwordHash: hash,
    },
  })
  console.log('Created user:', user.id, user.username)
  await p.userPermission.deleteMany({ where: { userId: user.id } })
  await p.userPermission.createMany({
    data: [
      'dashboard:view', 'enterprises:view', 'branches:view', 'warehouses:view',
      'products:view', 'categories:view', 'conditions:view',
      'stock:view', 'stock:adjust',
      'orders:view', 'orders:create', 'orders:edit',
      'suppliers:view',
      'stock_in:view', 'stock_in:create',
      'stock_out:view', 'stock_out:create',
      'returns:view', 'returns:create',
      'non_returnables:view',
      'attachments:view', 'attachments:create',
      'lots:view',
    ].map(a => ({ userId: user.id, ability: a, canUse: true, canDelegate: false, grantedById: null })),
  })
  console.log('Seeded permissions')
  await p.disconnect()
  console.log('Done')
}
main().catch(e => { console.error(e); process.exit(1) })
