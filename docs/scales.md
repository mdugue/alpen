# Scales and where they come from

The four 1–5 scales are **editorial assessments**, assigned based on the general
reputation of the passes (cycling literature, Grand Tour history, reports on
quaeldich.de, climbbybike, Cyclingcols). They are neither measured values nor
user ratings. They are suitable for rough classification, not for point-by-point
comparison. The scales dialog in the app says exactly that – please keep that
honesty.

| Scale          | 1                         | 3                     | 5                                                                          |
| -------------- | ------------------------- | --------------------- | -------------------------------------------------------------------------- |
| **Fame**       | barely known              | known in the scene    | legend (Galibier, Stelvio, Ventoux, Alpe d'Huez, Glockner)                 |
| **Beauty**     | forest road with no view  | solid                 | high-alpine scenery with a spectacular road (Bonette, Iseran, Gavia, Giau) |
| **Difficulty** | short or flat             | ordinary alpine pass  | > 1,000 m of elevation gain with ramps above 10 %, or very long and high   |
| **Traffic**    | almost car-free, dead end | ordinary pass traffic | through road (Simplon, Lautaret, Julier)                                   |

For anyone wanting to make this objective: `difficulty` could be computed from
`profiles.json` (length, average gradient, maximum ramp, summit elevation),
`traffic` approximately from the OSM road classes along the routed ascent. Both
are listed in `docs/roadmap.md`.

## Status per period

`passStatus()` in `lib/status.ts`:

1. Without `season` (cleared year-round): from 2,300 m "weather-dependent" in
   the winter half-year, from 1,800 m somewhat later, in deep winter generally.
2. With `season`: "often closed" outside the window, "weather-dependent" in the
   first and last half-month.
3. Additionally an elevation penalty at the edges of the window – except with
   `maintained: true`.

This is deliberately coarse and does not replace official information. The
function is the place where real closure data will hook in later.
