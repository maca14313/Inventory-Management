/** next.config.mjs — plain JS on purpose (deployment-guide rule 4). */
const basePath = process.env.BASE_PATH || ''
const nextConfig = {
  basePath,
  output: undefined, // NOT 'standalone' — Passenger runs app.js itself
  compress: true,
  // Native SQLite driver must always be required from node_modules, never bundled.
  serverExternalPackages: ['better-sqlite3'],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
}
export default nextConfig
