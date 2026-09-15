# 15 · The year of a pass, computed once

**Status:** [done](https://github.com/mdugue/alpen/pull/39) ·
**Effort:** S–M · **Depends on:** 13 (the reason ladder, the best window) ·
**Unblocks:** 16, 17; 12 (a destination score reads the same series instead of
running the verdict again)

## Goal

One value per pass and per tour says what its year looks like: 24 cells, each
with the status, the reasons in ladder order and the grade the strip paints.
It is computed once on the server, next to `getValleys`, and the rows, the
histogram, the strip, the badge and the panel read it. Nothing on the client
runs the verdict to find out what a strip should look like.

## Why now

The year of a pass depends on the pass, its climate series and its valley
elevation – all static, build-time data. Today it is recomputed by six series
builders at four call sites on every render of `Explorer`, which re-renders on
every filter change, including each search keystroke:

| Where                                    | Per pass                                                        | Calls of `passVerdict` |
| ---------------------------------------- | --------------------------------------------------------------- | ---------------------- |
| `buildPassRows` (rows.ts:154-160)        | 1 + `passGrades` (= `bestPeriods` 24 + `passSeason` 24)         | 49                     |
| `statusHistogram` (rows.ts:270)          | `passGrades` again                                              | 48                     |
| `buildTourRows` → `tourGrades`           | `passGrades` per member pass                                    | 48 × 34 memberships    |
| `DetailPanel` (detail-panel.tsx:265-275) | verdict, reasons, best window, grades, notes, each from scratch | ≈ 100                  |

201 passes × ≈ 97 ≈ **21 000 verdicts per keystroke**, each one running the
sunrise trigonometry in `lib/daylight.ts`, to produce 24 grades per pass that
never change. The row and the panel compute the same year through two
different call chains, so nothing guarantees they agree. Principle 1 in
`AGENTS.md` says derived data is precomputed; this is the most-computed
derivation in the app and it is recomputed in the browser.

## Non-goals

No change to the verdict, the thresholds, the ladder or the strip's look. No
new file in `data/generated/`: the series depends on the constants in
`lib/status.ts` and, later, on the live closure layer from `docs/roadmap.md`,
so it belongs in a cached getter that revalidates with the build, not in a
committed file. `climate` still reaches the client: the chart draws it and the
summer filters read the raw signals for the chosen half-month.

## The mechanism in one picture

### Before

```mermaid
flowchart TD
  R["Explorer render<br/>every filter change, each keystroke"] --> PR["buildPassRows"]
  R --> H["statusHistogram"]
  R --> TR["buildTourRows"]
  R --> DP["DetailPanel"]
  PR -->|"201 ×"| G1["passGrades"]
  H -->|"201 ×"| G2["passGrades, again"]
  TR -->|"34 ×"| G3["passGrades, per member"]
  G1 & G2 & G3 --> B["bestPeriods · 24 × passVerdict"]
  G1 & G2 & G3 --> S["passSeason · 24 × passVerdict"]
  DP --> D1["passVerdict · verdictReasons · bestPeriods<br/>passGrades · passCellNotes"]
```

### After

```mermaid
flowchart LR
  D["passes.json · climate.json · valleys"] --> Y["getYears() · lib/data.ts<br/>24 cells per pass and tour<br/>status · reasons · grade · best window<br/>computed at prerender"]
  Y --> A["row: cells at the chosen half-month"]
  Y --> B["histogram: sum of grades"]
  Y --> C["strip: grades and notes"]
  Y --> E["badge: the first reason's word"]
  Y --> F["panel: best window, sentences"]
```

## Design

### The value

```ts
/** One half-month of one pass or tour; index 0 = early January. */
interface YearCell {
  status: Status;
  grade: Grade; // status split by the best window, what the strip paints
  reasons: StatusReason[]; // ladder order, empty when nothing fired
  snowy: boolean; // ≥ SNOW_BEST_PCT, the "es schneit gelegentlich" note
}
interface Year {
  cells: YearCell[]; // 24
  best: [Period, Period] | null; // the longest quiet run, as today
}
interface Years {
  passes: Record<string, Year>; // by pass slug
  tours: Record<string, Year>; // by tour slug, worst-of per cell
}
```

`passYear(pass, signals)` in `lib/status.ts` is the one pure builder; it
absorbs `passSeason`, `passGrades`, `passCellNotes` and `bestPeriods`, which
stop being exported. `tourYear(tour, passYears)` takes the worst status and
the lowest grade per cell over the member passes, as `tourGrades` does today.
`passVerdict` itself is untouched: it stays the replaceable layer for the
official closure status.

### Where it is computed

`getYears()` in `lib/data.ts`, `"use cache"`, the same shape as `getValleys`.
`app/page.tsx` awaits it with the others and `Explorer` receives `years`.

### Who reads it

- `lib/rows.ts`: `status`, `reason` and `season` of a row come from
  `years.passes[slug]`; `statusHistogram` sums `cells[i].grade`. The filters
  on raw signals (`passMatches`) are unchanged.
- `SeasonStrip` takes `cells` instead of `grades` plus `notes`.
- `StatusBadge` takes the cell.
- `DetailPanel` reads `best`, the cells and the reasons from the year and
  keeps `climate` for the numbers in the sentences and for the chart. Plan 17
  restructures the panel; here it only stops recomputing.

### Live closures later

Roadmap item 1 puts a closure layer in front of `passVerdict`. With this plan
that layer changes one getter's `cacheLife`; no reader changes.

## Steps

1. **Builders.** `passYear`, `tourYear` and their types in `lib/status.ts`.
   Tests: the 24-status snapshot in `status.test.ts` moves onto `passYear`
   unchanged; a tour's cell is the worst of its passes; `grade` equals
   `gradeOf(status, inBest)` for every cell.
2. **Getter and readers.** `getYears` in `lib/data.ts`, the prop through
   `page.tsx` and `Explorer`; rows, histogram, strip and badge read the year.
   Delete the old exports; `rows.test.ts` builds its expectations from
   `passYear` fixtures.
3. **Panel.** `DetailPanel` reads the year for what it shows and calls
   `passVerdict` nowhere.
4. **Measure.** Count `passVerdict` calls per search keystroke before and
   after (a `console.count` in dev, or a spy in a test over the real data)
   and put both numbers in the PR.

### Documentation

`docs/data-model.md` "Derived data": a row for the year, marked "at
prerender, not a file". `AGENTS.md` "Where things live": the rideability row
names `passYear`. `docs/scales.md` "Status per period": one sentence that the
series is computed once on the server.

## Acceptance criteria

- No module under `components/` imports `passSeason`, `passGrades`,
  `passCellNotes`, `bestPeriods`, `tourGrades` or `tourCellNotes`; they no
  longer exist.
- A search keystroke runs zero `passVerdict` calls on the client (before:
  ≈ 21 000), recorded with the command used.
- A test asserts that the row, the histogram and the strip of one pass read
  the same `Year` object.
- The 24-status snapshot passes unchanged; `bun run e2e` unchanged;
  screenshots of a list, the scrubber and a detail identical to before.

## What it measured

| Per search keystroke, in the browser         | Before | After |
| -------------------------------------------- | ------ | ----- |
| rows + histogram                             | 16 699 | 0     |
| the same plus one `facetCount` per chip (24) | 20 467 | 0     |

The server runs 4 824 verdicts once at prerender (201 passes × 24
half-months).

To re-run it, put a counter at the top of `passVerdict` in `lib/status.ts`:

```ts
globalThis.__verdicts = (globalThis.__verdicts ?? 0) + 1;
```

then, in a throwaway script under `scripts/`, call exactly what `Explorer`
calls per render over the real `passes.json` and `climate.json` –
`buildPassRows`, `buildTourRows`, `buildTownRows`, `statusHistogram`, and
`facetCount` once per filter chip – resetting the counter after the years are
built so the server's share is not counted with the client's. The "before"
column is the same script against `main`, where the builders take no `years`
argument (`git worktree add … origin/main`).

## Risks and open questions

- **Payload – measured, and left plain.** 201 passes × 24 cells are 394 KB of
  JSON, more than the 150–200 KB estimated here, but **8.4 KB gzipped** against
  `climate.json`'s 41.8 KB: the cells repeat, so they compress about five times
  better than the series they come from. The compact encoding this section held
  in reserve (status and grade as small integers, reasons as ladder indices)
  would buy nothing over the wire and cost a decode step, so the cells ship as
  they are.
- **Valleys.** The summer filters derive the valley temperature for the
  chosen half-month on the client, so `valleys` stays a prop, as does
  `climate` – the chart draws it and `withinLimits` reads the raw signals.
  When the cell carries the derived number, the filter can read it and
  `valleys` goes.
- **Tours** with a member the year does not know (a slug typo) read the
  `UNHELD` cell; `data:check` already rejects that, so it stayed a type
  question.

## What it changed for a reader

Every one of the 201 passes comes out bit-identical to before: over all 5 040
cells, **zero** differences in status, reasons, grade or the best window
(dumped from both branches and diffed; the 24-status snapshot in
`status.test.ts` also passes unchanged). No pass cell moves.

Nine **tour** cells changed, each time because two rules that used to answer
for one cell now answer as one.

**Two of them change colour.** A pass's best window has to last at least two
half-months – "nothing worth calling a best time" – and its cells are graded
from that window. A tour had no window of its own: its grades were the minimum
over its members, so where two members' best windows overlapped in a single
half-month, that cell was painted "beste Zeit" although the same rule applied
to a pass would have refused. `tourYear` now takes the window first and grades
from it, exactly as `passYear` does, which drops that lone cell to "gut" on the
Route des Grandes Alpes and the Gavia–Mortirolo-Runde. It also repairs an
invariant the first cut of this plan broke: both tours carried `best: null`
while a cell of theirs read "beste Zeit", and plans 12, 16 and 17 are all
written to read `Year.best`.

**The other seven change the sentence in the strip's popover.** That is the disagreement this plan was written to remove, caught in
the act. A tour cell used to be assembled from two rules – the word next to the
dot came from `tourVerdict`, which picks the member pass whose first reason
ranks earliest on the ladder, while the strip's note came from
`tourCellNotes`, which picks by grade alone and therefore, among equally
limited passes, took whichever slug `tours.json` happened to list first. So a
tour cell could read "eingeschränkt: Randzeit" with a popover explaining the
snowfall of a different pass, and which pass that was depended on the order of
an array. `tourYear` takes one cell whole, so the note now names the same
caveat the word does. `status`, `grade` and the strip's colours are untouched,
which is why the non-goal "no change to the strip's look" holds: the two
recoloured cells are the strip obeying a rule `docs/scales.md` already states,
not a change to what the strip means.

## What it changed beyond the plan

`tourVerdict` and `tourStatus` went with the rest. The plan kept them, but
`tourYear` subsumes both: it picks the member pass by grade, and since a grade
is the status refined by the best window, the lowest grade is always the worst
status too. Keeping a second rule for "what is this tour's status" is the
duplication this plan exists to remove. `verdictReasons` became `reasonTexts`
for the same reason – it ran the verdict again only to read the reasons back,
which the cell already carries.
