# reminders-app — core

Status: see `harness/feature_list.json` (v1 = F000–F008 done 2026-09-25, device-verified on iOS only). Entry map for agents: `AGENTS.md` (CLAUDE.md imports it + adds multi-agent loop).

Product: Expo (React Native) reminders app; notifications before an appointment's leave-by time escalate polite → insulting until the user has left home. Product rules/milestones/stack: `docs/PLAN.md`.

System of record (repo, not memory):
- `docs/ARCHITECTURE.md` layers `types → domain → services → state → ui → app` under `src/`; enforced by `scripts/check-architecture.mjs` (also a PostToolUse hook on Edit/Write).
- `docs/PRINCIPLES.md` golden principles; `docs/design/` look & design system; `docs/tech-debt.md`; `docs/exec-plans/{active,completed}/`.
- `harness/feature_list.json` (F000–F013; only `passes`/`notes` editable) and `harness/progress.md` (append-only session log).
- `.claude/agents/`: implementer, verifier, reviewer, doc-gardener; `/next-feature` command runs the loop.

Invariants easy to get wrong:
- Claude API key never in repo/app; checker flags `sk-ant-…`.
- iOS 64-pending-notification cap: schedule only next ~2 in-person events.
- Geofencing (v3) needs an EAS dev build, not Expo Go.

Repo: GitHub `sammy143/reminders-app`, branch `main`, remote `origin` over **HTTPS** with a repo-local `gh` credential helper — push over HTTPS, not SSH.

Other memories:
- Stack constraints (Stitch local-only, NativeWind, Expo Go vs dev build): `mem:tech_stack`.
- Expo/EAS commands and macOS shell notes: `mem:suggested_commands`.
- What "done" means for a task (checks, feature list, progress log, commit format): `mem:task_completion`.
