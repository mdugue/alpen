# Roadmap

What lies beyond the implementation plans in [`docs/plans/`](./plans/README.md).
The plans cover the next several months; this file keeps the longer list,
re-sorted for the product goal (destination finding, not route planning).

## 1. Official live closure status

Replaces the heuristic wherever real data is available; the climate-aware
heuristic (plan 04) stays as the fallback.

- Sources: South Tyrol (Open Data Hub, JSON, clean), Trentino (HTML),
  alpen-paesse.ch or TCS (HTML), Bison Futé and departmental sites (HTML),
  ÖAMTC/ASFINAG (JSON behind an app API). None of them allow direct access from
  the browser (no CORS).
- Implementation: a step in `scripts/build-data.ts` or a dedicated cron job
  that writes normalized data hourly to
  `data/generated/closures.json`: `{ [passSlug]: { state, since, source, url } }`.
  On Vercel as a Cron Function (`vercel.json` → `crons`) plus
  `revalidateTag("closures")`.
- A layer in front of `lib/status.ts`: if a current entry exists, it wins;
  otherwise the heuristic applies. Show the provenance in the detail panel.
- Effort: an afternoon for South Tyrol, one to two hours per additional source,
  ongoing maintenance because HTML pages change.

## 2. More regions, then more destinations

Pyrenees, Massif Central, Jura, Vosges, more Dolomites. Purely additive: new
entries in `data/passes.json` and `data/destinations.json` (plan 12), then
`data:build`. From roughly 300 passes on, split the JSON files by region;
the region vocabulary (`lib/regions.ts`, plan 05) and destinations (plan 12)
already give the UI the structure for it.

## 3. Multi-day trips between destinations

Once destinations exist: a stage view that chains destinations ("Oisans →
Maurienne → Susa, 4 days, which passes on the way"), with overnight towns and
the season strip per stage. Rough, not routed: the stages are lines between
base towns, the passes in between come from the destination membership.

## 4. Traffic from data instead of gut feeling

Overpass query along the routed ascent: share of road classes
(`trunk`/`primary`/`secondary`/`tertiary`/`unclassified`) plus
`motor_vehicle=no`. Yields a computed value per ascent; the editorial estimate
remains as a correction. Runs in `data:build`, costs nothing.

## 5. Difficulty from the profile

`profiles.json` contains everything needed: length, average gradient, steep
sections, summit elevation. A climbbybike-style formula replaces the estimate;
the editorial number can stay as "character". Show both, as the scales dialog
promises honesty.

## 6. Ridden passes

GPX/FIT upload or Strava integration, matching against pass coordinates,
checkmarks in the lists, filter "still open and not yet ridden". The favorites
infrastructure in `lib/app-state.ts` is the template. Fits the destination
goal ("where are the passes we have not done yet").

## 7. Deliberately parked

- **Custom tour building and GPX export.** Route planning is what Komoot and
  Strava are for; the app links to them from every pass. Revisit only if
  users ask for "the ascent as a file" specifically.
- **Offline tiles / service worker.** Planning happens at home; the app is
  not for on-the-bike use.

## 8. Smaller ideas

- Imagery per pass (own photos or Wikimedia with license attribution).
- Weather for tours and towns, not only passes.
- Print / PDF summary of a destination for the kitchen table.
