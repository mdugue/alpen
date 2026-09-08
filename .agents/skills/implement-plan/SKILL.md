---
name: implement-plan
description: "Implement one of the plans in docs/plans/ end to end: read the plan and its prerequisites, follow AGENTS.md conventions, verify with the repo's checks, update the plan status and open a PR. Use when the user says 'implement plan 03', 'work on docs/plans/…', 'pick the next plan', or names a plan topic (payload, real routes, period hero, climate status, filters, basemap, tests, destinations)."
---

Execute one plan from `docs/plans/` so that the result is mergeable without a
second round.

## 1. Orient

1. Read `docs/plans/README.md` (order, status, product goal) and the plan file.
2. Check the plan's **Depends on** line. If a prerequisite is not `done`, say
   so before writing code and either stop or agree on a reduced scope with
   the user. Never silently implement around a missing prerequisite.
3. Read the files the plan names. Confirm the plan's "Why now" evidence still
   holds (a number, a defect, a screenshot); if the codebase moved on, note
   the difference in the PR.
4. Restate the acceptance criteria as a checklist in your first message.

## 2. Build

- Follow `AGENTS.md`: German UI strings, English code and comments, colours
  only via tokens, shadcn base-ui components untouched in `components/ui/`,
  no manual memoisation (React Compiler), `"use cache"` rules for anything
  that would make a page dynamic, `bun run data:check` after touching
  `data/`.
- Plans list phases or parts. One phase = one PR unless the plan says the
  phases are inseparable. Prefer small PRs that leave `main` deployable.
- Keep the plan's non-goals out of the diff. Ideas that come up go into the
  plan's "Risks and open questions" or `docs/roadmap.md`, not into the code.
- Product lens: the app helps choose where and when to go; when a design
  choice trades overview for precision, choose overview.

## 3. Verify

```bash
bun run typecheck && bun run lint && bun run build && bun run data:check
bun test            # once plan 10 exists
```

- For anything visible run the `preview-app` skill and attach screenshots
  (light, dark, mobile, the states the plan mentions).
- For anything measured (payload, tile bytes, render counts) record before
  and after numbers with the command used.
- Re-read the diff adversarially against the acceptance criteria.

## 4. Close

1. Update the plan's header line: `**Status:** in progress (#PR)` or
   `done (#PR)`, and the row in `docs/plans/README.md`.
2. If the plan changed a convention or a file location, update `AGENTS.md`
   ("Where things live") and `README.md` in the same PR.
3. PR description: link to the plan, which phase this is, the acceptance
   checklist with ticks, numbers and screenshots, anything left for the next
   phase.
