# Alpenpässe – Road cycling map

Rough orientation for road cycling routes in the Alps: 92 passes with ascents
and elevation profiles, 9 loop tours, 26 cycling towns – each with a
rideability estimate for a freely chosen half-month, a weather forecast and a
climate series at the summit, in 2D and 3D. The UI is in German.

## Quick start

```bash
bun install
bun run data:build        # once: precompute routes, elevation profiles, climate
bun dev
```

Without `data:build` the app still starts; only the drawn roads, the profiles
and the climate series are missing.

## Commands

| Command | Purpose |
| --- | --- |
| `bun dev` | Development server |
| `bun run build` / `bun start` | Production build and server |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint (incl. React Compiler rules) |
| `bun run data:build` | Fetch routes, elevation profiles, climate → `data/generated/` (resumable) |
| `bun run data:build --status` | Show what is still missing and what it costs in Open-Meteo calls |
| `bun run data:check` | Validate references and completeness of the data |
| `bun run ui:init` / `bun run ui:add` | (Re)install the shadcn "mira" preset and components |

## Architecture in three sentences

All content data lives as JSON in the repo (`data/`), is imported at build
time and served through `"use cache"` in `lib/data.ts` as cached segments –
the start page is therefore fully prerendered. The only dynamic source is the
weather forecast; it goes through `app/api/weather/[slug]/route.ts` with its
own cache lifetime so Open-Meteo is queried once per pass and half hour
instead of once per visitor. All interaction state lives in one client
component (`components/explorer.tsx`) and is mirrored into the URL hash, so
every view is shareable.

```
app/            layout, start page, weather route
components/     explorer (state) · map (MapLibre) · sidebar (lists, filters) · panel (detail) · ui (shadcn)
data/           passes.json, tours.json, towns.json  ← source data, hand-maintained
data/generated/ routes.json, profiles.json, climate.json  ← from data:build, committed
lib/            types, data access, status heuristic, state hooks
scripts/        build-data.ts (precomputation), check-data.ts (validation)
docs/           scales, data model, roadmap
```

More in [`AGENTS.md`](./AGENTS.md) and [`docs/`](./docs).

## Environment variables

See `.env.example`. None of them is required to start the app.

- `ORS_KEY` – only for `data:build`. Without the key the script routes via the
  public OSRM demo server using the **car profile**; with the key it uses the
  OpenRouteService **road-cycling profile**, which correctly handles the
  Tremola cobbles, the gravel on the Finestre and car-free roads. Free,
  2,000 routes/day: <https://openrouteservice.org/dev>
- `OPEN_METEO_BUDGET` – only for `data:build`. Open-Meteo bills weighted
  "calls" (an elevation profile ≈ 100, a climate series ≈ 261) with a free
  tier of 5,000/hour and 10,000/day. The script stops itself at this budget
  (default 4,500) and picks up the rest on the next run; the GitHub Action
  `refresh-data.yml` runs twice a day until nothing is missing.
- `NEXT_PUBLIC_THUNDERFOREST_KEY`, `NEXT_PUBLIC_MAPTILER_KEY` – optional
  outdoor base maps. Without a key, OSM, OpenTopoMap, CyclOSM, Esri Topo and
  satellite imagery are available.

## Deployment (Vercel)

Push the repo to GitHub, import it in Vercel, done – no `vercel.json` needed.
The start page is prerendered at build time and served from the CDN edge;
only the weather route runs as a function.

## Origin

Grew out of a single HTML prototype; the data and the status heuristic were
carried over from it. The prototype is kept for reference at
`docs/prototype.html`.
