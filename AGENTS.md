# AGENTS.md — map for coding agents

Expo (React Native + TypeScript) reminders app: before an appointment's leave-by time,
notifications escalate polite → insulting until the user has left home.

This file is a **map, not a manual**. Read the linked doc when a task touches its area.

## Start every session
1. `bash scripts/init.sh` — shows git state, recent progress, next failing feature, runs checks.
2. Read the latest entries in `harness/progress.md`.
3. Pick **one** feature: the first entry in `harness/feature_list.json` with `"passes": false`
   (unless the user names another).

## Where things live
| Need | Go to |
|---|---|
| Product rules, milestones, open questions | `docs/PLAN.md` |
| Screen designs + design system (Stitch exports) | `docs/design/` |
| Layers, import rules, folder layout | `docs/ARCHITECTURE.md` |
| Golden principles (taste + invariants) | `docs/PRINCIPLES.md` |
| Feature backlog with pass/fail | `harness/feature_list.json` |
| Session log / handoff notes | `harness/progress.md` |
| Plans for multi-step work | `docs/exec-plans/active/` → move to `completed/` when done |
| Known shortcuts to repay | `docs/tech-debt.md` |
| Multi-agent workflow (Claude Code) | `CLAUDE.md` + `.claude/agents/` |

## Source of truth — who owns what
Each fact lives in exactly one place; everything else links to it.
| Fact | Owner | Update when |
|---|---|---|
| What to build, product rules | `docs/PLAN.md` | user changes scope/rules |
| Feature status (pass/fail) | `harness/feature_list.json` | feature verified |
| What happened, what's next | `harness/progress.md` (append-only) | end of every session |
| How it looks (screens, design system) | `docs/design/` (from Stitch) | design changes — update before UI code |
| How code is organized | `docs/ARCHITECTURE.md` + the checker | a layer/rule changes |
| Why a design choice was made | the feature's exec plan | during the work |

Precedence when sources disagree: **code + passing checks > docs/ > memories**. Fix the stale
doc in the same commit; never "fix" code to match a stale doc without asking. Serena
memories and personal memory only point to these files — never duplicate their content.

## Hard rules
- **One feature per session.** Finish, verify, log, commit — then stop or pick the next.
- **Never mark `passes: true` without running the feature's `verify` steps.** Only the
  `passes` and `notes` fields of a feature may be edited; never delete or reword features.
- **`bash scripts/check.sh` must pass before any commit.** Fix causes, don't weaken checks.
  Changing a check requires a note in `docs/tech-debt.md` or an exec plan explaining why.
- **No secrets in the repo.** The Claude API key lives only in the serverless proxy's env.
- **Leave the repo clean:** working tree committed, `harness/progress.md` updated, docs in
  sync with code (update the doc in the same commit as the behavior change).
- Add Expo libraries with `npx expo install <pkg>`, not `npm install`.

## Commands
- Checks (lint, typecheck, tests, architecture): `bash scripts/check.sh`
- Architecture check only: `node scripts/check-architecture.mjs [files...]`
- Dev server: `npx expo start` (QR → Expo Go; `w` web, `i` iOS Simulator)
- Geofencing/background work needs a dev build: `eas build --profile development`
