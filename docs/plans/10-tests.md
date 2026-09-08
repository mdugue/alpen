# 10 · Tests

**Status:** done ([PR #4](https://github.com/mdugue/alpen/pull/4)) · **Effort:** M · **Depends on:** – · **Unblocks:** every
refactor above; especially 01, 02 and 04

## Goal

Pure logic is covered by fast unit tests, the data pipeline's validators are
tested against the known-bad fixtures, and a small end-to-end suite guards
selection, filters, hash restore and the mobile sheet. All of it runs in CI.

## Why now

There are no tests. The status heuristic, hash parsing and row building are
pure functions that invite tests, and the plans above change all of them.

## Non-goals

Visual regression across the full map (tiles vary); coverage targets.

## Design

### Unit tests (`bun test`)

Files next to the code: `lib/status.test.ts`, `lib/app-state.test.ts`,
`lib/rows.test.ts`, `lib/search.test.ts` (plan 05), `scripts/lib/validate.test.ts`
(plan 00).

- `passStatus`: a truth table from `docs/scales.md`: no season × altitude ×
  period; season window edges; `maintained`; with plan 04 the climate cases.
- Status matrix snapshot: `passStatus` for all passes × 24 periods stored as a
  bun snapshot. When plan 04 changes the heuristic, the snapshot diff is the
  review artefact.
- `periodIndex` / `periodLabel` / `PERIODS` round trip.
- Hash: refactor `readHash` into `parseHash(hash: string)` and `writeHash` into
  `serializeHash(...)` (pure), keep thin `window` wrappers. Test round trips,
  legacy `s=openRisky`, unknown keys ignored, precedence with defaults.
- Rows: filtering by each field, sort stability, tour status derivation,
  histogram (plan 03).
- Validators: the 11 known-bad routes as fixtures must be rejected, three good
  ones accepted.

Small refactors needed: `readHash` currently reads `window` directly;
`tourStatus` should take a `Map<string, Pass>`.

### End-to-end (`bun test` + `Bun.WebView`)

Bun 1.4 ships `Bun.WebView` (experimental): a headless browser with
`navigate`, `click`, `type`, `press`, `evaluate`, `screenshot` and raw
DevTools Protocol access, using an installed Chrome (or the system WebKit on
macOS) and no npm dependency. The `preview-app` skill's screenshot script
already runs on it. Write the e2e suite with it inside `bun test`
(`e2e/*.test.ts`), so unit and browser tests share one runner and CI needs
only a Chrome.

A `test/browser.ts` helper wraps the boilerplate: start `next start` once per
run (or reuse a running server via `BASE_URL`), open a view with cleared
storage, route external tile, DEM and glyph requests to fixtures (a 1×1 PNG,
an empty PBF) through the `Fetch` domain so runs are hermetic and fast, and
expose `waitFor(selector)` built on `evaluate`.

Scenarios:

1. Loads; the pass section shows 92; the map canvas exists.
2. Click a pass row → detail panel with the name; hash carries `pass=`
   (path with plan 02); Escape closes it and focus returns to the row.
3. Open `#pass=col-du-galibier&t=6&z=9&c=45.06,6.41` → panel, "Anfang Juni",
   camera applied (read `map.getZoom()` via `evaluate` on a test hook).
4. Status filter → counts change; reset link restores.
5. Search "galibier" → one pass; with plan 05 also "grossglockner".
6. Mobile viewport 390 × 844 with touch emulation: peek row visible, tap the
   handle → list; select → half sheet with detail; "Liste" goes back.
7. Keyboard: Tab to the first row, Enter opens, Escape closes.
8. Period control: stepper and select change the label and the badge.

Expose a tiny test hook in development/test builds only:
`window.__alpen = { map }` set in `pass-map.tsx` when
`process.env.NEXT_PUBLIC_TEST_HOOKS === "1"`.

Fallback: if `Bun.WebView` turns out too immature for the suite (flaky
actionability waits, missing events), switch the helper to
`@playwright/test` with the same scenarios. Keep the scenarios independent
of the driver so that swap stays cheap.

### CI

`.github/workflows/ci.yml`: add `bun test` after `typecheck` for the unit
tests, and an `e2e` job after `build` that installs Chromium
(`sudo apt-get install -y chromium-browser` or the `browser-actions/setup-chrome`
action) and runs `bun test e2e`. Upload the failure screenshots the helper
writes as an artefact.

## Steps

1. Pure-function refactors (`parseHash`, `serializeHash`, `indexBySlug`).
2. Unit tests + status snapshot; `bun test` in CI.
3. `test/browser.ts` helper on `Bun.WebView` with tile fixtures and the test
   hook; scenarios 1–4.
4. Scenarios 5–8; CI job with report upload.
5. Add "run `bun test` and `bun run e2e`" to the pre-PR checklist in `AGENTS.md`.

## Acceptance criteria

- `bun test` runs in under 5 seconds locally.
- The e2e suite runs in under 3 minutes in CI and passes on a fresh clone
  with nothing installed beyond Bun and a Chrome.
- A change to `passStatus` that alters any verdict shows up as a snapshot
  diff.
