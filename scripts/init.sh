#!/usr/bin/env bash
# Session start: orient the agent, then prove the baseline is green before new work.
set -uo pipefail
cd "$(dirname "$0")/.."

echo "== git =="
git status --short --branch
git log --oneline -5 2>/dev/null || echo "(no commits yet)"

echo
echo "== recent progress =="
tail -n 12 harness/progress.md

echo
echo "== next feature =="
node -e '
const f = require("./harness/feature_list.json").features;
const next = f.find(x => !x.passes);
const done = f.filter(x => x.passes).length;
console.log(`${done}/${f.length} passing`);
if (next) {
  console.log(`${next.id} [${next.milestone}] ${next.title}`);
  next.verify.forEach(v => console.log(`  - ${v}`));
} else console.log("All features pass.");
'

if [ -f package.json ] && [ ! -d node_modules ]; then
  echo
  echo "== installing dependencies =="
  npm install
fi

echo
echo "== baseline checks =="
bash scripts/check.sh
