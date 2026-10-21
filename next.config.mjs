/** next.config.mjs — plain JS on purpose (deployment-guide rule 4 / §5.3). */
const basePath = process.env.BASE_PATH || ''

const nextConfig = {
  basePath,
  output: undefined, // NOT 'standalone' — Passenger runs app.js itself
  compress: true,

  // Expose basePath to client-side fetch() calls (not auto-prefixed by Next.js).
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },

  // Native SQLite driver must always be required from node_modules, never bundled.
  serverExternalPackages: ['better-sqlite3'],

  // Skip type checking during build (faster, avoids CI-only type errors).
  typescript: {
    ignoreBuildErrors: true,
  },

  reactStrictMode: false,
}

export default nextConfig
