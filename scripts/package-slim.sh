#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
VERSION=$(node -p "require('./package.json').version")
OUT="../videoshare-nextjs-v${VERSION}-final-slim.zip"
# Exclude heavy/build folders
zip -r "$OUT" . \
  -x "node_modules/*" \
  -x ".next/*" \
  -x "worker/dist/*" \
  -x ".git/*" \
  -x "**/.DS_Store" \
  -x "**/npm-debug.log" \
  -x "**/yarn-error.log"
echo "Wrote $OUT"
