#!/usr/bin/env bash
# Clean build for the uivisor monorepo.
# Run from anywhere — the script resolves the repo root automatically.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── helpers ───────────────────────────────────────────────────────────────────
log()  { echo "▶ $*"; }
step() { echo; echo "── $* ──"; }

# ── clean ─────────────────────────────────────────────────────────────────────
step "Cleaning"
log "Removing workspace node_modules and dist directories..."
rm -rf node_modules packages/core/node_modules packages/core/dist \
       uivisor-app/node_modules uivisor-app/dist \
       recorder-app/node_modules recorder-app/dist
log "Removing test-app node_modules and dist..."
rm -rf test-app/node_modules test-app/dist

# ── workspace install ─────────────────────────────────────────────────────────
step "Installing workspace dependencies"
npm install

# ── packages/core ─────────────────────────────────────────────────────────────
step "Building packages/core"
npm run build --workspace=packages/core

# ── uivisor-app ───────────────────────────────────────────────────────────────
step "Building uivisor-app"
npm run build --workspace=uivisor-app

# ── recorder-app ──────────────────────────────────────────────────────────────
step "Building recorder-app"
npm run build --workspace=recorder-app

# ── playwright browsers ───────────────────────────────────────────────────────
step "Installing Playwright browsers"
npx playwright install chromium

# ── test-app (standalone — not in workspace) ──────────────────────────────────
step "Installing and building test-app"
cd test-app
npm install
npm run build
cd "$REPO_ROOT"

# ── done ──────────────────────────────────────────────────────────────────────
echo
echo "✓ Clean build complete."
