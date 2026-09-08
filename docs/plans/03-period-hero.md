# 03 · Make the period the hero

**Status:** in progress ([PR #4](https://github.com/mdugue/alpen/pull/4)) · **Effort:** M · **Depends on:** – (04 makes the strips
more truthful, 12 adds destination strips) · **Unblocks:** the "when" half of
the product goal

## Goal

The half-month becomes the primary control and the primary visual: it defaults
to today, remembers the user's choice, is shown as a scrubber with a histogram
of what is rideable, and every list row carries a 24-cell season strip so the
answer to "when" is visible without clicking.

## Why now

- `DEFAULT_FILTERS.period` is hard-coded to early October, so the first screen
  answers a question nobody asked in March.
- The period is the app's most interesting dimension and the only one that
  makes it different from a pass list on quaeldich. Today it hides in a native
  select with two arrows.
- Holiday planning is "compare weeks", not "pick one week": a row-level strip
  answers "is late September still fine?" for 92 passes at a glance.

## Non-goals

Changing the status heuristic itself (plan 04). Region-level aggregation
(plan 12 reuses the strip component).

## The mechanism in one picture

Where the period comes from:

```
hash t=…  ───────────────► present? ── yes ──► use it, never store it (someone else's link)
                               │ no
localStorage alpenpaesse:period ► present? ── yes ──► use it (the visitor's last choice)
                               │ no
today's half-month, computed on the server in Europe/Berlin (prerendered, revalidated every 15 min)
```

Before and after, on the map and in a row:

```
before   ◀  Anfang Oktober ▾  ▶                     Col du Galibier   2.642 m
                                                     Westalpen · FR   ● wetterabhängig

after    ◀  J  F  M  A  M  J  J  A  S  O  N  D  ▶   Col du Galibier   2.642 m
            ░░ ░░ ░░ ░░ ░▒ ▒▓ ▓▓ ▓▓ ▓▓ ▓▒ ▒░ ░░      Westalpen · FR   ░░░░░░░░░░▒▓▓▓▓▓▓▓▒▒░░░░
            ─────────────────────────●───────                          24 cells, current one outlined
            stacked bars: open / risky / closed      "heute" tick, thumb on "Anfang Oktober"
            among the passes matching the filters
```

## Design

### Part A: default to today, remember the choice

Precedence: hash `t` (shared link) → `localStorage` `alpenpaesse:period`
(the user's own last choice) → today's half-month.

- Server: `app/page.tsx` computes `todayPeriod()` in `Europe/Berlin`
  (day ≤ 15 → `month`, else `month + 0.5`) and passes it as `defaultPeriod`.
  The page is `"use cache"` with the default 15-minute revalidation, so the
  prerendered HTML is never more than 15 minutes behind the calendar. This
  keeps the first paint free of the "October flash" that a client-only
  default would cause.
- Client: in the existing hash effect in `components/explorer.tsx`, apply
  `localStorage` only when the hash has no `t`. Writing to `localStorage`
  happens in the period control's `onChange`, never when a hash is applied,
  so opening someone else's link does not overwrite your preference.
- `useStored` already exists; add `useStoredPeriod()` next to `useFavorites`.

### Part B: season strip in rows

`components/season-strip.tsx`:

```tsx
<SeasonStrip statuses={Status[24]} current={period} size="row" | "panel" />
```

24 cells (row: 4 × 8 px, panel: 12 × 14 px with month initials), coloured by
`--status-*` tokens, closed cells hollow like the map circles, the current
half-month outlined with `--foreground`. `aria-label` summarises: "Saison:
meist offen Anfang Juni bis Ende September, wetterabhängig bis Ende Oktober".
`passStatus` is O(1); 92 × 24 evaluations per render are negligible, and the
React Compiler memoises per row.

Placement: pass rows (right column, under the elevation) and tour rows; the
detail panel head gets the panel size with month labels, replacing nothing
(the `seasonText` sentence stays as prose).

### Part C: the scrubber

`components/map/period-scrubber.tsx` replaces `period-control.tsx`:

- 24 stops, month initials below, "heute" marker, the current label
  ("Anfang Oktober") above the thumb.
- Behind the stops a stacked bar per half-month: counts of open / risky /
  closed among the passes that match the current search, fame and elevation
  filters (the status filter is deliberately ignored, otherwise the histogram
  hides the alternatives). Add `statusHistogram(passes, filters)` to
  `lib/rows.ts`.
- Interaction: click, drag, touch, keyboard arrows (`role="slider"`,
  `aria-valuetext`), plus the two stepper buttons for one-handed phone use.
- Width: 24 × 12 px = 288 px, fits the phone top bar; on desktop it sits where
  the control sits today.

### Part D: URL and sharing

Unchanged: `t` in the hash. With plan 02 the hash is still the carrier.

## Steps

1. Part A (one PR, small): `todayPeriod()`, `defaultPeriod` prop, precedence
   in the hash effect, `useStoredPeriod`, tests for precedence (plan 10).
2. Part B (one PR): `SeasonStrip`, wire into rows and panel, screenshot.
3. Part C (one PR): scrubber component, histogram helper, delete
   `period-control.tsx`, update `AGENTS.md` ("Period control" row).

### Documentation

The precedence diagram goes into `docs/data-model.md` next to "Time
reckoning"; the row/scrubber sketch goes into the `AGENTS.md` layout
convention ("Only the period control and three map tools float over the map"
needs rewording once the scrubber lands).

## Acceptance criteria

- A fresh visitor in the second half of May sees "Ende Mai" and the list
  coloured for it, with no visible flash of another period.
- Changing the period, reloading, and opening the site next week shows the
  chosen period; opening a shared link with `t=7` shows early July without
  changing the stored preference.
- Every pass and tour row shows a strip; the current cell matches the badge.
- The scrubber is operable by keyboard alone and announces the label.
- `docs/data-model.md` explains the precedence with the diagram.

## Risks and open questions

- Server "today" vs. the user's timezone: half-month boundaries make a one-day
  offset irrelevant; document it.
- Colour-only strips fail colour-blind users: hollow cells for closed and the
  outlined current cell carry the information without hue, as on the map.
- The histogram counts change with search and filters; make sure the empty
  state ("keine Pässe") does not collapse the control.
