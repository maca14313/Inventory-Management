/**
 * Next.js instrumentation — runs ONCE per server process at startup.
 *
 * Deployment-guide §5.5: migrate at app startup, never at install.
 * Failure policy: log the error and keep running — /api/health reports 503
 * with the error instead of letting Passenger crash-loop the app.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return // skip Edge runtime

  try {
    const { runMigrations, ping } = await import('./lib/sqlite')
    ping()
    const { applied, skipped } = runMigrations()
    if (applied.length) console.log(`[startup] migrations applied: ${applied.join(', ')}`)
    if (skipped.length) console.log(`[startup] migrations already applied: ${skipped.join(', ')}`)

    // First-run setup (guide §12): seed demo data only when the DB is fresh.
    const { isDatabaseEmpty, seedDemoData } = await import('./lib/seed')
    if (await isDatabaseEmpty()) {
      console.log('[startup] empty database detected — seeding demo data…')
      await seedDemoData()
    }
    console.log('[startup] server ready (sqlite)')
  } catch (err) {
    // Keep the server up — health endpoint surfaces the failure.
    console.error('[startup] DATABASE ERROR:', err instanceof Error ? err.message : err)
  }
}
