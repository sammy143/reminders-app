---
description: Run the multi-agent loop for the next failing feature (or the given feature id)
argument-hint: "[feature-id]"
---

Run the feature loop from CLAUDE.md for feature `$ARGUMENTS` (if empty: the first feature in
harness/feature_list.json with `passes: false`).

1. Run `bash scripts/init.sh`. If baseline checks fail, fix the baseline first (that's the task).
2. If the feature spans >3 files or has open design choices, write
   docs/exec-plans/active/<id>.md from the template.
3. Spawn `implementer` with the feature id, verify steps, and exec plan path.
4. Spawn `verifier` and `reviewer` together in one message.
5. Up to 2 fix rounds via SendMessage to the same implementer for FAIL / BLOCKING findings.
6. On verifier PASS (or PASS-PENDING-HUMAN — then ask the user to do the manual step first):
   set `passes: true`, append to harness/progress.md, move the exec plan to completed/,
   run `bash scripts/check.sh`, commit `<id>: <summary>`.
7. Otherwise log the blocker in harness/progress.md and ask the user.

Finish with a 3-line summary: feature, verdict, what's next.
