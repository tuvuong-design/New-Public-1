#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
VERSION=$(node -p "require('./package.json').version")
OUT="../videoshare-nextjs-v${VERSION}-final-full.zip"

if [[ "${SKIP_BUILD:-}" != "1" ]]; then
  echo "[package-full] Installing dependencies..."
  npm install
  echo "[package-full] Building web + worker..."
  npm run build
else
  echo "[package-full] SKIP_BUILD=1 (will not install/build)."
fi

# Best-effort sanity check (warn only): avoid accidentally shipping an 'empty full' zip.
missing=0
for p in "node_modules" ".next" "worker/dist"; do
  if [[ ! -d "$p" ]]; then
    echo "[package-full] WARNING: missing $p/ (full zip will not be truly self-contained)."
    missing=1
  else
    # consider empty directories as missing (no files)
    if [[ -z "$(find "$p" -maxdepth 1 -mindepth 1 2>/dev/null | head -n 1)" ]]; then
      echo "[package-full] WARNING: $p/ appears empty (full zip may not be deployable without rebuild)."
      missing=1
    fi
  fi
done

if [[ $missing -eq 1 ]]; then
  echo "[package-full] NOTE: To create a REAL full zip, run: npm install && npm run build && npm run worker:build (or simply npm run package:full)."
fi

zip -r "$OUT" . \
  -x ".git/*" \
  -x "**/.DS_Store" \
  -x "**/npm-debug.log" \
  -x "**/yarn-error.log"

echo "Wrote $OUT"
