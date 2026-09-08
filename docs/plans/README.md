# Implementation plans

One document per topic, each written so that a developer or an agent can pick
it up cold: goal, evidence, design, steps, acceptance criteria, risks. The
`implement-plan` skill in `.agents/skills/` describes how to execute one.

## Product goal, in one paragraph

The app helps road cyclists choose **where and when** to go on holiday in the
Alps. It answers questions such as "which regions are good in early October if
we want to ride a few great passes", "where should we look for a hotel so that
several passes and a loop are within reach" and "which destinations should we
keep an eye on for single-day and multi-day tours". It is deliberately **not**
a route planner: Komoot, Strava and friends do turn-by-turn planning far
better, and the app links out to them. Every plan below states how it serves
that goal; features that only add route-level precision rank last.

## Recommended order

| #   | Plan                                                               | Serves                      | Effort | Depends on           | Status                                          |
| --- | ------------------------------------------------------------------ | --------------------------- | ------ | -------------------- | ----------------------------------------------- |
| 00  | [Route quality gate](00-route-quality-gate.md)                     | trust in what the map shows | S      | –                    | [done](https://github.com/mdugue/alpen/pull/6)  |
| 01  | [Map data out of the React payload](01-map-data-out-of-payload.md) | first load on holiday Wi-Fi | M      | 00 for complete data | in progress                                     |
| 03  | [Make the period the hero](03-period-hero.md)                      | "when"                      | M      | –                    | [done](https://github.com/mdugue/alpen/pull/4)  |
| 04  | [Climate-aware status](04-climate-aware-status.md)                 | "when", honesty             | S–M    | –                    | [done](https://github.com/mdugue/alpen/pull/4)  |
| 12  | [Destinations](12-destinations.md)                                 | "where"                     | L      | 09                   | proposed                                        |
| 05  | [Filters and search](05-filters-and-search.md)                     | finding things              | S–M    | –                    | [done](https://github.com/mdugue/alpen/pull/9)  |
| 02  | [Real routes instead of the hash](02-real-routes.md)               | sharing, back button, SEO   | L      | 01                   | proposed                                        |
| 06  | [A basemap that matches the theme](06-basemap.md)                  | dark mode, map quality      | M      | –                    | proposed                                        |
| 09  | [Schema validation with zod](09-schema-validation.md)              | data safety                 | S      | –                    | [done](https://github.com/mdugue/alpen/pull/9)  |
| 10  | [Tests](10-tests.md)                                               | refactor safety             | M      | –                    | [done](https://github.com/mdugue/alpen/pull/4)  |
| 11  | [Smaller items](11-smaller-items.md)                               | polish                      | S each | varies               | proposed                                        |
| 08  | [English toggle](08-english-toggle.md)                             | audience                    | M–L    | 02                   | proposed                                        |
| 07  | [Profile interactivity](07-profile-interactivity.md)               | detail, low priority now    | S–M    | –                    | [done](https://github.com/mdugue/alpen/pull/11) |

Effort: S ≤ 1 day, M 2–3 days, L 4–6 days. 09, 10 and 11 can be interleaved
with anything; do 09 before 12 so the new entity gets a schema from day one.

## Status legend

`proposed` → `in progress` (link the PR) → `done` (link the merged PR). Update
the header of the plan and this table in the same PR that changes the code.

## Conventions shared by all plans

- Every UI string is German, code and docs are English (see `AGENTS.md`).
- Data changes go through `bun run data:check`; generated files are never
  edited by hand.
- Each plan lists a verification section. Run it before opening the PR, and
  paste screenshots for anything visual (`preview-app` skill).
- Conceptual plans carry a "mechanism in one picture" section: a before and
  an after diagram (Mermaid renders on GitHub; ASCII for sketches). When the
  plan is done, its "after" picture moves into the documentation it changed
  (`docs/data-model.md`, `docs/scales.md`, README, `AGENTS.md`, a skill), so
  the docs show the mechanism and not only the API. Each plan's
  "Documentation" step says where.
