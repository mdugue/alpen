import type { scales as de } from "../de/scales";
import type { Layout } from "../fill";

export const scales = {
  band: {
    heading: "Season band",
    intro:
      "The band along the bottom edge is the time control and shows at the same time what the passes of the current selection do over the year: three quantities per half-month, averaged over exactly these passes – summits of different heights, so a property of the selection and no statement about “the Alps”. On narrow screens the legend is only here.",
  },
  data: {
    heading: "Data",
    text: "**Elevation profile:** Open-Meteo Elevation (Copernicus DEM 90 m) along the routed road. **Weather:** Open-Meteo forecast at summit elevation, cached on the server. **Climate:** Open-Meteo archive (ERA5-Land 2015–2024) per half-month; 10 km grid, tending to be too mild at summit elevation. **Routes:** OpenRouteService (road bike profile) or OSRM. **3D:** Mapzen/AWS Terrain Tiles. Maps © OpenStreetMap contributors.",
  },
  description:
    "How the 1–5 ratings and the status per period come about – and where the data comes from.",
  destinations: {
    heading: "Destinations",
    intro:
      "A destination is an editorially drawn circle: a centre, a radius, plus single roads counted in or left out, and the towns that make a good base. What lies inside the circle is the membership – it is determined when the site is built, not maintained by hand. All numbers of a destination are **derived**, as they are for a town: “7 of 9 roads good” counts the roads in the area by their status in the chosen half-month, and the strip measures every half-month against this area's best time.",
    order:
      "**The order of the list** is a score that is shown nowhere: the beauty of every open road in full, that of every limited one at {riskyPct} %, a closed one counts nothing. Editorial like everything here – it orders, it does not measure.",
  },
  notes: {
    heading: "Notes",
    text: "Elevations and ascent data are rounded guide values. Beauty, fame, difficulty and traffic are editorial 1–5 judgements; the type and features of the roads and the features of the towns are editorial labels. The status per period is a heuristic and is no substitute for official closure information. The app serves rough route planning, not navigation.",
  },
  ranges: {
    heading: "Ranges and regions",
    intro:
      "Every road lies in a region, and every region in a range. The range is a filter and at the same time a frame: whoever picks one sees its roads in the list and on the map. A town belongs to the range of the nearest road within its reach.",
  },
  ratings: {
    heading: "Where do the 1–5 ratings come from?",
    intro:
      "Editorial judgements from the general reputation of the passes (cycling literature, Grand Tour history, quaeldich.de, climbbybike, Cyclingcols). No measured values, no user ratings – for a rough placing, not for comparing points.",
    items: [
      [
        "Fame",
        "5 = myth (Galibier, Stelvio, Ventoux, Alpe d'Huez, Glockner), 4 = regularly in the Giro/Tour/marathons, 3 = known in the scene, 2 = insider tip, 1 = hardly known.",
      ],
      [
        "Beauty",
        "Landscape, panorama, the line of the road, quiet. 5 = high-mountain scenery with a spectacular road (Bonette, Iseran, Gavia, Giau), 3 = solid, 1–2 = forest road or approach to a ski resort.",
      ],
      [
        "Difficulty",
        "Length × gradient, elevation, ramps. 5 = over 1,000 m of climbing with ramps over 10 % or very long and high, 3 = a normal Alpine pass, 1–2 = short or flat.",
      ],
      [
        "Traffic",
        "1 = almost car-free or a dead end, 3 = normal pass traffic, 5 = through road (Simplon, Lautaret, Julier). Summer weekends and motorbikes make it worse.",
      ],
    ] as [string, string][],
  },
  status: {
    derived:
      "**Derived, not measured:** The climate series applies to the summit elevation. The valley value is computed down at {lapse} to the lowest ascent start and is easily ± {error} °C off; passes without an ascent profile have none. The daylight is pure astronomy. In the detail, the reason stands under the status in one sentence, with number and source.",
    heading: "Status per period",
    intro:
      "A heuristic from the typical opening window (to the half-month), summit elevation, season, the pass's climate series (ERA5-Land 2015–2024) and the daylight. It answers “how good is it to ride there in this half-month”, not just “can you get over”. For loops the worst value of their passes applies. No substitute for official closure information.",
    ladder: "**Four rungs, one ladder.** {text}",
    strip:
      "The strip of 24 cells shows the whole year at a glance – the chosen half-month is outlined, the closure hollow with a red edge. In the detail every cell explains itself on hover.",
  },
  surface: {
    heading: "Surface",
    intro:
      "Every road says what it is ridden on. The four scales apply within the discipline: fame is fame among gravel riders, difficulty counts the surface in (6 % gravel rides like 9 % asphalt), traffic stays a scale – the Via del Sale carries motorbikes on toll days. Nobody clears an unpaved road: what closes it is the snow cover, not a barrier – the ladder below says from when.",
  },
  symbols: {
    heading: "Map symbols",
    text: "**Circle:** pass – colour shows the status, hollow circle = often closed, size = fame. **Star:** favourite. **Line:** loop (its own colour) or ascent (status colour). **Diamond:** cycling town.",
  },
  towns: {
    heading: "Why a town is in the list",
    intro:
      "Every cycling town carries up to four features. In the list they stand as icons, in the detail and on the map with text. They too are editorial: they say what stands out on site, and are no counted workshops or hotels.",
  },
  townsAsBase: {
    bandItem: "“{label}” up to {km} km",
    bands:
      "**Three distances instead of one radius.** {list}. Beyond {maxKm} km the list ends. Within it, nearness counts gradually: a pass does not become worthless at a round kilometre value, but loses weight with distance. The order comes from that together with condition, beauty and fame – which is why a beautiful pass a little further away stands before a plain one on the doorstep.",
    heading: "Towns as a base",
    intro:
      "A town has no climate series and no season of its own. What it has are the passes it reaches – and those are already rated. Everything the town detail shows is **derived** from that and says so: the number of passes in good condition, the bar beneath it and the strip of 24 cells.",
    stripMeasures:
      "**The strip shows the season, not the size.** It measures every half-month against the best time of _this_ town: from {best} of it “best time”, from {good} “good”, below that “limited”, without a single rideable pass “closed”. Otherwise a large town would hold the top rung from June to October without a break and a small one never – the strip would show the size of the town instead of its year. How much it is at all stands beside it in words. The two shares are editorial like all numbers here; `scripts/analyze-destinations.ts` checks them.",
  },
  types: {
    heading: "Type and features",
    intro:
      "The **type** says how the road lies in the terrain – every road has exactly one. The **features** say how riding there feels; a road carries none, one or several. They too are editorial labels, not counted values: what the data measures – length, gradient, elevation, border crossing – stands beside it as a number and not here.",
  },
} as const satisfies Layout<typeof de>;
