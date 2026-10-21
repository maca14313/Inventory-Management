#!/usr/bin/env node
/**
 * scripts/seed.js — factory-reset the database to fresh demo data.
 * Plain Node + better-sqlite3 only. No TypeScript, no ORM.
 *
 * The actual demo data is seeded automatically at app startup
 * (src/instrumentation.ts) whenever the User table is empty — this is the
 * deployment guide's "first-run setup" pattern (§12). This CLI just performs
 * the reset: wipe → re-apply migrations → next app start re-seeds demo data.
 *
 * Usage:
 *   node scripts/seed.js              interactive reset (asks for confirmation)
 *   node scripts/seed.js --force      reset without asking
 *   DB_PATH=/path/db.sqlite node scripts/seed.js --force
 */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

function resolveDbFile() {
  const fromEnv = process.env.DB_PATH || process.env.DATABASE_URL
  if (fromEnv) {
    const p = fromEnv.replace(/^file:/, '')
    return path.isAbsolute(p) ? p : path.join(process.cwd(), p)
  }
  return path.join(process.cwd(), 'db', 'custom.db')
}

const DB_FILE = resolveDbFile()
const force = process.argv.includes('--force')

console.log(`Database: ${DB_FILE}`)

if (!fs.existsSync(DB_FILE)) {
  console.log('No database file yet — nothing to reset.')
} else {
  if (!force) {
    console.log('\nWARNING: this DELETES all data and restores the demo dataset on next app start.')
    process.stdout.write('Type "reset" to confirm: ')
    const answer = fs.readFileSync(0, 'utf-8').trim()
    if (answer !== 'reset') { console.log('Aborted.'); process.exit(0) }
  }
  for (const suffix of ['', '-wal', '-shm']) {
    const f = DB_FILE + suffix
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }
  console.log('Wiped database file (and -wal/-shm sidecars).')
}

// Re-apply schema
console.log('\nRe-applying migrations…')
const migrate = path.join(__dirname, 'migrate.js')
execFileSync(process.execPath, [migrate], { stdio: 'inherit' })

console.log('\nOK — next app start will auto-seed demo data:')
console.log('  superadmin / acme_admin / acme_hq_admin / acme_wh1_admin / acme_wh1_user …')
console.log('  (all demo passwords: admin123)')
