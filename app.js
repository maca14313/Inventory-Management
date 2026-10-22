/**
 * app.js — server entry point. Works under BOTH hosting methods:
 *
 *  A) Terminal method (no "Setup Node.js App" extension — DEPLOY-TERMINAL.md):
 *       started with `nohup node app.js > app.log 2>&1 &`, behind an
 *       .htaccess reverse proxy (public_html → http://127.0.0.1:3001).
 *       Port defaults to 3001 (3000 is often restricted/occupied on shared hosts).
 *
 *  B) Passenger method (if the extension exists later — DEPLOYMENT-GUIDE (1).md §5.1):
 *       Passenger intercepts .listen() and binds its own socket; PORT is ignored.
 */
const { createServer } = require('http')
const path = require('path')
const fs = require('fs')

const PORT = process.env.PORT || 3001 // internal port behind the .htaccess proxy
const HOSTNAME = process.env.HOSTNAME || '127.0.0.1' // not exposed publicly — proxied

let next
try {
  next = require('next') // resolves from ./node_modules (installed via Terminal)
} catch (err) {
  console.error('Cannot find "next". Run: npm install --cache /tmp/npm-cache --prefer-offline --no-audit')
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
