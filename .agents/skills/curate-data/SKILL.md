---
name: curate-data
description: "Add or edit passes, tours, towns and (later) destinations in data/*.json: slug rules, coordinates, editorial 1–5 scales per docs/scales.md, season windows, ascent start points, aliases; then run data:build and data:check and review the routed result. Use when the user wants to add a pass, tour or town, fix a rating or a season, add search aliases, or refresh precomputed data."
---

Hand-maintained data is the product. Every edit follows the same loop:
edit `data/*.json` → `bun run data:build` → `bun run data:check` → look at
the result on the map → commit source and generated files together.

## Fields and rules

Read `docs/data-model.md` and `docs/scales.md` first; they are short and
authoritative. In addition:

- **Slug**: from the name, lowercase ASCII; umlauts → `ae/oe/ue`, `ß` → `ss`,
  apostrophes and spaces → `-`, no leading/trailing dashes. Slugs never
  change once committed (they are in shared links).
- **Pass coordinate**: the summit point *on the road* (not the geographic
  saddle or a nearby peak). Check `elevation` against the map; a mismatch of
  more than ~80 m is a bug the route gate (plan 00) will flag.
- **Ascents**: `from` is a point on the road in the valley village where the
  classic climb starts; `label` names the village and, for two-sided passes,
  the side ("Valloire (Nord)"). One or two ascents; three only for famous
  passes with three distinct roads.
- **Scales**: editorial, 1–5, per `docs/scales.md`. Do not derive them from
  numbers; do compare with neighbours so the ordering is defensible
  ("is this really harder than Mortirolo?").
- **Season**: half-months (`10` = early October, `10.5` = late October);
  `null` for roads cleared all year; `maintained: true` only for managed toll
  roads that are actually cleared.
- **note**: one or two German sentences with the closure habit and the
  character; this is the sentence a planner reads.
- **aliases** (plan 05): other spellings and other-language names, never the
  name itself.
- **Tours**: `passes` in ride order; `waypoints` closed for loops (last =
  first); `km` and `elevationGain` from a trusted source until plan 11 item 8
  computes them.
- **Towns**: `why` is one sentence naming the surrounding passes and the
  infrastructure (workshop, rental, bike hotel).
- **Destinations** (plan 12): follow `docs/destinations.md` once it exists.

## Loop

```bash
bun run data:check                 # before: is the file well-formed and referenced?
bun run data:build --status        # what will be fetched and what it costs
ORS_KEY=… bun run data:build       # cycling profile; without the key OSRM car profile
bun run data:check
```

- Never edit `data/generated/*.json` by hand. To force a re-fetch, delete the
  key from the generated file and run the build.
- Open the pass in the app (`preview-app` skill or `bun dev`) and look at the
  drawn ascent: it must follow the road and end at the marker, the profile
  top must match the elevation. If not, the `from` point or the pass
  coordinate is wrong, not the router.
- Respect the quotas in the header of `scripts/build-data.ts`. The GitHub
  workflow drains backlogs twice a day; a local run is for verifying one new
  entry, not for bulk fetching.

## Honesty

The scales dialog promises that scales are editorial and the status is a
heuristic. Keep it true: no invented precision in `classicAscent`, no season
window narrower than the road authority's habit, and a `note` that says when
the data is uncertain.
