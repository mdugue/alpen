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

| #   | Plan                                                                  | Serves                              | Effort | Depends on           | Status                                                 |
| --- | --------------------------------------------------------------------- | ----------------------------------- | ------ | -------------------- | ------------------------------------------------------ |
| 00  | [Route quality gate](00-route-quality-gate.md)                        | trust in what the map shows         | S      | –                    | [done](https://github.com/mdugue/alpen/pull/6)         |
| 01  | [Map data out of the React payload](01-map-data-out-of-payload.md)    | first load on holiday Wi-Fi         | M      | 00 for complete data | [done](https://github.com/mdugue/alpen/pull/14)        |
| 03  | [Make the period the hero](03-period-hero.md)                         | "when"                              | M      | –                    | [done](https://github.com/mdugue/alpen/pull/4)         |
| 04  | [Climate-aware status](04-climate-aware-status.md)                    | "when", honesty                     | S–M    | –                    | [done](https://github.com/mdugue/alpen/pull/4)         |
| 12  | [Destinations](12-destinations.md)                                    | "where"                             | L      | 09                   | proposed                                               |
| 13  | [Summer axis](13-summer-axis.md)                                      | "when" in summer, honesty           | M–L    | 04                   | [done](https://github.com/mdugue/alpen/pull/17)        |
| 05  | [Filters and search](05-filters-and-search.md)                        | finding things                      | S–M    | –                    | [done](https://github.com/mdugue/alpen/pull/9)         |
| 02  | [Real routes instead of the hash](02-real-routes.md)                  | sharing, back button, SEO           | L      | 01                   | proposed                                               |
| 06  | [A basemap that matches the theme](06-basemap.md)                     | dark mode, map quality              | M      | –                    | [done](https://github.com/mdugue/alpen/pull/22)        |
| 09  | [Schema validation with zod](09-schema-validation.md)                 | data safety                         | S      | –                    | [done](https://github.com/mdugue/alpen/pull/9)         |
| 10  | [Tests](10-tests.md)                                                  | refactor safety                     | M      | –                    | [done](https://github.com/mdugue/alpen/pull/4)         |
| 11  | [Smaller items](11-smaller-items.md)                                  | polish                              | S each | varies               | [in progress](https://github.com/mdugue/alpen/pull/16) |
| 08  | [English toggle](08-english-toggle.md)                                | audience                            | M–L    | 02                   | proposed                                               |
| 07  | [Profile interactivity](07-profile-interactivity.md)                  | detail, low priority now            | S–M    | –                    | [done](https://github.com/mdugue/alpen/pull/11)        |
| 14  | [Road types and tags](14-road-types-and-tags.md)                      | roads that are not passes           | L      | 09, 05               | [in progress](https://github.com/mdugue/alpen/pull/33) |
| 15  | [The year of a pass, computed once](15-pass-year.md)                  | compute, one series for all readers | S–M    | 13                   | [done](https://github.com/mdugue/alpen/pull/39)        |
| 16  | [One status vocabulary](16-status-vocabulary.md)                      | honesty, one home for the words     | M      | 15                   | [in progress](https://github.com/mdugue/alpen/pull/40) |
| 17  | [Detail panel per kind](17-detail-panel-per-kind.md)                  | testable panel, 02 and 12           | M      | 15, 16               | proposed                                               |
| 18  | [Selection, visibility and camera](18-selection-visibility-camera.md) | one rule, 02 as adapter             | M      | –                    | proposed                                               |
| 19  | [A map scene between the rows and MapLibre](19-map-scene.md)          | map testable without WebGL          | M–L    | 18, 01               | proposed                                               |
| 20  | [The gate's decisions out of the build script](20-route-decisions.md) | pipeline testable, one retry rule   | M–L    | 00                   | proposed                                               |
| 21  | [One adapter per external host](21-host-adapters.md)                  | offline pipeline test               | M      | 20                   | proposed                                               |
| 22  | [Detail data out of the payload](22-detail-data-out-of-payload.md)    | first load, free-tier headroom      | S–M    | 01                   | done                                                   |
| 23  | [Low southern regions](23-low-southern-regions.md)                    | "when" in spring and autumn         | L      | 14                   | in progress                                            |
| 24  | [Depth per destination](24-depth-per-destination.md)                  | "where", honest counts, readability | M      | 00                   | in progress                                            |
| 25  | [Vosges and Jura](25-vosges-and-jura.md)                              | the weekend, a second range         | M–L    | 09, 05               | proposed                                               |
| 26  | [Pyrenees](26-pyrenees.md)                                            | the Tour's other mountains          | M–L    | 25, 24               | proposed                                               |
| 27  | [Gravel](27-gravel.md)                                                | a second discipline                 | L–XL   | 14, 16, 13           | proposed                                               |
| –   | UI/UX audit round (no plan document)                                  | "where", finding things, a11y       | M      | –                    | [in progress](https://github.com/mdugue/alpen/pull/47) |

Effort: S ≤ 1 day, M 2–3 days, L 4–6 days. 09, 10 and 11 can be interleaved
with anything; do 09 before 12 so the new entity gets a schema from day one.

Plans 15–21 came out of an architecture review (September 2026). They add no
feature; each turns a shallow module into a deep one so that the feature plans
after them land in one place and can be tested through one interface. They
form three independent chains and can run in parallel: **15 → 16 → 17** in the
app (the status series, its words, the panel), **18 → 19** on the map (what is
shown, the scene) and **20 → 21** in the pipeline (the gate's decisions, the
hosts). Within a chain a later plan assumes the earlier one is done and is
written smaller because of it. 15 and 16 are done, so 17 is the next one in
that chain; 18 and 20 head the other two and depend on nothing that is open.

## The audit round (PR #47)

One round came out of a UI/UX audit rather than a plan, and it takes ground
from two plans that are still open. It is recorded here so the table above is
not read as the whole picture:

- **12 (Destinations)** is partly answered. A town now carries a verdict for
  the chosen half-month, its own derived 24 cells and a list of the passes it
  reaches, ranked and grouped by reach band (`lib/destination.ts`,
  `docs/scales.md`); a pass carries the inverse, "Orte als Standort". What
  plan 12 still holds is the destination as a _first-class entity_ with its
  own data file and its own place in the search and the filters — none of that
  is in PR #47, which derives everything from the towns and passes that
  already exist.
- **17 (Detail panel per kind)** is not done and is not made harder. The panel
  gained two blocks and a shared hover, all through the existing props; the
  split into one component per kind that plan 17 asks for is untouched.

The round also replaced the single 60 km radius with three named reach bands
and a smooth nearness weight (`lib/geo.ts`), which every "im Umkreis" feature
now shares. Anything later that asks "what is near here" should use those
rather than reintroduce a radius.

## The region and discipline plans (23–27)

Plans 23 to 27 came out of a product conversation (September 2026) about
where the app should grow: more depth in the south, more depth everywhere,
ranges beyond the Alps, and a second discipline. They are mostly curation
with a small mechanism each, and the mechanisms nest: **24** gives the
measure (a coverage report per base) that **23**, **25** and **26** curate
against; **25** builds the range vocabulary and the "Gebirge" chip that
**26** reuses with bounds per range; **27** is independent of the four and
waits for 14 and 16. 23 can start now and 24's code is small enough to run
alongside it; 25 before 26; 27 whenever 14 is done. The idea that did not
become a plan – questions in natural language, an agent – is written up in
[`docs/roadmap.md`](../roadmap.md) §4 with what is decided, what is open
and the spike that turns it into a plan.

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
  (`docs/data-pipeline.md`, `docs/data-model.md`, `docs/scales.md`,
  `docs/ui-conventions.md`, `docs/map-rendering.md`, `docs/architecture.md`,
  README, a skill), so the docs show the mechanism and not only the API. Each
  plan's "Documentation" step says where. `AGENTS.md` is the index: a new rule
  gets its one-line entry there and its reasoning in the document it belongs
  to, not a second copy.
