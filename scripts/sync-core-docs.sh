#!/usr/bin/env bash
set -euo pipefail

# Sync core "source of truth" docs from repo root into /docs copies.
SYNC_FILES=(
  "README.md"
  "AI_UPDATE_GUIDE.md"
  "PROJECT_CONTEXT.md"
  "AI_REQUIREMENTS.md"
  "CHANGELOG.md"
  "TASK_TEMPLATE_CONTINUE.md"
  "FEATURES_AI_MAP.md"
  "PROMPT_REBUILD_PROJECT.md"
  "ALL_FEATURES.txt"
  "CONTRACT_CHECKLIST.md"
  "CHATKITFULL.txt"
)

mkdir -p docs

for f in "${SYNC_FILES[@]}"; do
  if [ -f "$f" ]; then
    cp -f "$f" "docs/$f"
  else
    echo "Missing $f"
    exit 1
  fi
done

echo "✅ Core docs synced to /docs"
