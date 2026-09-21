# 26 · Pyrenees

**Status:** proposed · **Effort:** S–M for code, L for curation ·
**Depends on:** 25 (ranges, the chip, the frame test), 24 (the file split,
which this plan will trigger) · **Unblocks:** the Tour's other mountains;
the Spanish side's long season for the October question

## Goal

The Pyrenees are the third range: Tourmalet, Aubisque, Hautacam, Luchon,
Ariège, Andorra and the Catalan side, curated to alpine depth, with two new
countries, coordinate bounds per range, and a first screen that knows the
Alps and the Pyrenees are 600 km apart.

## Why now

- Of every candidate range the Pyrenees have the strongest product fit:
  every reader knows the names, they are a holiday and not a weekend, and
  a week in Luchon or Argelès is the same decision the app helps with in
  the Maurienne.
- The October and April answers: the Spanish and Catalan side and the
  Ariège are rideable when the Alps are not, and the Atlantic side's rain is
  a signal the app already has (`wet`).
- The mechanism is there after plan 25; what remains is two constants, two
  countries and the data.

## Non-goals

Multi-day traverses such as the Raid Pyrénéen (`docs/roadmap.md` §3,
"Multi-day trips"). A Spanish or French UI (plan 08 is the English toggle;
the audience stays German-speaking). Renaming the domain.

## The mechanism in one picture

```
before   LatLon: lat 43–49, lon 4–16       one box for everything
         COUNTRIES: FR IT CH AT DE SI

after    RANGE_BOUNDS: Alpen   lat 43–49  lon  4–16
                       Vogesen lat 47–49  lon  6–8
                       Jura    lat 45–48  lon  5–8
                       Pyrenäen lat 42–43.5 lon −2–3.5
         a pass and its ascents lie inside their range's box
         a tour's waypoints inside the box of its passes' range
         COUNTRIES + ES AD
```

The typo guard that `LatLon` was stays a guard, per range, instead of
becoming a box wide enough to catch nothing.

## Design

### Bounds and countries

`RANGE_BOUNDS` in `lib/regions.ts`, one box per range; `LatLon` widens to
the union and `Pass` gains a refinement that the marker and every ascent's
`from` and `to` lie inside the box of `rangeOf(region)`. A tour has no
region: its range is that of its passes, `check-data` requires them to share
one, and the waypoints are checked against that box. Towns are checked
against the union; their range comes from reach, as in plan 25.

`COUNTRIES` gains `ES` and `AD`, `COUNTRY_NAME` "Spanien" and "Andorra";
the pair regex already allows "FR/ES".

### The first screen

The default frame holds the Alps. A frame that held the Pyrenees too would
show the Alps at zoom 5, where nothing is readable, so the frame test from
plan 25 is relaxed to "every pass lies inside the frame of its own range"
and the Pyrenees are reached through their chip, through the search ("tourmalet",
"pyrenäen") and through a shared link. The header sentence names the range
when one chip is pressed. With no chip pressed the list mixes the ranges,
sorted as today; a row shows its region word where the row already carries
one, and the range is the one word to add where it does not.

Whether the app should open on the range nearest to the visitor is a
`headers()` question and therefore a dynamic-child question
(`docs/architecture.md`); not in this plan.

### Status, routing, assets

Nothing to change. The high cols have real winter closures (the Tourmalet
closes roughly from November to May, like the Galibier); the Basque west
will read "nass" and the Spanish side "Hitze" in summer, which is what a
rider expects and the read-back must confirm. OpenRouteService,
OSRM, Open-Meteo, Overpass, Commons and the tiles cover the range; the glyph
ranges cover Catalan and Spanish diacritics (Latin-1). The `quaeldich` slugs
exist for the French classics.

### Data

Candidates, approximate elevations, verified by `data:locate`:

**Hautes-Pyrénées and Béarn.** Col du Tourmalet (pass, ~2 115 m, two
sides), Col d'Aubisque (pass, ~1 710 m) with Col du Soulor (pass, ~1 475 m),
Col d'Aspin (pass, ~1 490 m), Hourquette d'Ancizan (pass, ~1 565 m),
Hautacam (spur, ~1 520 m), Luz Ardiden (spur, ~1 715 m), Col de Spandelles
(pass, ~1 380 m), Col de Marie-Blanque (pass, ~1 035 m), Col du Pourtalet
(pass, ~1 795 m, FR/ES), Col du Somport (pass, ~1 630 m, FR/ES), La Pierre
Saint-Martin (pass, ~1 760 m, FR/ES), Col de Bagargui (pass, ~1 330 m),
Cirque de Gavarnie (valley), Cirque de Troumouse (spur, ~2 100 m), Lac de
Cap-de-Long (spur, ~2 160 m, reservoir), Pla d'Adet (spur, ~1 680 m).
Bases: Argelès-Gazost, Luz-Saint-Sauveur, Bagnères-de-Bigorre,
Saint-Lary-Soulan, Arreau, Laruns; Lourdes and Pau for the train.

**Luchon and Comminges.** Col de Peyresourde (pass, ~1 570 m), Col du
Portet (pass, ~2 215 m, the road ends: spur), Superbagnères (spur, ~1 805 m),
Port de Balès (pass, ~1 755 m), Col de Menté (pass, ~1 350 m), Col du
Portillon (pass, ~1 295 m, FR/ES), Col des Ares (pass, ~800 m). Base:
Bagnères-de-Luchon (train, hub).

**Ariège and the east.** Col d'Agnes (pass, ~1 570 m), Port de Lers (pass,
~1 520 m), Col de Port (pass, ~1 250 m), Col de la Core (pass, ~1 395 m),
Col de Latrape (pass, ~1 110 m), Plateau de Beille (spur, ~1 780 m), Col de
Pailhères (pass, ~2 000 m), Col du Puymorens (pass, ~1 920 m), Col de la
Perche (pass, ~1 580 m), Col de Jau (pass, ~1 505 m), Col de Mantet (pass,
~1 760 m). Bases: Ax-les-Thermes (train), Font-Romeu, Saint-Girons.

**Andorra and the Catalan and Aragonese side.** Port d'Envalira (pass,
~2 410 m, AD), Coll d'Ordino (pass, ~1 980 m, AD), Arcalís (spur, ~2 230 m,
AD), Port de la Bonaigua (pass, ~2 070 m, ES), Coll de la Creueta (pass,
~1 920 m, ES), Collada de Toses (pass, ~1 800 m, ES), Port del Cantó (pass,
~1 725 m, ES), Coll de Pal (spur, ~2 100 m, ES). Bases: Andorra la Vella or
Ordino, Vielha, La Seu d'Urgell.

**Loops.** The "Cercle de la Mort" (Aubisque – Tourmalet – Aspin –
Peyresourde, the 1910 stage) as the one long loop from Argelès; Luchon –
Balès – Peyresourde – Luchon; Ax – Pailhères – Puymorens – Ax.

Roughly 50 roads, 14 towns, 3 loops: about 80 profiles and 50 climate
series, two and three hours of Open-Meteo windows through
`bun run data:backfill`.

## Steps

1. `RANGE_BOUNDS`, the refinements, `ES` and `AD`; `data:check` and the
   emitted JSON schema; the frame test per range.
2. The header sentence with a range; the range word in rows that carry none.
3. Data in four PRs, one per area above, each with photos, aliases and the
   `analyze-status --changes` read-back.
4. If this is the PR that crosses 300 entries, the split from plan 24.
5. Documentation.

### Documentation

`docs/data-model.md`: the bounds per range in the coordinate paragraph and
the two countries; `docs/roadmap.md` §2 updated. The brand decision, whichever
way it goes, lands in `lib/brand.ts` with its comment.

## Acceptance criteria

- `data:check` rejects a Pyrenean road placed in an alpine region and an
  alpine road with a waypoint in the Pyrenees.
- The "Pyrenäen" chip counts and frames; the default frame is unchanged for
  a visitor who has pressed nothing.
- After curation: at least 40 roads, 12 bases and 3 loops; Argelès and
  Luchon reach at least ten roads in the day band; the Tourmalet strip
  closes in winter and the Basque cols read "nass" where the read-back says
  they should.
- `bun run typecheck && bun run lint && bun test && bun run build && bun run data:check`
  pass.

## Risks and open questions

- **The name.** "Alpenpässe" with the Pyrenees inside is a stretch; "Pässe"
  is generic; the domain is `alpen.manuel.fyi`. Recommendation: keep the
  name and the domain, say "Alpen, Pyrenäen, Jura und Vogesen" in the
  description and the claim, and let the share image's question carry the
  breadth. Rename only when a fourth range makes the stretch a lie.
- **Two ranges in one list.** A visitor who has not pressed a chip sees
  Tourmalet between Galibier and Stelvio, sorted by elevation. That is
  correct and might still surprise; the range word on the row is the
  minimal cure, a "nach Gebirge" grouping in the list the larger one, decided
  on the built app.
- **The reach model across the border.** Andorra's roads reach Ax and Ordino
  alike; nothing in `lib/geo.ts` knows about borders and nothing should.
