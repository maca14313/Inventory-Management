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

echo "── [1/4] Building (NEXT_BUILD=true NODE_ENV=production) …"
NEXT_BUILD=true NODE_ENV=production BASE_PATH="$BASE_PATH" npx next build

echo "── [2/4] Staging runtime files (rule 2: NO node_modules) …"
rm -rf "$STAGE_DIR"; mkdir -p "$STAGE_DIR"
cp server.js              "$STAGE_DIR/"                # Passenger entry (guide Step 2)
cp deploy-package.json    "$STAGE_DIR/package.json"    # runtime deps only (guide Step 6)
cp next.config.js         "$STAGE_DIR/"                # CommonJS config (guide Step 1)
cp .env.example           "$STAGE_DIR/"                # env var template (§10)
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

echo "── [3/4] Creating archive (tar preserves symlinks — rule 7) …"
cd "$STAGE_DIR"
tar -czf "$DEPLOY_DIR/$ARCHIVE_NAME" \
  server.js package.json next.config.js .env.example logs/ .next/ public/ scripts/ migrations/ db/
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
echo "Next steps (cPanel):"
echo "  1. File Manager → upload + extract into ~/apps/inventory-management/"
echo "  2. Setup Node.js App → Node 20 · Production · startup file: server.js"
echo "  3. Env vars: DB_PATH=db/custom.db · NODE_ENV=production"
echo "  4. Run NPM Install → Start"
echo "  5. /api/health must return {\"ok\":true} — migrations + demo seed run at first start"
