import { prisma } from './src/lib/prisma'

async function main() {
  const atts = await prisma.attachment.findMany({
    select: { id: true, entityType: true, entityId: true, enterpriseId: true, branchId: true, warehouseId: true, fileName: true, title: true, createdAt: true },
    orderBy: { id: 'desc' },
    take: 30,
  })
  console.log('Recent attachments (id, entityType, entityId, enterpriseId, warehouseId, file, title, created):')
  for (const a of atts) {
    console.log(`  #${a.id}: entityType=${a.entityType}, entityId=${a.entityId}, entId=${a.enterpriseId}, wh=${a.warehouseId}, file=${a.fileName}, title="${a.title}", created=${a.createdAt.toISOString()}`)
  }
  
  // Check for orphans (entityId null but entityType != standalone)
  const orphans = await prisma.attachment.findMany({
    where: { AND: [{ entityId: null }, { NOT: { entityType: 'standalone' } }] },
    select: { id: true, entityType: true, fileName: true }
  })
  console.log(`\nOrphans (entityId=null but entityType != standalone): ${orphans.length}`)
  for (const o of orphans) {
    console.log(`  #${o.id}: entityType=${o.entityType}, file=${o.fileName}`)
  }
  
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1); })
