# Roadmap

Sorted by effort-to-benefit ratio. Each item states concretely what needs to be done.

## 1. Official live closure status

Replaces the heuristic wherever real data is available.

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

## 2. Traffic from data instead of gut feeling

Overpass query along the routed ascent: share of road classes
(`trunk`/`primary`/`secondary`/`tertiary`/`unclassified`) plus
`motor_vehicle=no`. Yields a computed value per ascent; the editorial estimate
remains as a correction. Runs in `data:build`, costs nothing.

## 3. Difficulty from the profile

`profiles.json` contains everything needed: length, average gradient, steep
sections, summit elevation. A climbbybike-style formula replaces the estimate;
the editorial number can stay as "character".

## 4. Build and export custom tours

Click passes in order → route via OpenRouteService → km, elevation gain, profile →
GPX export for Garmin/Wahoo. Needs a server route for the routing (key stays
server-side) and a `use cache` entry per waypoint sequence.

## 5. Ridden passes

GPX/FIT upload or Strava integration, matching against pass coordinates,
checkmarks in the table, filter "still open and not yet ridden". The favorites
infrastructure in `lib/app-state.ts` is the template.

## 6. More regions

Pyrenees, Massif Central, Jura, Vosges, Dolomites additions. Purely additive:
new entries in `data/passes.json`, then run `data:build`. From roughly 300
passes on, splitting the JSON files by region and adding a region filter
becomes worthwhile.

## 7. Smaller improvements

- Offline capability: service worker plus pre-cached tiles for a region.
- Imagery per pass (own photos or Wikimedia with license attribution).
- Stage planner for multi-day tours with overnight locations.
- Sort and filter state in the URL hash as well.
- E2E tests (Playwright) for selection, filters and hash restoration.
