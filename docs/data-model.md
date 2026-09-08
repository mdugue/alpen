# Data model

All types live in [`lib/types.ts`](../lib/types.ts). Source data is maintained
by hand; derived data comes from `scripts/build-data.ts`.

## Source data (hand-maintained)

### `data/passes.json`

```jsonc
{
  "slug": "col-du-galibier", // stable, derived from the name; umlauts → ae/oe/ue
  "name": "Col du Galibier",
  "country": "FR", // "CH/IT" for border passes
  "region": "Westalpen", // Westalpen | Zentralalpen | Ostalpen | Dolomiten
  "lat": 45.064,
  "lon": 6.408,
  "elevation": 2642,
  "classicAscent": "18 km, 6,9 % ab Valloire (34 km via Télégraphe)",
  "beauty": 5,
  "fame": 5,
  "difficulty": 5,
  "traffic": 2, // 1–5, see scales.md
  "season": { "opens": 6, "closes": 10.5 }, // half-months; null = cleared year-round
  "note": "…", // one or two sentences of editorial commentary
  "ascents": [
    { "from": { "lat": 45.165, "lon": 6.43 }, "label": "Valloire (Nord)" },
  ],
}
```

`season.maintained: true` marks managed toll roads (Grossglockner, Timmelsjoch,
Nockalm …). They are cleared of snow and therefore get no elevation penalty in
the status heuristic.

**Time reckoning:** A `Period` is a half-month. `10` = early October,
`10.5` = late October. `PERIODS` in `lib/status.ts` lists all 24.

Which half-month the app shows is decided in this order:

```
hash t=…  ───────────────► present? ── yes ──► use it, never store it (someone else's link)
                               │ no
localStorage alpenpaesse:period ► present? ── yes ──► use it (the visitor's last choice)
                               │ no
today's half-month, computed on the server in Europe/Berlin (prerendered, revalidated every 15 min)
```

`todayPeriod()` reads the calendar in `Europe/Berlin`; because a half-month is
15 days wide, a visitor in another timezone is at most one day off at a
boundary, which never changes the bucket by more than that day. Only the
period control writes to `localStorage`, so opening a shared link never
overwrites the visitor's own preference.

### `data/tours.json`

`passes` contains pass **slugs**; the tour status is computed from them as the
worst status among the passes involved. `waypoints` are rough anchor points
that routing connects into a line.

### `data/towns.json`

Towns with road-cycling infrastructure (workshops, rentals, bike hotels). `why`
is a single sentence naming the surrounding passes and the infrastructure.

## Derived data (`bun run data:build`)

| File            | Key                                       | Contents                                                           |
| --------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `routes.json`   | `<pass-slug>:<index>`, `tour:<tour-slug>` | Road geometry as `[lat, lon][]`                                    |
| `profiles.json` | `<pass-slug>:<index>`                     | km, elevation gain, average gradient, anchor points                |
| `climate.json`  | `<pass-slug>`                             | 24 half-months with average temperatures and frost/snow/rain share |

These files belong in the repo. They only change when passes or ascents are
added – the script skips everything that already exists. Because Open-Meteo
bills a profile as ≈100 and a climate series as ≈261 "calls" against a free
tier of 10,000/day, a larger backlog is drained over several runs
(`OPEN_METEO_BUDGET`, twice-daily `refresh-data.yml`). `bun run data:build
--status` shows the backlog and its cost.

## Adding a pass

1. Add an entry to `data/passes.json` (slug following the same pattern).
2. `bun run data:build` – fetches only the new routes, profiles and the climate series.
3. `bun run data:check` – validates references, value ranges and completeness.
