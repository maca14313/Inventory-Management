import { PrismaClient } from '@prisma/client'; import { seedDefaultPermissions } from '../src/lib/permissions';
const p = new PrismaClient();
async function main() {
  const users = await p.user.findMany({ where: { role: { not: 'super_admin' } } });
  for (const u of users) {
    const existing = await p.userPermission.count({ where: { userId: u.id } });
    if (existing === 0) {
      console.log('Seeding:', u.username, u.role);
      await seedDefaultPermissions(u.id, u.role);
    }
  }
  console.log('Done reseeding');
  await p.disconnect();
}
main().catch(e => { console.error(e); process.exit(1) });
