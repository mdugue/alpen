# 08 · English toggle

**Status:** done ([#63](https://github.com/mdugue/alpen/pull/63)) ·
**Effort:** M–L (code M, translation of ~700 short texts) · **Depends on:**
02 (route structure), ideally 06 (map labels) · **Unblocks:** an audience
beyond German speakers

## What was built

Everything in the design below, with these departures:

- **No `dynamicParams = false`**: Cache Components allow none, so an unknown
  language is `notFound()` in the root layout, like an unknown slug.
- **The toggle sits in the header**, not in the sidebar brand row: one
  place on every width, and it is a plain `<a>` with a full load rather than
  a `Link` – the other prefix is another prerender and every row's text
  changes with it. Its `href` is a value of the state (`switchLangHref`),
  so the server and the client render the same link.
- **The words are split by area** (`lib/i18n/de/*.ts`, `en/*.ts`) and
  composed in `messages.de.ts`; the core's sentence functions take the
  language as a trailing argument with a German default, so the scripts and
  the tests keep their words. The vocabulary tables in `lib/regions.ts` and
  `lib/geo.ts` stay the German source, the English `vocab` section writes
  its own.
- **The share images live under `[lang]`** (`app/[lang]/opengraph-image.tsx`
  and the entity one), so each language gets its own and nothing outside a
  layout resolves an image any more.
- **The editorial prose** is `data/i18n/en/{passes,tours,towns,destinations}.json`
  with a first machine draft, hand-checked, merged in `lib/data.ts`; the
  coverage is an `INFO` line of `bun run data:check`.
- **The first-visit hint** is a small dismissible link in the header for a
  browser whose language is English and nothing stored (`alpenpaesse:lang`);
  the map's basemap labels stay as they are (plan 06 uses `name` only).

## Goal

The whole UI, the status and period vocabulary, the editorial texts and the
share images are available in English under `/en/…`, chosen by a visible
toggle, without giving up static prerendering.

## Why now

Most passes are in France, Italy and Switzerland; the people planning a
holiday there are not only German speakers. The UI-string count is small
(about 200) and the editorial prose is short (about 130 texts), so this is a
bounded job as long as it is done once, properly, instead of ad hoc.

## Non-goals

Server-side language detection or redirects (they make routes dynamic or need
a proxy), machine-translating the legal pages (they stay German with an
English note), translating pass names (proper names stay as they are, aliases
cover the search side).

## The mechanism in one picture

```
request            rewrite         route file                                   lang
/               →  /de          →  app/[lang]/(explorer)/page.tsx               de
/pass/x         →  /de/pass/x   →  app/[lang]/(explorer)/pass/[slug]/page.tsx   de
/en             →  (none)       →  app/[lang]/(explorer)/page.tsx               en
/en/pass/x      →  (none)       →  app/[lang]/(explorer)/pass/[slug]/page.tsx   en

German URLs stay prefix-free and canonical; English gets the /en prefix;
both locales are prerendered from generateStaticParams, no proxy, no redirect.
```

## Design

### Routing

Follow the Next.js internationalisation guide (`app/[lang]/…`) but keep
German prefix-free:

- Move the explorer routes from plan 02 under `app/[lang]/(explorer)/…` with
  `generateStaticParams` returning `[{ lang: "de" }, { lang: "en" }]` and
  `dynamicParams = false`.
- `next.config.ts` `rewrites`: `/` → `/de`, `/pass/:slug` → `/de/pass/:slug`
  and so on, so existing German URLs stay valid and canonical. English lives
  at `/en`, `/en/pass/:slug`.
- No proxy. Detection is a client-side hint only: on first visit, if
  `navigator.language` starts with `en` and nothing is stored, show a small
  dismissible "English version" link in the sidebar brand row. The choice is
  stored in `localStorage` (`alpenpaesse:lang`) and used by the hint only.
- `<html lang>` comes from the segment (root layout under `[lang]`).
- `generateMetadata` adds `alternates.languages` for both locales.

### Messages

`lib/i18n/messages.de.ts` is the source of truth with a `Messages` type;
`messages.en.ts` satisfies the same type so a missing key fails `typecheck`.
Server components call `getMessages(lang)`; client components use `useT()`
from an `I18nProvider` that the `[lang]` layout renders (locale via
`useParams`). Interpolation stays simple template functions:
`t.nearby(60)` → "Im Umkreis von 60 km" / "Within 60 km".

Covers: sidebar, filters, sort labels, status labels, `periodLabel`
("early October"), months, scales dialog, detail panel labels, weather table,
climate texts, map control labels, MapLibre `locale` strings, the legal note.

### Numbers and dates

`fmt`, `fmtUnit` and the weather date take the locale: `de-DE` / `en-GB`
(metric stays; "2,642 m" vs "2.642 m").

### Editorial prose

`data/i18n/en/passes.json`, `tours.json`, `towns.json`, keyed by slug:

```jsonc
{
  "col-du-galibier": {
    "classicAscent": "18 km, 6.9 % from Valloire (34 km via Télégraphe)",
    "note": "Winter closure usually late October to early June. …",
  },
}
```

`lib/data.ts` merges by locale with a German fallback; `check-data` warns
about missing English texts so coverage is visible. Tour `season` text
becomes structured in plan 11 (item 8) which removes one prose field.

### Map

With plan 06 the basemap label expression uses `name:en` for English. The
app's own labels are proper names and stay.

### Share images

The OG image routes live under `[lang]`, so each locale gets its own images
with translated captions.

### Toggle

"DE | EN" in the sidebar brand row and the mobile sheet header, implemented as
a `Link` to the same path in the other locale with the current hash appended
(camera and period survive).

## Steps

1. Route move under `[lang]` with rewrites; nothing translated yet; German
   still renders at `/`. Verify every route is still `○` in the build log.
2. Messages module, provider, replace UI strings file by file (one PR per
   area: sidebar, panel, map, dialog).
3. Locale-aware `fmt` and dates.
4. Editorial JSON with a first machine draft, hand-checked; `check-data`
   coverage warning.
5. OG images and metadata per locale; sitemap lists both.
6. Toggle and the first-visit hint.

### Documentation

The rewrite table goes into the README ("Architecture") and the message
module gets a header comment with the glossary.

## Acceptance criteria

- `/en/pass/col-du-galibier` is prerendered, fully English, with English
  metadata and share image; `/pass/col-du-galibier` is unchanged German.
- A missing message key is a type error; a missing editorial translation is a
  `data:check` warning.
- Switching language keeps the map camera, period and selection.
- README shows the rewrite table.

## Risks and open questions

- Rewrites and `generateStaticParams`: confirm in step 1 that `/` served via
  rewrite is the prerendered `/de` page, not a dynamic render.
- Proper nouns in German texts (Rennrad, Halbmonat, "wetterabhängig") need a
  glossary in the PR so future strings stay consistent.
