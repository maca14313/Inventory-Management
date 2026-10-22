#!/usr/bin/env bash
# scripts/build-and-package.sh — build the app and create the deploy archive
# (deployment-guide §6, adapted for SQLite — no MySQL, no ORM).
#
# Produces: deploy/inventory-management-<timestamp>.tar.gz
# Usage:    bash scripts/build-and-package.sh          (root deploy)
#           BASE_PATH=/sub bash scripts/build-and-package.sh
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$PROJECT_DIR/deploy"
BASE_PATH="${BASE_PATH:-}"
ARCHIVE_NAME="inventory-management-$(date +%Y%m%d-%H%M%S).tar.gz"
STAGE_DIR="$PROJECT_DIR/.deploy-stage"

cd "$PROJECT_DIR"

# ── Hide local env from the build ─────────────────────────────────
# Next.js bakes env values (BOTH the .env FILE and exported shell vars)
# into the compiled server bundle at build time. A dev DATABASE_URL on the
# build machine would leak into the shipped archive and the app would open
# THAT path on the host — or crash trying to create it.
# 1) move every .env* file away for the duration of the build
# 2) strip DATABASE_URL / DB_PATH from the build process env (shell exports)
# The trap restores the files even if the build fails.
ENV_HIDE_DIR="$PROJECT_DIR/.env-hidden-during-build"
restore_env_files() {
  if [ -d "$ENV_HIDE_DIR" ]; then
    # dotglob: the glob * must also match dotfiles (.env)
    shopt -s dotglob nullglob
    for f in "$ENV_HIDE_DIR"/*; do
      [ -f "$f" ] && mv -f "$f" "$PROJECT_DIR/$(basename "$f")"
    done
    shopt -u dotglob nullglob
    rmdir "$ENV_HIDE_DIR" 2>/dev/null || true
  fi
}
# Self-healing: restore leftovers from a previous interrupted run first
restore_env_files
rm -rf "$ENV_HIDE_DIR"; mkdir -p "$ENV_HIDE_DIR"
trap restore_env_files EXIT
for f in .env .env.local .env.production .env.production.local; do
  [ -f "$PROJECT_DIR/$f" ] && mv "$PROJECT_DIR/$f" "$ENV_HIDE_DIR/"
done

echo "── [1/4] Building (NEXT_BUILD=true · .env hidden · DB vars stripped) …"
env -u DATABASE_URL -u DB_PATH \
  NEXT_BUILD=true NODE_ENV=production BASE_PATH="$BASE_PATH" npx next build
restore_env_files

echo "── [2/4] Staging runtime files (rule 2: NO node_modules) …"
rm -rf "$STAGE_DIR"; mkdir -p "$STAGE_DIR"
cp app.js                 "$STAGE_DIR/"                # Passenger entry (§5.1)
cp deploy-package.json    "$STAGE_DIR/package.json"    # runtime deps only (§5.2)
cp next.config.mjs        "$STAGE_DIR/"                # plain-JS config (§5.3)
cp .env.example           "$STAGE_DIR/"                # env var template
cp htaccess.txt           "$STAGE_DIR/"                # → public_html/.htaccess (terminal method)
cp DEPLOY-TERMINAL.md     "$STAGE_DIR/"                # terminal-method deploy guide
mkdir -p "$STAGE_DIR/logs"; touch "$STAGE_DIR/logs/.gitkeep"
cp -a public              "$STAGE_DIR/public"          # static assets
cp -a migrations          "$STAGE_DIR/migrations"      # idempotent schema (§5.5)
mkdir -p "$STAGE_DIR/scripts"
cp scripts/migrate.js     "$STAGE_DIR/scripts/"        # manual migration CLI
cp scripts/seed.js        "$STAGE_DIR/scripts/"        # factory-reset CLI
# empty db dir — the app creates + migrates + seeds the SQLite file at first start
mkdir -p "$STAGE_DIR/db"; touch "$STAGE_DIR/db/.gitkeep"

# compiled output, minus build caches:
mkdir -p "$STAGE_DIR/.next"
for item in .next/*; do
  base=$(basename "$item")
  [ "$base" != "cache" ] && [ "$base" != "dev" ] && cp -a "$item" "$STAGE_DIR/.next/"
done
rm -rf "$STAGE_DIR/.next/types" "$STAGE_DIR/.next/diagnostics"

# No build-machine env may be baked into the compiled server bundle
# (a dev DATABASE_URL would make the app open that path on the host):
BAD_LEAK=$(grep -rlE "file:[^\"']*\.db|my-project/db" "$STAGE_DIR/.next" 2>/dev/null || true)
if [ -n "$BAD_LEAK" ]; then
  echo "FAIL: build-machine env leaked into .next:"; echo "$BAD_LEAK" | head -5
  rm -rf "$STAGE_DIR"; exit 1
fi

echo "── [3/4] Creating archive (tar preserves symlinks — rule 7) …"
cd "$STAGE_DIR"
tar -czf "$DEPLOY_DIR/$ARCHIVE_NAME" \
  app.js package.json next.config.mjs .env.example htaccess.txt DEPLOY-TERMINAL.md logs/ .next/ public/ scripts/ migrations/ db/
cd "$PROJECT_DIR"; rm -rf "$STAGE_DIR"

echo "── [4/4] Verifying archive …"
mkdir -p "$DEPLOY_DIR"
BAD_NM=$(tar -tzf "$DEPLOY_DIR/$ARCHIVE_NAME" | grep -E "(^|/)node_modules(/|$)" \
         | grep -vE "^(\./)?\.next/node_modules/" || true)
[ -n "$BAD_NM" ] && { echo "FAIL: real node_modules in archive"; exit 1; }
tar -tzf "$DEPLOY_DIR/$ARCHIVE_NAME" | grep -q "BUILD_ID" || { echo "FAIL: no BUILD_ID"; exit 1; }
tar -tzf "$DEPLOY_DIR/$ARCHIVE_NAME" | grep -q "migrations/001" || { echo "FAIL: no migrations"; exit 1; }
tar -tzf "$DEPLOY_DIR/$ARCHIVE_NAME" | grep -qE "\.db$" && { echo "FAIL: stray .db file in archive"; exit 1; }
echo ""
echo "OK → $DEPLOY_DIR/$ARCHIVE_NAME"
echo ""
echo "Next steps — TERMINAL method (no Setup Node.js App extension):"
echo "  See DEPLOY-TERMINAL.md (shipped in the archive). Summary:"
echo "  1. ~/nodejs — local Node v22 (curl nodejs.org/dist → tar → PATH in ~/.bashrc)"
echo "  2. File Manager: upload .tar.gz → extract to ~/apps/inventory-management/"
echo "  3. Terminal: npm install --cache /tmp/npm-cache --prefer-offline --no-audit"
echo "  4. nohup node app.js > app.log 2>&1 &   → migrations + demo seed run at first start"
echo "     (app listens on 127.0.0.1:3001 — PORT env var to change)"
echo "  5. Copy htaccess.txt → public_html/.htaccess (reverse proxy → 127.0.0.1:3001)"
echo "  6. https://yourdomain/api/health must return {\"ok\":true}"
echo ""
echo "  (If the Passenger extension exists on the host instead, use DEPLOYMENT-GUIDE (1).md — same archive.)"
