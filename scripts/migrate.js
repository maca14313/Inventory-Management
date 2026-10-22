#!/usr/bin/env node
/**
 * scripts/migrate.js — standalone migration CLI (deployment-guide §5.5).
 * Plain Node + better-sqlite3 only. No TypeScript, no ORM.
 *
 * Usage:
 *   node scripts/migrate.js            apply pending migrations
 *   DB_PATH=/path/db.sqlite node scripts/migrate.js
 */

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

// ─── resolve db file (same rules as src/lib/sqlite.ts) ──────
function resolveDbFile() {
  const fromEnv = process.env.DB_PATH || process.env.DATABASE_URL
  if (fromEnv) {
    const p = fromEnv.replace(/^file:/, '')
    return path.isAbsolute(p) ? p : path.join(process.cwd(), p)
  }
  return path.join(process.cwd(), 'db', 'custom.db')
}

const DB_FILE = resolveDbFile()
const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations')

if (!fs.existsSync(MIGRATIONS_DIR)) {
  console.error(`No migrations folder at ${MIGRATIONS_DIR}`)
  process.exit(1)
}

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true })
const db = new Database(DB_FILE)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ─── tracking table ─────────────────────────────────────────
db.exec(`CREATE TABLE IF NOT EXISTS "schema_migrations" (
  "version" TEXT PRIMARY KEY,
  "applied_at" DATETIME NOT NULL
)`)

const applied = new Set(
  db.prepare('SELECT version FROM schema_migrations').all().map(r => r.version)
)

const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()
if (files.length === 0) {
  console.log('No migration files found.')
  process.exit(0)
}

console.log(`Database : ${DB_FILE}`)
console.log(`Migrations: ${files.length} file(s), ${applied.size} already applied\n`)

const insert = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
const ERRORS_OK = ['duplicate column name']

for (const file of files) {
  const version = file.replace(/\.sql$/, '')
  if (applied.has(version)) {
    console.log(`  = ${version} (already applied)`)
    continue
  }
  const statements = fs
    .readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
    .split(/;\s*\n/)
    .map(s => s.replace(/^--[^\n]*\n?/gm, '').trim())
    .filter(s => s.length > 0)
  const run = db.transaction(() => {
    for (const stmt of statements) {
      try {
        db.exec(stmt)
      } catch (err) {
        const msg = String(err.message || err)
        if (!ERRORS_OK.some(ok => msg.toLowerCase().includes(ok))) throw err
      }
    }
    insert.run(version, Date.now())
  })
  try {
    run()
    console.log(`  + ${version} (${statements.length} statements) — applied`)
  } catch (err) {
    console.error(`  ✗ ${version} FAILED: ${err.message}`)
    console.error('    (transaction rolled back; fix the SQL and re-run)')
    process.exit(1)
  }
}

const tableCount = db.prepare("SELECT count(*) AS c FROM sqlite_master WHERE type='table'").get().c
console.log(`\nOK — database has ${tableCount} tables. Migrations complete.`)
db.close()
