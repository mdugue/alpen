# Destinations

A destination ("Reiseziel") is a riding area: a circle a curator drew around
a valley or a massif, with the towns one would sleep in and two sentences on
what riding there is like. It is the entity the product goal names first –
"which regions are good in early October", "where should we look for a hotel
so that several passes and a loop are within reach" – and the one the data
did not have until plan 12: regions in `passes.json` are four coarse values,
and a town is a point, not an area.

This document holds the editorial rules. What the fields mean is
`docs/data-model.md`; how the numbers are derived is `docs/scales.md` and the
scales dialog in the app.

## What a destination is, and is not

A destination answers "should we spend the week here". It is **an area with
a base**, not a list of passes: the circle is drawn where a hotel would be
booked, and the roads inside it are what one rides from there. A pass that a
rider would travel to for one day and drive on from the next is not a
destination, however famous; it lies in whichever area's circle holds it, or
in none.

It is also not a region. Two destinations may overlap (the Galibier belongs
to the Oisans and to the Maurienne, and that is right: it is ridden from
both), and a road may lie in none. `data:check` prints the roads outside every
circle as one information line, so "standalone" is a decision the curator has
seen rather than an oversight.

## The circle

- **`center`** is where the riding starts, not the geographic middle of the
  massif: the valley floor the ascents leave from, usually the base town or
  the point between two of them. A centre on a summit puts half the circle
  over the wrong valley.
- **`radiusKm`** is the distance a rider covers to reach a climb, 10 to 75 km,
  and it is deliberately on the small side: 25 to 35 km for a valley with its
  climbs, 40 to 50 km for a plateau with roads spread across it. A circle
  that holds "everything within a day's drive" says nothing; the reach bands
  in the town panel already answer that question, with distances. Widen a
  circle only when the roads at its edge are ridden from its base.
- **`include`** adds roads beyond the radius that belong to the area by
  custom – the Iseran to the Tarentaise, whose riders climb it from
  Bourg-Saint-Maurice although the summit lies past the circle. **`exclude`**
  cuts roads inside the radius that belong to another valley – the Schnalstal
  spur lies within the Ötztal's radius and is ridden from the Vinschgau. Both
  lists are corrections to the circle, and `data:check` warns when a
  correction says what the circle already says: after the next radius change
  one of the two would be wrong.
- **`baseTowns`** are the places to stay, at most three of them, from
  `towns.json`. A base town lies inside the circle as a rule; `data:check`
  warns about one that does not. An area may name none while `towns.json`
  holds no town inside its circle (the Vercors, say) – then its panel lists
  no base and the row names none, which is the honest state until a town is
  curated. A town inside the circle that is not named here is still a member
  – it is listed among the towns, without the "Standort" mark and without
  the lodging link.

## The prose

Three fields, one or two sentences each, in the register of the pass notes:
what a rider would tell a friend, not what a tourist office would write.

- **`character`**: what riding here is like. The famous names, the shape of
  the terrain, the one thing to know (traffic on the valley road, the wind,
  the altitude). It is the first thing the panel shows.
- **`multiDay`**: what the area is for. How many days it carries, which
  loops, whether a stage to the next area is possible. It is the text the
  compare sheet reads under the counts.
- **`access`**: how one gets there without a car where that is possible –
  the railway station, the airport and its distance, the bus up the valley.
- **`note`** (optional): what does not fit the three, in the same register.

## What is derived, and where

Nothing in `destinations.json` is a number about riding. Membership – which
roads, loops and towns an area holds – is computed when the page is built
(`membersOf` in `lib/destination.ts`): every road within the radius plus the
`include` minus the `exclude`, every town within the radius plus the bases,
every loop with a waypoint inside, and the box around all of it. There is no
generated file to keep in step: a road added to `passes.json` joins its area
by itself, and a changed radius moves the membership with it.

The verdict of an area is derived the way a base's is (`docs/scales.md`,
"Destinations: reach and the derived year"): the member roads' 24 cells,
counted per half-month, graded against the area's own best half-month. The
list of areas is ranked by a score that is never shown – the beauty of each
open road, two fifths of it for a limited one, nothing for a closed one
(`areaScore`, `RISKY_WEIGHT`). Both are editorial, like every number in this
app, and the scales dialog says so.

## The list, and the compare sheet

The destinations are the second tab of the sidebar, right after the roads –
the roads are what the map is made of, so a first visit opens on them – and
they are ranked for the chosen half-month, so the tab answers the product
goal's first question:

```
┌ Anfang Oktober ─────────────────────────────────┐
│ STRASSEN 262 · REISEZIELE 41 · TOUREN 17         │
│ ▸ Mercantour · FR              9 von 10 Straßen  │
│   ░░░▒▓▓▓▓▓▓▓▒░░                      gut         │
│     ◆ Nizza · Bahnanschluss                       │
│ ▸ Alta Badia · IT              8 von 8 Straßen   │
│     ◆ Corvara · Radsport-Mekka                    │
│ …                                                │
│ WEITERE ORTE                                      │
│   ◆ Bormio · IT · Valtellina                      │
└──────────────────────────────────────────────────┘
ranked by what is rideable in the chosen half-month,
each area's towns under it
```

The road criteria (height, fame, difficulty, the summer signals) do not
reach this list: an area is judged on all of its roads. The "Gebirge" chip
does – it narrows the areas to a range the way it narrows the roads – and so
do the search and the favourites. The towns are not a list of their own:
each is listed under the area that names it as a base first, and the towns
no listed area holds follow in a last group ("Weitere Orte") – an area is
where one goes, a town is where in it one sleeps.

On the map an area is the outline of where its riding is, not the circle
that decided its members: the padded hull of its summits, both ends of every
ascent and its towns (`DestinationMembers.outline`, 5 km around them). The
circle was the membership rule drawn as a picture, and half of every disc was
valley floor or the next range; the outline shows what the area holds. It is
drawn in the overview (below zoom 8.5, where the roads thin out by fame),
the edge tinted by the rideable share, with the name and the count on its
centre; past that zoom the roads are the picture and the fill would only
cover it. Selecting an area frames its members.

Up to three areas can be switched on for the compare sheet: the verdict of
the half-month, the derived year, what each holds and where one would stay,
side by side. The picked areas travel in the link (`vgl=oisans,engadin`), so
the comparison can be sent to the person one is travelling with.

## Adding one

1. Draw the circle: pick the base town, put `center` on the valley floor,
   start with `radiusKm: 30`.
2. Run `bun run data:check`. The membership is not printed, but the warnings
   are: an `include` the radius already covers, a base town outside the
   circle. `bun run dev` and the destination's panel show the members.
3. Correct with `include` and `exclude` rather than by widening the circle.
4. Write the three sentences. Read the neighbours' first, so the register
   holds.
5. Check the information line at the end of `data:check`: if the new area
   took a road out of the standalone list, that was the point; if it did not
   and should have, the circle is in the wrong place.
