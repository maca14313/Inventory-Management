/**
 * server.js — cPanel / Passenger entry point (deployment-guide Step 2).
 *
 * Why require('next') instead of node_modules/.bin/next?
 * cPanel's "Run NPM Install" creates node_modules in the CloudLinux
 * nodevenv and sets NODE_PATH to it. require() honors NODE_PATH;
 * a .bin path lookup does not.
 */
const { createServer } = require('http')
const path = require('path')
const fs = require('fs')

const PORT = process.env.PORT || 3000
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0'

let next
try {
  next = require('next') // respects NODE_PATH (cPanel sets this)
} catch (err) {
  console.error('Cannot find "next". Did you click "Run NPM Install" in cPanel?')
  console.error(err.message)
  process.exit(1)
}

// Find the directory that contains the build output
const appRoot = [process.cwd(), __dirname, path.join(__dirname, '..')].find(p =>
  fs.existsSync(path.join(p, '.next', 'BUILD_ID')) // Next.js build marker
)

if (!appRoot) {
  console.error('Cannot find .next/BUILD_ID. Make sure the .next/ folder is uploaded.')
  process.exit(1)
}

const app = next({ dev: false, dir: appRoot })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${HOSTNAME}:${PORT}`)
    handle(req, res, {
      pathname: parsedUrl.pathname,
      query: Object.fromEntries(parsedUrl.searchParams.entries()),
    })
  }).listen(PORT, HOSTNAME, () => {
    console.log(`App ready on http://${HOSTNAME}:${PORT}`)
    console.log(`Serving from ${appRoot} (NODE_ENV=${process.env.NODE_ENV})`)
  })
})
