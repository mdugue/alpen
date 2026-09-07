# Handover: from HTML prototype to app

## What was carried over

| Prototype | Now |
| --- | --- |
| A 1.2 MB HTML file with inline MapLibre | Next.js 16 (App Router, Turbopack), React 19, Tailwind 4 |
| Data objects in a `<script>` block | `data/*.json`, typed via `lib/types.ts`, validatable |
| Routes/profiles/climate fetched at runtime into localStorage | precomputed in `data/generated/`, checked into the repo |
| Weather fetched directly from the client to Open-Meteo | dedicated route with server-side cache |
| Hand-written CSS | shadcn/ui tokens (style "mira"), dark mode via `next-themes` |
| State in global variables | `components/explorer.tsx` + `lib/app-state.ts`, hash sync |
| Keys in localStorage | `ORS_KEY` as a build secret, map keys as `NEXT_PUBLIC_*` |

Functionally unchanged: filters, period selection, status heuristic, 3D,
elevation profiles, climate chart, favorites, radius search (60 km), shareable
URLs.

## What is still open

1. **`data/generated/` is empty.** The files currently contain only `{}`. Run
   `bun run data:build` once, ideally with `ORS_KEY` set, and commit the result.

2. **Design.** Header, toolbar, table and panel are deliberately kept restrained
   so that the Mira components can shape them. If the result still does not sit
   right, the quickest levers are: `--radius`, the header color (`bg-primary`)
   and the density of the table.

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
Actions as `secrets.ORS_KEY` (see `refresh-data.yml`), not needed on Vercel at
all as long as the precomputed files are in the repo. Do not paste the key into
a chat or commit it to the repo.

## What GitHub + Vercel add on top

- **Preview deployments per PR.** Every data change can be viewed as a finished
  map before merging – for a data app this is the single biggest win.
- **Full prerendering at the edge.** The start page is generated at build time
  (`○ (Static)` in the build log) and served worldwide; the old 1.2 MB file is
  gone, MapLibre ships as its own chunk.
- **Server-side weather cache.** One request per pass per half hour instead of
  one per visitor.
- **Cron jobs.** `refresh-data.yml` pulls in new data monthly; for the live
  closure status (roadmap item 1) a Vercel Cron Function plus `revalidateTag` is
  the right place.
- **Images, fonts, analytics** come along: `next/font` serves Inter and Oxanium
  self-hosted, `@vercel/analytics` and Speed Insights are a one-liner.
- **One-click rollback** and immutable deployments per commit.
