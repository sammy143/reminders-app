#!/usr/bin/env bash
# Single gate for "is the repo healthy?". Must pass before every commit.
set -euo pipefail
cd "$(dirname "$0")/.."

step() { echo "-- $1"; }

step "architecture"
node scripts/check-architecture.mjs

if [ ! -f package.json ]; then
  echo "(no package.json yet — skipping lint/typecheck/test; F001 adds them)"
  exit 0
fi

has_script() { node -e "process.exit(require('./package.json').scripts?.['$1'] ? 0 : 1)"; }

for s in lint typecheck test; do
  if has_script "$s"; then
    step "$s"
    CI=1 npm run --silent "$s"
  else
    echo "MISSING npm script '$s' — add it to package.json (see AGENTS.md)." >&2
    exit 1
  fi
done

echo "All checks passed."
