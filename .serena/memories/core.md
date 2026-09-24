# reminders-app — core

Status: harness set up, no app code yet (F001 = scaffold). Entry map for agents: `AGENTS.md` (CLAUDE.md imports it + adds multi-agent loop).

Product: Expo (React Native) reminders app; notifications before an appointment's leave-by time escalate polite → insulting until the user has left home. Product rules/milestones: `docs/PLAN.md`.

System of record (repo, not memory):
- `docs/ARCHITECTURE.md` layers `types → domain → services → state → ui → app` under `src/`; enforced by `scripts/check-architecture.mjs` (also a PostToolUse hook on Edit/Write).
- `docs/PRINCIPLES.md` golden principles; `docs/tech-debt.md`; `docs/exec-plans/{active,completed}/`.
- `harness/feature_list.json` (F001–F013; only `passes`/`notes` editable) and `harness/progress.md` (append-only session log).
- `.claude/agents/`: implementer, verifier, reviewer, doc-gardener; `/next-feature` command runs the loop.

Invariants easy to get wrong:
- Claude API key never in repo/app; checker flags `sk-ant-…`.
- iOS 64-pending-notification cap: schedule only next ~2 in-person events.
- Geofencing (v3) needs an EAS dev build, not Expo Go.

Repo: GitHub `sammy143/reminders-app` (private), remote `origin` (ssh), branch `main`.

Other memories:
- Planned libraries and Expo Go vs dev-build limits: `mem:tech_stack`.
- Expo/EAS commands and macOS shell notes: `mem:suggested_commands`.
- What "done" means for a task (checks, feature list, progress log, commit format): `mem:task_completion`.
