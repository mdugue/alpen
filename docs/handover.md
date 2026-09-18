# Handover: from HTML prototype to app

> **Historical.** This document records the move from the single-file HTML
> prototype to the Next.js app and is kept for that reasoning. It is not a
> description of the current state – for that, read
> [`../README.md`](../README.md) and [`../AGENTS.md`](../AGENTS.md). Where a
> claim below has since been overtaken, it is marked inline.

## What was carried over

| Prototype                                                    | Now                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| A 1.2 MB HTML file with inline MapLibre                      | Next.js 16 (App Router, Turbopack), React 19, Tailwind 4                             |
| Data objects in a `<script>` block                           | `data/*.json`, typed via `lib/types.ts`, validatable                                 |
| Routes/profiles/climate fetched at runtime into localStorage | precomputed in `data/generated/`, checked into the repo                              |
| Weather fetched directly from the client to Open-Meteo       | dedicated route with server-side cache                                               |
| Hand-written CSS                                             | shadcn/ui tokens (style "mira"), dark mode follows the OS via `prefers-color-scheme` |
| State in global variables                                    | `components/explorer.tsx` + `lib/app-state.ts`, hash sync                            |
| Keys in localStorage                                         | `ORS_KEY` as a build secret, map keys as `NEXT_PUBLIC_*`                             |

Functionally unchanged: filters, period selection, status heuristic, 3D,
elevation profiles, climate chart, favorites, "what is near here" (a 60 km
radius then, three named reach bands today, see [`scales.md`](./scales.md)),
shareable URLs.

## What was open then, and what became of it

1. **`data/generated/` was empty.** Done: the files are filled and committed –
   201 roads with 300 routed ascents, their profiles, the climate series and
   the Commons photo metadata. How they got there, and what to run when they
   go stale, is [`data-pipeline.md`](./data-pipeline.md).

2. **Design.** Done and then some: the map fills the viewport, the panels float
   over it, and a phone gets two independent drawers rather than a sidebar.
   The rules that came out of it are
   [`ui-conventions.md`](./ui-conventions.md) and
   [`map-rendering.md`](./map-rendering.md).

Done: the components in `components/ui/` used to be hand-written placeholders
because the sandbox had no access to `ui.shadcn.com`. The real shadcn "mira"
preset (style `base-mira`, built on `@base-ui/react` rather than Radix) has since
been installed and the app code adapted to it. The domain tokens
(`--status-open`, `--status-risky`, `--status-closed`, `--tour`, `--town` with
their `@theme inline` lines) are present in `app/globals.css` – if you ever
re-run `bunx shadcn@latest init`, check they survived, since `init` overwrites
that file.

## Recommendation for the ORS key

Build time, as a secret. There is no input field in the app any more: routing
happens in the script, not in the browser. Locally in `.env.local`, in GitHub
Actions as `secrets.ORS_KEY` (see `refresh-data.yml`, which commits new data
directly to `main`), not needed on Vercel at all as long as the precomputed
files are in the repo. Do not paste the key into a chat or commit it to the
repo.

## What GitHub + Vercel add on top

- **Preview deployments per PR.** Every data change can be viewed as a finished
  map before merging – for a data app this is the single biggest win.
- **Full prerendering at the edge.** The start page is generated at build time
  (`○ (Static)` in the build log) and served worldwide; the old 1.2 MB file is
  gone, MapLibre ships as its own chunk.
- **Server-side weather cache.** One request per pass per hour instead of one
  per visitor.
- **Scheduled work.** `refresh-data.yml` fills the data gaps on a push to
  `data/*.json` – it has no cron, because nothing in the pipeline is
  time-varying once the backlog is drained. For the live closure status
  (roadmap item 1) a Vercel Cron Function plus `revalidateTag` is the right
  place.
- **Fonts and analytics** come along: `next/font` serves Inter and Oxanium
  self-hosted (and `bun run map:glyphs` rasterises the same Inter into the
  map's glyph atlases), `@vercel/analytics` and Speed Insights would be a
  one-liner – neither is installed today.
- **One-click rollback** and immutable deployments per commit.
