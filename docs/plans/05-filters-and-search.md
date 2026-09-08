# 05 · Filters and search

**Status:** proposed · **Effort:** S–M · **Depends on:** – (09 adds the
`aliases` field to the schema) · **Unblocks:** 12 (region filter becomes
destination navigation)

## Goal

Search finds passes the way people spell them, filters cover the questions a
holiday planner asks (which country, how hard, how much traffic), sort and
filters survive in the URL, and the map shows the same set as the list.

## Why now

- Search is byte-literal (`lib/rows.ts` lowercases and calls `includes`).
  "Grossglockner", "Vrsic" and "Stilfserjoch" return nothing; the pass is
  called "Großglockner Hochalpenstraße", "Vršič" and "Passo dello Stelvio".
- The only pass filters are fame and minimum elevation. A planner asks "France
  or Italy?", "nothing above difficulty 3 for my partner", "as little traffic
  as possible".
- The map hides filtered-out passes but keeps every tour and town regardless
  of search or status. Searching "Galibier" leaves nine tours on the map,
  which reads as a bug.
- Sort is not in the hash (roadmap item 7).

## Non-goals

Full-text search across notes (the `why` and `note` fields stay in the
haystack, but no ranking engine).

## Design

### Search normalisation

`lib/search.ts`:

```ts
export const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{M}+/gu, "")
   .replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ł/g, "l")
   .toLowerCase().replace(/['’.]/g, "").replace(/[-–/]+/g, " ").replace(/\s+/g, " ").trim();
export const matches = (haystack: string, query: string) =>
  fold(query).split(" ").every((token) => haystack.includes(token));
```

Haystacks are folded once per entity (module-level `WeakMap<Pass, string>`):

- Pass: `name`, `aliases`, `region`, `country` and the German country names
  (`FR` → "Frankreich"), the ascent labels (so "Bormio" finds Stelvio and
  Gavia), the first sentence of `note`.
- Tour: `name`, `description`, the names of its passes.
- Town: `name`, `country`, `why`.

Every query token must match somewhere; "stelvio prad" finds the pass via
name and ascent label.

### Aliases

New optional `aliases: string[]` in `data/passes.json` (schema in plan 09).
Seed list to add in the same PR:

| Pass | Aliases |
| --- | --- |
| Passo dello Stelvio | Stilfser Joch, Stilfserjoch, Stelvio |
| Umbrailpass | Giogo di Santa Maria |
| Großglockner Hochalpenstraße | Grossglockner, Glockner |
| Vršič | Vrsic, Werschetz |
| Gotthard (Tremola) | San Gottardo, Gotthardpass |
| Passo Sella | Sellajoch |
| Passo Gardena | Grödner Joch, Groednerjoch |
| Passo Pordoi | Pordoijoch |
| Passo delle Erbe | Würzjoch |
| Passo Monte Croce Comelico | Kreuzbergpass |
| Tre Cime di Lavaredo | Drei Zinnen, Auronzohütte |
| Jaufenpass | Passo di Monte Giovo |
| Penserjoch | Passo di Pennes |
| Timmelsjoch | Passo del Rombo |
| Passo Fedaia | Marmolada |
| Julierpass | Pass dal Güglia |
| Malojapass | Passo del Maloja |
| Ofenpass | Pass dal Fuorn |
| Splügenpass | Passo dello Spluga |
| Simplonpass | Passo del Sempione |
| Nufenenpass | Passo della Novena |
| Lukmanierpass | Passo del Lucomagno |
| Col du Grand Saint-Bernard | Gran San Bernardo, Grosser Sankt Bernhard |
| Col du Petit Saint-Bernard | Piccolo San Bernardo, Kleiner Sankt Bernhard |
| Col du Mont Cenis | Moncenisio |
| Colle dell'Agnello | Col Agnel |
| Colle Fauniera | Colle dei Morti |
| Col de la Bonette | Cime de la Bonette, Restefond |
| Roßfeld-Panoramastraße | Rossfeld |
| Silvretta Hochalpenstraße | Bielerhöhe |
| Ötztaler Gletscherstraße | Rettenbachferner |

The `curate-data` skill covers adding more.

### Filters

`Filters` gains:

| Field | UI | Hash | Applies to |
| --- | --- | --- | --- |
| `countries: string[]` | chips FR IT CH AT DE SI (multi) | `l=fr,it` | passes, tours (by their passes), towns |
| `regions: string[]` | chips Westalpen … (multi) | `r=` | passes, tours |
| `difficulty: [min, max]` | range slider 1–5 | `d=2-4` | passes |
| `maxTraffic: number` | select "egal / ≤ 3 / ≤ 2 / ≤ 1" | `v=3` | passes |
| `minBeauty: number` | select like fame | `b=4` | passes |

`sort` moves from `PassList` state into `Filters` (`o=beauty`). The pass
filter collapsible grows to two columns on desktop; `passFilters` badge count
covers all of them. `hasActiveFilters` and `resetFilters` are extended.

Plan 12 turns the region chips into destination navigation; keep the chip
component generic.

### Map consistency

Rule: what the list shows for a kind is what the map shows for that kind.

- `mapTours` derives from `tourRows` intersected with the visibility switch
  (the switch stays a layer toggle, not a filter).
- `mapTowns` derives from `townRows` intersected with `showTowns`.
- Passes already follow `passRows`.

With plan 01 this means feature state `hidden` for tours instead of rebuilding
the source.

## Steps

1. `lib/search.ts` with `fold`, `matches`, haystack builders; unit tests with
   the alias table as fixtures; replace `query()` in `lib/rows.ts`.
2. `aliases` in `passes.json` + type + `check-data` (no duplicates, no alias
   equal to a name).
3. New filter fields, hash read/write in `lib/app-state.ts` with tests, UI in
   `components/sidebar/pass-list.tsx` and `sidebar.tsx`.
4. Map consistency in `components/explorer.tsx`.
5. Update `README.md` ("Filter, selection and URL state") if the hash keys are
   documented anywhere; document the keys in `lib/app-state.ts`.

## Acceptance criteria

- "grossglockner", "vrsic", "stilfser", "bormio", "drei zinnen" each return
  the expected pass.
- A link with `l=it&d=1-3&v=2&o=beauty` restores those filters and the sort.
- Searching a pass name leaves only matching tours and towns on the map.
- The filter badge counts every active pass filter.

## Risks and open questions

- Tours filtered by country: a tour that crosses FR/IT counts for both.
- Too many chips on a phone: the country row wraps; regions collapse into the
  filter panel.
