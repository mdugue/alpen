# 02 · Real routes instead of the hash

**Status:** proposed · **Effort:** L · **Depends on:** 01 (smaller payload
first, otherwise every prerendered route carries the geometry) ·
**Unblocks:** 08, per-entity share previews, search traffic

## Goal

Every pass, tour, town (and later destination) has its own URL that is
prerendered, has its own title and Open Graph image, works with the browser
back button, and renders the detail panel on the server with the weather
streamed in. Camera, period and filters stay client-side in the hash.

## Why now

- `lib/app-state.ts` writes every state change with `history.replaceState`, so
  there is never a history entry: the desktop back button leaves the site and
  the Android back gesture exits the app while a pass is open.
- There is one URL and one Open Graph image for 127 entities. Sharing "look at
  this pass" produces the generic card.
- Nothing is crawlable, so the app cannot be found by people searching for
  "Passo dello Stelvio Rennrad Oktober", which is exactly the destination
  question it answers.
- The weather table is a client fetch with a skeleton; server rendering with
  Suspense removes both.

## Non-goals

Moving camera, period or filters into the URL path or search params (search
params would make the page dynamic; the hash costs nothing). Server-side
locale detection (plan 08 keeps that static too).

## Design

### Route tree

```
app/
  layout.tsx                      html, fonts, metadata (unchanged)
  (explorer)/
    layout.tsx                    server: loads data, renders <Explorer> with {children} as the detail slot
    page.tsx                      "/"  → no selection, empty slot
    pass/[slug]/page.tsx          generateStaticParams → 92 slugs, dynamicParams = false
    pass/[slug]/opengraph-image.tsx
    tour/[slug]/page.tsx  (+ opengraph-image)
    ort/[slug]/page.tsx   (+ opengraph-image)
  impressum/page.tsx, datenschutz/page.tsx   unchanged
  sitemap.ts, robots.ts
```

The explorer layout persists across child navigations, so the map, the
sidebar and their state stay mounted. Cache Components additionally keep up to
three visited pages alive with React's `Activity`, which makes back/forward
instant.

### Selection comes from the URL

- `Explorer` derives `selection` from `usePathname()` (`/pass/x` →
  `{ kind: "pass", slug: "x" }`) instead of `useState`.
- `select(sel)` becomes `router.push(hrefFor(sel) + window.location.hash)`.
  Pushing a path without the hash would drop the camera and period, so the
  hash is appended explicitly.
- `back()` calls `router.back()` when the previous entry belongs to the app
  (track a counter in `sessionStorage`), otherwise `router.push("/" + hash)`.
- Rows use `<Link href prefetch={false}>` so 92 rows do not prefetch 92 RSC
  payloads; prefetch on hover/focus via `router.prefetch` if navigation feels
  slow (it should not, the pages are static).
- Map clicks call `select` as today.

### Detail on the server

`pass/[slug]/page.tsx` reads `getPass(slug)`, the pass's profiles and climate
from `lib/data.ts` and renders `PassDetail` as a server component. Only the
selected pass's profiles and climate ship with that route. Client islands stay
small: favourite toggle, nearby links, the profile cursor (plan 07), the
period-dependent bits. The period comes from the hash, so period-dependent
text (status badge, climate bucket) is rendered by a client component that
reads it from the explorer context (plan 11, item 3) and receives the full
climate series as a prop.

### Weather

```tsx
async function Weather({ slug }: { slug: string }) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 1800, expire: 7200 });
  cacheTag("weather");
  const days = await forecast(...);
  return <WeatherTable days={days} />;
}
// in the page:
<Suspense fallback={<WeatherSkeleton />}><Weather slug={slug} /></Suspense>
```

Static shell plus a streamed hole; `app/api/weather/[slug]/route.ts` and
`lib/use-fetch.ts` are deleted.

### Metadata and share images

- `generateMetadata` per entity: title `Col du Galibier · 2.642 m · Alpenpässe`,
  description from `seasonText` plus the first sentence of `note`,
  `alternates.canonical`.
- `opengraph-image.tsx` per entity: reuse the dot map from
  `app/opengraph-image.tsx`, highlight the entity, add its name, elevation and
  the typical season line. The period cannot be known at share time, so the
  image shows the season window, not a status.
- `sitemap.ts` lists all entity routes; `robots.ts` allows everything.

### Old links

`#pass=slug` links exist in the wild. In the hash effect: if the hash carries
`pass`, `tour` or `town`, strip it and `router.replace` to the new path with
the remaining hash. Keep this for a year, then drop it.

### Mobile

Unchanged behaviour: the sheet shows the detail slot when a child route is
active, `back` returns to the list.

## Steps

1. Spike (half a day, throw-away branch): a child route under a persisting
   layout, `router.push` with a hash appended, `history.replaceState` for
   camera updates on the same path, back/forward. Confirm the hash survives
   and the map does not remount.
2. Route skeleton: `(explorer)/layout.tsx` + `page.tsx` + the three dynamic
   segments with `generateStaticParams` and `dynamicParams = false`; detail
   still rendered by the existing client `DetailPanel`, selection derived from
   the pathname; rows become links.
3. Server-rendered detail: split `DetailPanel` into server `PassDetail` /
   `TourDetail` / `TownDetail` plus client islands; weather via Suspense;
   delete the API route.
4. Metadata, per-entity OG images, sitemap, robots.
5. Old-hash migration and clean-up of `Selection` state in `lib/app-state.ts`.
6. Update `AGENTS.md` ("Filter, selection and URL state" row) and the README
   architecture paragraph.

## Acceptance criteria

- `/pass/col-du-galibier` is prerendered (`○` in the build log), has a unique
  title, description and OG image, and its HTML contains only that pass's
  profile and climate data.
- Opening a pass and pressing the browser back button returns to the list with
  the map where it was.
- A shared `#pass=…` link from before still opens the right pass.
- Weather streams in without a client fetch; the API route is gone.
- Lighthouse SEO score for an entity route is 100.

## Risks and open questions

- Next's router and manual `replaceState` on the same path: supported since
  Next 14.1 for search params; verify for hash-only updates in the spike.
- `Activity` preserves page state: a dialog that was open when the user
  navigated away stays open on return. Derive transient UI state from the
  URL or reset it in a `useLayoutEffect` cleanup as the Next guide describes.
- Prefetch storms from 92 links: `prefetch={false}` and measure.
