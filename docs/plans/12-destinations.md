# 12 · Destinations

**Status:** proposed (not requested yet; written because the product goal
asks for it) · **Effort:** L · **Depends on:** 09 (schema), benefits from 03
and 04 · **Unblocks:** the "where" half of the product goal, multi-day
planning, hotel search

## Goal

Introduce destinations ("Reiseziele") as a first-class entity: a riding area
with base towns, the passes and loops within reach, a character description,
multi-day notes, and per-half-month numbers derived from its passes. The app's
first screen answers "which destinations are good in the chosen half-month"
directly, and the destination detail answers "where do we stay, what can we
ride from there".

## Why now

The product goal is destination finding, but the data model has only passes,
tours and towns. Today a visitor who wants "a good region for early October"
has to infer it from 92 dots. Regions in `passes.json` (`Westalpen` …) are
too coarse to book a hotel in. Everything needed to compute destination
quality per half-month already exists: pass status (plans 03/04), climate
series, town infrastructure, tour membership.

## Non-goals

Bookings, prices, affiliate links, user accounts. Turn-by-turn or stage
routing between destinations.

## Design

### Data

`data/destinations.json` (hand-maintained, schema in `lib/schema.ts`):

```jsonc
{
  "slug": "oisans",
  "name": "Oisans",
  "country": "FR",
  "center": { "lat": 45.06, "lon": 6.05 },
  "radiusKm": 45,
  "baseTowns": ["bourg-d-oisans"],
  "include": ["col-du-galibier"],          // passes beyond the radius that belong here
  "exclude": [],
  "character": "Zwei Sätze: Alpe d'Huez, Galibier, Croix de Fer, Sarenne; große Höhen, große Namen, viel Verkehr auf der D1091.",
  "multiDay": "Basis für 4–6 Tage; Etappe über Galibier nach Briançon möglich.",
  "access": "Grenoble (Bahn, Flughafen Lyon 1,5 h).",
  "note": "…"
}
```

Starter set of about 18: Oisans, Maurienne, Tarentaise, Ubaye, Mercantour /
Alpes-Maritimes, Briançonnais / Queyras, Susa / Piemont, Cuneo valleys,
Ventoux, Andermatt / Urserental, Engadin, Bormio / Livigno, Vinschgau /
Ortler, Ötztal, Alta Badia, Cortina / Cadore, Fassa / Canazei, Hohe Tauern,
Nockberge, Julische Alpen.

`data:build` derives `data/generated/destinations.json`: member passes (radius
± include/exclude), member tours (any waypoint within radius), member towns,
bounding box, and per-half-month aggregates of the members' climate. The
`curate-data` skill covers adding one.

### Scores per half-month (client, cheap)

For destination D and period t:

- `open`, `risky`, `closed` counts over member passes (status from plan 04).
- `score = Σ beauty over open passes + 0.4 × Σ beauty over risky passes`
  (a "how much great riding is available" number; tune later).
- `bestPeriods(D)`: longest run where ≥ 70 % of members are open.
- Climate summary: median snow-day share of members in t.

### UI

- **Sidebar**: a new first section "Reiseziele", open by default, sorted by
  score for the chosen period. Row: name, country, "7 von 9 Pässen offen",
  the aggregated season strip (plan 03), base town names. Filters from plan
  05 apply (country).
- **Map**: at zoom < 8.5 destination labels with a soft circle (radius,
  `--accent` at 15 % opacity, stroke by open share) above the pass dots; the
  dots stay as texture. Selecting a destination fits its bounds.
- **Detail**: header with the counts and the strip; "Pässe" with status dots,
  elevation and the classic ascent line; "Rundtouren"; "Orte" with the
  existing bike-shop links plus "Unterkunft suchen" (a generic lodging search
  link centred on the base town, no affiliate); "Mehrtägig" note; "Anreise";
  climate summary for the chosen half-month; "Beste Zeit".
- **Compare**: pick up to three destinations (star or a "vergleichen" toggle)
  → a side-by-side sheet with strips, counts, base towns. This is the holiday
  decision screen.
- **Empty selection**: the sidebar top reads "Anfang Oktober: die besten
  Reiseziele" with the ranked list, which is the "great overview" the goal
  asks for.
- **Routes** (plan 02): `/ziel/[slug]` with metadata and OG image (counts and
  strip).

### What changes elsewhere

- Region chips (plan 05) become a shortcut into destinations.
- Towns keep their own list, but a town row links to its destination.
- The scales dialog gains a paragraph on how destination numbers are derived.

## Steps

1. Schema and starter data for six destinations (Oisans, Maurienne, Engadin,
   Alta Badia, Hohe Tauern, Ventoux); build-time membership; `check-data`
   cross-references.
2. Sidebar section, rows with strip and counts; selection and fit on the map.
3. Detail panel and lodging links.
4. Map circles and labels at low zoom.
5. Compare sheet.
6. Fill the remaining destinations; write `docs/destinations.md` on the
   editorial rules (radius, what counts as a base town).

## Acceptance criteria

- With early October selected, the top of the sidebar lists destinations
  ranked by what is rideable, and Oisans, Alta Badia and Mercantour rank
  above Engadin and Hohe Tauern.
- A destination detail answers "where to stay" and "what to ride" without
  leaving the app, and links out for lodging and workshops.
- Every pass belongs to at least one destination or is deliberately listed as
  standalone in `check-data` output.

## Risks and open questions

- Radius membership produces odd overlaps (Galibier belongs to Oisans and
  Maurienne). Overlap is fine; the `include`/`exclude` lists exist for taste.
- The score formula is editorial; label it as such in the dialog, keep it in
  one function with a comment, and expect to tune it after using the app for
  one real trip.
