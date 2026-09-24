# Task completion

- `bash scripts/check.sh` must pass (architecture; plus lint, typecheck, test once package.json exists — missing scripts fail the check).
- Feature work: set `passes: true` in `harness/feature_list.json` only after its `verify` steps succeed (verifier agent PASS); steps needing a real phone require the user.
- Append an entry to `harness/progress.md` (format at top of file).
- Docs changed in the same commit as behavior; move finished exec plan to `docs/exec-plans/completed/`.
- Commit message: `<feature-id>: <summary>`; never commit `.env*`.
