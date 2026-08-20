import { seedMissingDefaults } from '../src/lib/permissions'

async function main() {
  const result = await seedMissingDefaults()
  console.log('Migration complete:', result)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
