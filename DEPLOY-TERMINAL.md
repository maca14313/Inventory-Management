# Deploying Inventory Management on cPanel — Terminal Method

> Use this when cPanel **lacks the "Setup Node.js App" (Passenger) extension**.
> Everything runs through **cPanel Terminal + File Manager**: a local Node.js in
> `~/nodejs`, a `nohup` background process, and an `.htaccess` reverse proxy.
>
> (If your host later adds the Passenger extension, the same archive works as-is
> via `app.js` — see `DEPLOYMENT-GUIDE (1).md` §5.1.)

---

## 0. What you receive

`inventory-management-<timestamp>.tar.gz` containing:

```
app.js              server entry (defaults to internal port 3001)
package.json        runtime deps only (NO node_modules shipped)
next.config.mjs     plain-JS Next.js config
.env.example        env var template
.next/              pre-built app (build happens on the build machine)
public/             static assets
migrations/         idempotent SQL — applied automatically at app start
scripts/            migrate.js / seed.js CLIs (optional manual runs)
logs/               runtime log dir
db/                 SQLite lives here (db/custom.db) — auto-created
htaccess.txt        reverse proxy rules → copy to public_html as `.htaccess`
```

The app **never compiles anything on the server** — it arrives pre-built.

---

## 1. Install Node.js v22 locally in your account (one-time)

Open **cPanel → Terminal** and run:

```bash
# Remove any previous versions or temporary tarballs
rm -rf ~/nodejs

# Download the Node.js v22.23.3 linux-x64 release
curl -O https://nodejs.org/dist/v22.23.3/node-v22.23.3-linux-x64.tar.gz

# Extract and place it in your home folder
tar -xzf node-v22.23.3-linux-x64.tar.gz
mv node-v22.23.3-linux-x64 ~/nodejs
rm node-v22.23.3-linux-x64.tar.gz

# Make node/npm visible in every future session
echo 'export PATH=$HOME/nodejs/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Verify
node -v   # v22.23.3
npm -v
```

---

## 2. Upload & extract the app

In **File Manager**, upload the `.tar.gz` to `~/apps/` (create it first), then in Terminal:

```bash
mkdir -p ~/apps/inventory-management
tar -xzf ~/apps/inventory-management-*.tar.gz -C ~/apps/inventory-management
cd ~/apps/inventory-management
ls    # must show: app.js  package.json  next.config.mjs  .next/  public/  migrations/  htaccess.txt …
```

Keep the app **outside public_html** — only the proxy rule exposes it. The SQLite
file (`db/custom.db`) then can never be downloaded directly.

---

## 3. Install dependencies (EMFILE-safe)

Shared hosts cap concurrent file opens (`ulimit`). Always use the isolated
cache flags:

```bash
mkdir -p /tmp/npm-cache
cd ~/apps/inventory-management
npm install --cache /tmp/npm-cache --prefer-offline --no-audit
```

- ~73 packages, a few seconds. No build step runs (rule: migrations happen at
  app **start**, never at install).
- `better-sqlite3` downloads a **prebuilt binary** for Node 22 during this step.
  If your host blocks GitHub downloads it falls back to compiling (needs
  python3 + make + gcc — usually present when Terminal is).

---

## 4. Start the app

```bash
cd ~/apps/inventory-management
nohup node app.js > app.log 2>&1 &
```

Watch it come up (migrations + first-run demo seed happen automatically):

```bash
tail -n 30 app.log
# [startup] migrations applied: 001_initial_schema, 002_recorder_person_user
# [startup] empty database detected — seeding demo data…
# App ready on http://127.0.0.1:3001
# [startup] server ready (sqlite)
```

The app listens on **127.0.0.1:3001 only** — the outside world reaches it
through the proxy (step 5). Override with `PORT=… nohup node app.js …` if you
ever need to.

---

## 5. Route your domain to it (reverse proxy)

1. **File Manager** → open your domain's web root (`public_html` or the
   subdomain folder).
2. Copy `~/apps/inventory-management/htaccess.txt` there and rename it to
   `.htaccess` (enable "Show Hidden Files" to see it).
3. The rules (already point at port 3001 — keep them in sync if you change PORT):

```apache
RewriteEngine On
RewriteCond %{REQUEST_URI} !^/[0-9]+\..*cpanellogos
RewriteCond %{REQUEST_URI} !^/[0-9]+\..*webmaildiskusage
RewriteCond %{REQUEST_URI} !^/[0-9]+\..*whm
RewriteRule ^(.*)$ http://127.0.0.1:3001/$1 [P,L]
```

Requires Apache `mod_proxy` (the `[P]` flag). A **500 error** on the site
usually means it's disabled — ask support to enable mod_proxy + mod_rewrite.

---

## 6. Verify

Visit `https://yourdomain.com/api/health`:

```json
{"ok":true,"status":200,"checks":{"app":"ok","backend":"sqlite","database":"ok","schema":"ok"}}
```

Then open the site and log in. Demo accounts (seeded on first start only,
while the DB is still empty):

| Login | Role |
|---|---|
| `superadmin` | Super Admin — everything |
| `acme_admin` | Enterprise Admin (Acme) |
| `acme_hq_admin` | Branch Admin (Acme HQ) |
| `acme_wh1_admin` | Warehouse Admin (Acme WH1) |
| `acme_wh1_user` | Warehouse Employee (Acme WH1) |

Password for all: `admin123`

---

## 7. Lifecycle (Terminal)

| Action | Command |
|---|---|
| **Status** | `ps aux \| grep node` |
| **Logs** | `tail -n 30 ~/apps/inventory-management/app.log` |
| **Stop** | `pkill -u $USER -f node` |
| **Restart** | `pkill -u $USER -f node` then repeat step 4 |

Re-deploys: upload the new `.tar.gz`, re-extract over the folder, re-run
`npm install --cache /tmp/npm-cache --prefer-offline --no-audit`, restart.
Migrations are additive-only — a new version never breaks the existing DB, and
the old version keeps working against a newer schema (safe rollback).

---

## 8. Troubleshooting (terminal method)

| Symptom | Cause → Fix |
|---|---|
| `command not found: node` | PATH not loaded → `source ~/.bashrc` |
| `EMFILE: too many open files` (npm install) | fd limit hit → use `--cache /tmp/npm-cache --prefer-offline --no-audit` |
| `EADDRINUSE` / instant crash | Port 3001 occupied by a ghost process → `pkill -u $USER -f node`, retry (app.js already avoids 3000) |
| Site shows **500** | `.htaccess` missing/wrong port or mod_proxy disabled → check rules point to `http://127.0.0.1:3001/` with `[P,L]`; ask host to enable mod_proxy |
| `Cannot find "next"` | Deps not installed → repeat step 3 |
| `/api/health` 503 | DB error — response body has `databaseError` + `requestId`; grep `app.log` for that ID |
| Tables never created | Migrations run at **start** (step 4), not install → check `app.log` for "migrations applied" |
