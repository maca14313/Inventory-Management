/**
 * next.config.js — MUST be a CommonJS .js file (deployment-guide Step 1:
 * Turbopack ignores basePath from TypeScript config files).
 *
 * basePath stays EMPTY for local dev so the app runs at '/'.
 * Set BASE_PATH=/yoursub at build time for a cPanel sub-path deploy:
 *   BASE_PATH=/inventory npm run build
 */
const basePath = process.env.BASE_PATH || ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  // cPanel sub-path (e.g. '/inventory'). Leave empty for root deployment.
  basePath,

  // Expose basePath to client-side code for fetch() URL prefixing
  // (deployment-guide Step 4 — fetch() is NOT auto-prefixed by Next.js).
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },

  // NOT 'standalone' — Passenger runs server.js itself.
  output: undefined,

  compress: true,

  // Native SQLite driver must always be required from node_modules, never bundled.
  serverExternalPackages: ['better-sqlite3'],

  // Skip type checking during build (faster, avoids CI-only type errors).
  typescript: {
    ignoreBuildErrors: true,
  },

  reactStrictMode: false,
}

module.exports = nextConfig
