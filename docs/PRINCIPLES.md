# Golden principles

Opinionated rules that keep the codebase legible to agents and humans. Reviewers enforce
these; add a mechanical check whenever a principle gets violated twice.

## Product
1. Escalation ends only on departure; only `inPerson` events escalate.
2. Mock the lateness, never the person. No identity, appearance, ability, or protected-trait
   insults — in the bank or in Claude prompts.
3. Every notification carries a practical cue ("leave in 4 min").
4. Max 6 notifications per event; lines unique within a series.
5. The app remains usable with notifications disabled.

## Code
6. Pure core, thin edges: decisions live in `domain/`; `services/` only translate to
   platform APIs. If you're writing an `if` about tones or times in a service, move it.
7. Parse at the boundary: validate stored/imported/API data into typed objects once, in
   `services/`; the rest of the code trusts the types.
8. Time is injected: domain functions take `now` as a parameter, never call `Date.now()`.
9. Prefer boring, well-known libraries (Expo SDK modules) over clever custom code.
10. Small files, descriptive names, no dead code. Delete rather than comment out.

## Process
11. Repo is the system of record: a decision not written in `docs/` doesn't exist.
12. Every behavior change ships with a test and any doc it affects, in the same commit.
13. Shortcuts are allowed only when logged in `docs/tech-debt.md`.
