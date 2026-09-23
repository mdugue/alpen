import { z } from "zod";

import { DE } from "@/lib/i18n/dictionaries";
import {
  COUNTRIES,
  SURFACES,
  inBox,
  isTraverse,
  LATLON_BOUNDS,
  RANGE_BOUNDS,
  rangeOf,
  REGIONS,
  ROAD_TAGS,
  ROAD_TYPES,
  TOWN_TAGS,
} from "@/lib/regions";

/**
 * Single source of truth for the shape of everything in `data/`. The types in
 * `lib/types.ts` are inferred from these schemas, `scripts/check-data.ts` and
 * `lib/data.ts` parse the files with them, `scripts/build-data.ts` validates
 * fetched results before writing, and `scripts/emit-json-schema.ts` turns
 * them into `data/schema/*.schema.json` for editor completion.
 *
 * Only server and script code may import this module: zod must not reach the
 * client bundle. Components import the types from `lib/types.ts` instead.
 */

export const Slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Slug: nur a-z, 0-9 und Bindestriche");

/** Half-month point in time: 1 = early January, 1.5 = late January … 12.5 = late December. */
export const Period = z
  .number()
  .refine(
    (t) => Number.isInteger(t * 2) && t >= 1 && t <= 12.5,
    "Halbmonat: 1, 1.5, … 12.5",
  );

export const Status = z.enum(["open", "risky", "closed"]);

export const Rating = z.int().min(1).max(5);

/**
 * A coordinate anywhere the app has a range: the union of `RANGE_BOUNDS`. The
 * real typo guard is per range – `Pass` below holds its marker and its ascents
 * to the box of its own range, `data:check` a tour's waypoints to its passes'.
 */
export const LatLon = z.strictObject({
  lat: z.number().min(LATLON_BOUNDS.lat[0]).max(LATLON_BOUNDS.lat[1]),
  lon: z.number().min(LATLON_BOUNDS.lon[0]).max(LATLON_BOUNDS.lon[1]),
});

/**
 * Per-entry exception to the route quality gate (`scripts/lib/validate.ts`),
 * for the ascents and tours that legitimately break a default limit – an ascent
 * that ends at a mountain restaurant below the summit marker, say. Ascents and
 * tours have different limits, so each kind lists only the limits its validator
 * reads; a limit that would be silently ignored cannot be written down. `note`
 * is mandatory and at least one limit has to be named: an exception nobody can
 * explain, or one that widens nothing, is a bug that has been silenced.
 */
const atLeastOneLimit = (o: Record<string, unknown>) =>
  Object.keys(o).some((k) => k !== "note");

export const AscentCheck = z
  .strictObject({
    maxEndDist: z.number().positive().optional(),
    maxGain: z.number().positive().optional(),
    maxKm: z.number().positive().optional(),
    maxStartDist: z.number().positive().optional(),
    maxTopDelta: z.number().positive().optional(),
    minPeakAt: z.number().min(0).max(1).optional(),
    /** Why this ascent legitimately breaks the default limit. */
    note: z.string().min(1, "check ohne Begründung (note)"),
  })
  .refine(atLeastOneLimit, "check nennt keine Grenze");

export const TourCheck = z
  .strictObject({
    maxKmDelta: z.number().positive().optional(),
    maxWaypointDist: z.number().positive().optional(),
    /** Why this tour legitimately breaks the default limit. */
    note: z.string().min(1, "check ohne Begründung (note)"),
  })
  .refine(atLeastOneLimit, "check nennt keine Grenze");

/**
 * One ride up or along a road. Which half of this shape applies is decided by
 * the parent's `type` and enforced by `Pass`'s refinement below: a climb
 * (`pass`, `spur`) ends at the entry's own marker and says nothing more, a
 * traverse (`plateau`, `balcony`, `valley`) names where it ends and how long
 * it is, because that is what the gate measures it against. `check` follows
 * the same split – an ascent may only widen the limits its own validator
 * reads, so a climb carries an `AscentCheck` and a traverse a `TourCheck`.
 */
export const Ascent = z.strictObject({
  /** Widens a route-gate limit for this ascent alone, see `AscentCheck`. */
  check: z.union([AscentCheck, TourCheck]).optional(),
  /** Starting point of the classic cycling ascent. */
  from: LatLon,
  /** Traverse types only: the curated length in km, from a trusted source. */
  km: z.number().positive().optional(),
  /** Display name, e.g. "Valloire (Nord)". */
  label: z.string().min(1),
  /** Traverse types only: where the ride ends – there is no summit to aim at. */
  to: LatLon.optional(),
});

/** The typical opening window of a road or a loop, as two half-months. */
const SeasonWindow = {
  /** Typical winter closure as a Period. */
  closes: Period,
  /** Typical opening as a Period. */
  opens: Period,
};

const windowOrdered = (s: { opens: number; closes: number }) =>
  s.opens < s.closes;

export const PassSeason = z
  .object({
    ...SeasonWindow,
    /** Managed toll road – it is cleared, no altitude penalty. */
    maintained: z.boolean().optional(),
  })
  .refine(windowOrdered, "Saisonfenster verdreht");

/**
 * A loop's own window, where its curator knows one: the same two half-months
 * as a pass carries, and read the same way by `tourYear` (`lib/status.ts`) –
 * outside the window the loop is closed, at its edges limited, and inside it
 * the member passes decide. No `maintained`: a loop is not cleared, its passes
 * are. `null` says the loop is rideable whenever its passes are.
 */
export const TourSeason = z
  .strictObject(SeasonWindow)
  .refine(windowOrdered, "Saisonfenster verdreht");

export const Region = z.enum(REGIONS);
export const Country = z.enum(COUNTRIES);
export const RoadType = z.enum(ROAD_TYPES);
export const RoadTag = z.enum(ROAD_TAGS);
export const Surface = z.enum(SURFACES);

export const Pass = z
  .strictObject({
    /** Other spellings people search for: "Stilfser Joch", "Grossglockner". */
    aliases: z.array(z.string().min(2)).optional(),
    ascents: z.array(Ascent),
    /** Editorial 1–5 scales, see docs/scales.md. */
    beauty: Rating,
    /** Editorial short description of the classic ascent. */
    classicAscent: z.string(),
    /** ISO-like code, possibly several: "IT", "CH/IT". */
    country: z
      .string()
      .regex(/^[A-Z]{2}(?:\/[A-Z]{2})?$/u, 'Land: "IT" oder "CH/IT"')
      .refine(
        (c) => c.split("/").every((x) => COUNTRIES.includes(x as never)),
        `Land: eines von ${COUNTRIES.join(", ")}`,
      ),
    difficulty: Rating,
    /**
     * Height of the marker, not "the summit": for a traverse type the marker is
     * a curated point on the road, and the gorge roads sit far below what a pass
     * ever does.
     */
    elevation: z.int().min(100).max(3500),
    fame: Rating,
    lat: LatLon.shape.lat,
    lon: LatLon.shape.lon,
    name: z.string().min(2),
    note: z.string(),
    /**
     * Slug of the pass on quaeldich.de, so the detail panel links straight to
     * `quaeldich.de/paesse/<slug>/` instead of a search. Curated, because
     * quäldich names a pass in its own language ("Stilfser Joch",
     * "St. Gotthardpass", "Mangrt") and no rule derives that from ours. Left
     * out for the few passes their Pässelexikon does not carry – those fall
     * back to the search.
     */
    quaeldich: Slug.optional(),
    region: Region,
    /**
     * The summit is the highest point of the asphalt, not a saddle: OSM carries
     * no `mountain_pass` node for it (toll roads, panorama roads, roads that end
     * at a glacier or a refuge). `data:locate` then skips the pass-node search
     * and offers the highest sample of the stored route instead – the only
     * honest candidate for such a road. The gate's own summit checks are
     * unchanged; a correct road summit passes them like any pass.
     *
     * Only a `pass` says this about itself; every other type is a road summit by
     * definition (`hasRoadSummit`), and `data:check` reports it as redundant
     * where it is written down anyway.
     */
    roadSummit: z.boolean().optional(),
    /** null = cleared all year round. */
    season: PassSeason.nullable(),
    slug: Slug,
    /**
     * What the road is rolled on (see `SURFACES`, plan 27). Required like the
     * type: an entry that does not say what it is rolled on is an entry nobody
     * has looked at. It picks the routing profile and the closing rung.
     */
    surface: Surface,
    /**
     * What riding the road is like, as editorial labels (see `ROAD_TAGS`).
     * Optional: plenty of roads are simply a climb, and an empty strip of glyphs
     * says that honestly. Display order is the vocabulary order.
     */
    tags: z
      .array(RoadTag)
      .refine((t) => new Set(t).size === t.length, "Merkmal doppelt (tags)")
      .optional(),
    traffic: Rating,
    /**
     * What kind of road this is (see `ROAD_TYPES`). Required on every entry
     * rather than defaulted: the file is the product, and an entry that does not
     * say what it is is an entry nobody has looked at.
     */
    type: RoadType,
  })
  /**
   * The two halves of `Ascent` that only the parent's type can decide, and the
   * same for `check`. Kept here rather than as a discriminated union so the
   * emitted JSON Schema stays one flat object an editor can complete; the
   * rules a schema cannot express are the ones `data:check` prints.
   */
  .superRefine((road, ctx) => {
    const traverse = isTraverse(road.type);
    // The marker and every ride's ends inside the box of the road's own
    // range: one wide box would let a Pyrenean col sit in "Westalpen".
    const range = rangeOf(road.region);
    const box = RANGE_BOUNDS[range];
    const outside = (p: { lat: number; lon: number }) => !inBox(box, p);
    const where = `${DE.vocab.range[range].outside} (${box.lat.join("–")}° N, ${box.lon.join("–")}° E) – Koordinate oder Region prüfen`;
    if (outside(road))
      ctx.addIssue({
        code: "custom",
        message: `Punkt liegt ${where}`,
        path: [],
      });
    for (const [i, a] of road.ascents.entries()) {
      if (outside(a.from) || (a.to !== undefined && outside(a.to)))
        ctx.addIssue({
          code: "custom",
          message: `Auffahrt liegt ${where}`,
          path: ["ascents", i],
        });
      if (traverse && (a.to === undefined || a.km === undefined))
        ctx.addIssue({
          code: "custom",
          message: `${DE.vocab.roadType[road.type].label}: Strecke braucht Ende (to) und Länge (km)`,
          path: ["ascents", i],
        });
      if (!traverse && (a.to !== undefined || a.km !== undefined))
        ctx.addIssue({
          code: "custom",
          message: `${DE.vocab.roadType[road.type].label}: Auffahrt endet am Passpunkt – to und km gehören nicht dazu`,
          path: ["ascents", i],
        });
      // A check may only widen the limits the validator of *this* ascent
      // reads; the union above accepts either shape, the type decides which.
      const shape = traverse ? TourCheck : AscentCheck;
      if (a.check !== undefined && !shape.safeParse(a.check).success)
        ctx.addIssue({
          code: "custom",
          message: traverse
            ? "check einer Strecke kennt nur maxKmDelta und maxWaypointDist"
            : "check einer Auffahrt kennt die Tour-Grenzen nicht",
          path: ["ascents", i, "check"],
        });
    }
  });

export const Tour = z.strictObject({
  /** Widens a route-gate limit for this tour alone, see `TourCheck`. */
  check: TourCheck.optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/u, "Farbe: #rrggbb"),
  description: z.string(),
  elevationGain: z.number().nonnegative(),
  km: z.number().positive(),
  name: z.string().min(2),
  /**
   * What the window cannot say: the event that closes the roads for a day,
   * the cobbles that turn slick in rain, the plan B once a pass shuts. One or
   * two German sentences; empty where there is nothing to add.
   */
  note: z.string(),
  /** Pass slugs from which the status is derived. */
  passes: z.array(Slug).min(1),
  /** The loop's own opening window, see `TourSeason`; null = whenever its passes are open. */
  season: TourSeason.nullable(),
  slug: Slug,
  /**
   * What the loop is ridden with: at least what its roads demand (`gravel`
   * or `mixed` the moment one member is), and more where the connecting
   * stretches are gravel. Written down rather than derived so the file can
   * say so; `data:check` holds it to the roads.
   */
  surface: Surface,
  waypoints: z.array(LatLon).min(2),
});

export const TownTag = z.enum(TOWN_TAGS);

export const Town = z.strictObject({
  /** Valley, region or other-language name people search for: "Val di Fassa", "Gröden". */
  aliases: z.array(z.string().min(2)).optional(),
  country: Country,
  lat: LatLon.shape.lat,
  lon: LatLon.shape.lon,
  name: z.string().min(2),
  slug: Slug,
  /**
   * Why the town is in the list, as a handful of editorial labels (see
   * `TOWN_TAGS`). At least one: a town nobody can say anything about does not
   * belong in a list meant for choosing a base.
   */
  tags: z.array(TownTag).min(1, "Ort ohne Merkmal (tags)"),
  /** Why the town is interesting for road cyclists. */
  why: z.string(),
});

export const Passes = z.array(Pass);
export const Tours = z.array(Tour);
export const Towns = z.array(Town);

/**
 * A riding area (plan 12): a centre, a radius and the editorial prose a base
 * needs – what it is like, what a week there looks like, how to get there.
 * What lies inside is not written down: the member roads, loops and towns
 * are derived at prerender from the radius, plus `include` and minus
 * `exclude` (`membersOf`, lib/destination.ts), so a road added to
 * `passes.json` joins its area by itself. The rules for the numbers are in
 * `docs/destinations.md`.
 */
export const Destination = z.strictObject({
  /** How to get there without and with a car: one or two sentences. */
  access: z.string().min(1),
  /** Where to look for a hotel first: town slugs, in the order they are named. */
  /** Where to stay, at most three; none while no town of `towns.json` lies inside. */
  baseTowns: z.array(Slug).max(3),
  /** The centre the radius is measured from – usually the main base. */
  center: LatLon,
  /** Two sentences: the roads that make the area, and what riding it is like. */
  character: z.string().min(1),
  /** Like a road's: one country or a pair, "FR/IT". */
  country: z
    .string()
    .regex(/^[A-Z]{2}(?:\/[A-Z]{2})?$/u, 'Land: "IT" oder "CH/IT"')
    .refine(
      (c) => c.split("/").every((x) => COUNTRIES.includes(x as never)),
      `Land: eines von ${COUNTRIES.join(", ")}`,
    ),
  /** Roads inside the radius that belong to a neighbour instead. */
  exclude: z.array(Slug),
  /** Roads outside the radius that belong here anyway – taste over geometry. */
  include: z.array(Slug),
  /** What a multi-day stay looks like: how many days, which stages lead on. */
  multiDay: z.string().min(1),
  name: z.string().min(2),
  note: z.string().optional(),
  /**
   * How far a road may lie from the centre and still count, in km. At most
   * the reach limit: an area wider than a day's loop from its centre is two
   * areas.
   */
  radiusKm: z.number().min(10).max(75),
  slug: Slug,
});

export const Destinations = z.array(Destination);

// ── Editorial prose in another language (plan 08) ───────────────────────────

/**
 * The curated prose of one entity in another language, keyed by slug in
 * `data/i18n/<lang>/*.json`; every field is optional, and a missing one falls
 * back to the German (`lib/data.ts`), which `data:check` counts so the
 * coverage stays visible. Proper names are not here – a name is not
 * translated – and neither is anything measured.
 */
export const PassTranslation = z.strictObject({
  /** The ascent labels by index, for the direction words in them ("Nord"). */
  ascents: z.array(z.string().min(1)).optional(),
  classicAscent: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
});
export const TourTranslation = z.strictObject({
  description: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
});
export const TownTranslation = z.strictObject({
  why: z.string().min(1).optional(),
});
export const DestinationTranslation = z.strictObject({
  access: z.string().min(1).optional(),
  character: z.string().min(1).optional(),
  multiDay: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
});
export const PassTranslations = z.record(Slug, PassTranslation);
export const TourTranslations = z.record(Slug, TourTranslation);
export const TownTranslations = z.record(Slug, TownTranslation);
export const DestinationTranslations = z.record(Slug, DestinationTranslation);

// ── Output of scripts/build-data.ts ──────────────────────────────────────────

/** Road geometry as [lat, lon] pairs. */
export const RouteGeometry = z.array(z.tuple([z.number(), z.number()])).min(2);

export const ElevationProfile = z
  .object({
    avgGradient: z.number(),
    /** Cumulative distance per sample point in km. */
    dist: z.array(z.number()),
    /** Elevation per sample point in m. */
    ele: z.array(z.number()),
    elevationGain: z.number().nonnegative(),
    km: z.number().nonnegative(),
    /** Steepest full kilometre in percent (see `steepestKm` in lib/profile.ts). */
    maxKmGradient: z.number(),
    start: z.number(),
    top: z.number(),
  })
  .refine((p) => p.dist.length === p.ele.length, "dist und ele ungleich lang");

export const ClimateBucket = z.strictObject({
  /**
   * Share of days with a snow cover above `CLIMATE_DAY.coverM` at the marker
   * (plan 27) – what closes an unpaved road, which no barrier closes. Optional
   * until the archive has been asked for `snow_depth`; a series without it
   * grades a gravel road by every other rung and never closes it.
   */
  coverPct: z.number().min(0).max(100).optional(),
  /** Share of days with frost (Tmin < 0 °C), in percent. */
  frostPct: z.number().min(0).max(100),
  /** Share of days with snowfall ≥ 1 cm, in percent. */
  snowPct: z.number().min(0).max(100),
  /** Mean daily maximum in °C. */
  tmax: z.number(),
  /** Mean daily minimum in °C. */
  tmin: z.number(),
  /** Share of days with precipitation ≥ 1 mm, in percent. */
  wetPct: z.number().min(0).max(100),
});

/** 24 half-months, index 0 = early January. null = no data. */
export const ClimateYear = z.array(ClimateBucket.nullable()).length(24);

/** Key: `${passSlug}:${index}` or `tour:${tourSlug}`. */
export const Routes = z.record(z.string(), RouteGeometry);
/** Key: `${passSlug}:${index}`. */
export const Profiles = z.record(z.string(), ElevationProfile);
/** Key: pass slug. */
export const Climate = z.record(Slug, ClimateYear);
// ── Output of scripts/build-photos.ts ────────────────────────────────────────

/**
 * One photo from Wikimedia Commons, together with everything its licence
 * obliges us to show: author, licence name and a link to the file page. Only
 * the metadata lives in the repo – the file itself stays on Wikimedia's CDN
 * and is loaded by the browser from `src`, so no binary enters the project.
 */
export const Photo = z.strictObject({
  /** Author line as plain text. Empty only where Commons names none. */
  artist: z.string(),
  /**
   * The same photo `BLUR_WIDTH` px wide as a data URI (`lib/photos.ts`), WebP
   * where this Bun can encode one, so the slide opens on its own colours
   * rather than on an empty box. Optional: a thumbnail Commons declines to
   * render costs a placeholder, not a photo.
   */
  blur: z.string().startsWith("data:image/").optional(),
  /** Height of the thumbnail `src` points at. */
  height: z.int().positive(),
  /** Licence as Commons states it, e.g. "CC BY-SA 4.0" or "Public domain". */
  license: z.string().min(1),
  licenseUrl: z.url().optional(),
  /** The Commons file page: the "source" half of the attribution. */
  page: z.url(),
  /**
   * Commons thumbnail URL, `PHOTO_WIDTH` px wide (see `lib/photos.ts`). The
   * panel derives the smaller widths of its `srcset` from it (`photoSrcSet`),
   * which is why it is kept exactly as the API spelled it.
   */
  src: z.url(),
  /** File name without the "File:" prefix and the extension – the alt text. */
  title: z.string().min(1),
  /** Width of the thumbnail `src` points at. */
  width: z.int().positive(),
});

/** Key: `pass:<slug>`, `tour:<slug>` or `town:<slug>`, see `entityKey` in `lib/route-key.ts`. */
export const Photos = z.record(z.string(), z.array(Photo));

// ── The route quality gate (scripts/lib/validate.ts) ─────────────────────────

/** Which router produced a route. Entries without meta count as `"osrm"`. */
export const RouteSource = z.enum(["ors", "osrm"]);

/** One entry of `routes-meta.json`: provenance only, the metrics are recomputed. */
export const RouteMeta = z.strictObject({
  /** ISO date of the run that stored the geometry. */
  fetchedAt: z.iso.date(),
  /**
   * What the route was asked for when it was fetched (`inputsHash` in
   * `scripts/lib/validate.ts`): the ascent's start, the marker and its
   * elevation, the `check` – a tour's waypoints and stated length. A stored
   * route whose job no longer hashes to this was fetched for coordinates that
   * have since moved, and `data:build` re-routes it.
   *
   * Required: every entry the build writes carries one, and an entry without
   * it would read as "still current" without ever having been judged.
   */
  inputs: z.string().min(1),
  /**
   * ORS answered 404 for this geometry: its road-cycling graph does not carry
   * this road (Finestre, Nivolet, the toll ramps). The route is the car
   * profile's and stays that way, so `data:check` asks for no upgrade that
   * cannot come. Cleared whenever the route is fetched anew.
   */
  orsDeclined: z.literal(true).optional(),
  source: RouteSource,
});

/** What the gate measured for one ascent. `null` before a profile exists. */
export const AscentMetrics = z.strictObject({
  endDist: z.number().nonnegative(),
  gain: z.number().nullable(),
  km: z.number().nonnegative(),
  peakAt: z.number().nullable(),
  startDist: z.number().nonnegative(),
  topDelta: z.number().nullable(),
});

export const TourMetrics = z.strictObject({
  endDist: z.number().nonnegative(),
  km: z.number().nonnegative(),
  /** Signed relative deviation from `statedKm`. */
  kmDelta: z.number(),
  startDist: z.number().nonnegative(),
  /** The curated `tour.km` this was measured against. */
  statedKm: z.number().positive(),
});

export const RouteMetrics = z.union([AscentMetrics, TourMetrics]);

/**
 * One entry of `rejected.json`. It keeps the measured values rather than the
 * geometry, because re-judging them against a changed limit is what tuning
 * needs and costs nothing; the geometry itself is free to fetch again. The
 * elevation profile *is* kept, because that one costs 100 Open-Meteo calls –
 * so changing a threshold and retrying spends no quota at all.
 */
export const RouteRejection = z.strictObject({
  /** ISO date this key was first rejected – its age is the signal that a human
   *  has to fix a coordinate rather than wait for a better route. */
  firstSeen: z.iso.date(),
  /** Identity of the rejected geometry; an unchanged hash on a retry means the
   *  router is not the problem, the coordinates are. */
  hash: z.string().min(1),
  /**
   * Hash of what the candidate was routed for – coordinates, elevation, `check`
   * (`inputsHash` in `scripts/lib/validate.ts`). The next build retries a
   * rejected key by itself once this changes or the stored metrics would pass
   * the current limits; while both hold, retrying only repeats the rejection.
   */
  inputs: z.string().min(1),
  lastSeen: z.iso.date(),
  metrics: RouteMetrics,
  /** Cached so a retry after a threshold change costs no Open-Meteo calls. */
  profile: ElevationProfile.optional(),
  /** Why it failed, as the sentences `data:check` prints. */
  reasons: z.array(z.string().min(1)).min(1),
  source: RouteSource,
});

/** Key: as `routes.json`. */
export const RoutesMeta = z.record(z.string(), RouteMeta);
/** Key: as `routes.json`. */
export const Rejected = z.record(z.string(), RouteRejection);
/**
 * DEM height at the pass coordinate, together with the coordinate it was read
 * at: a moved pass point invalidates the entry by itself instead of leaving a
 * height behind that was measured somewhere else.
 */
export const Summit = z.strictObject({
  dem: z.number(),
  lat: z.number(),
  lon: z.number(),
  /**
   * Distance in km from the pass point to the nearest drivable OSM way; null
   * when there is none within `ROAD_RADIUS` (scripts/lib/locate.ts). Missing
   * on entries from before the check existed – the next build fills it in.
   */
  roadDist: z.number().nullable().optional(),
});
/** Key: pass slug. */
export const Summits = z.record(Slug, Summit);

/**
 * One day of the Open-Meteo forecast served by `app/api/weather/[slug]`.
 *
 * Every measurement is nullable because the host answers a day or a variable
 * it has no value for with `null`, and a forecast is worth having with a cell
 * missing: requiring a number here cost the visitor the whole week over one
 * empty snowfall. The date is not – it is what the row is keyed and labelled
 * by – and a value that is neither a number nor absent is still an error.
 */
export const WeatherDay = z.strictObject({
  date: z.string(),
  precipitation: z.number().nullable(),
  snowfall: z.number().nullable(),
  tmax: z.number().nullable(),
  tmin: z.number().nullable(),
  weatherCode: z.number().nullable(),
  windMax: z.number().nullable(),
});

/**
 * How a file is laid out on disk. `indented` is the hand-maintained shape –
 * one level of indentation, so an entry stays readable and a diff shows the
 * field that changed. `byKey` is one sorted key per line with a compact value:
 * a diff of `routes.json` then names the ascent that moved instead of
 * reformatting 100 000 lines.
 */
export type Layout = "byKey" | "indented";

/** Everything a script has to know about one file in `data/`. */
export interface DataFile<S extends z.ZodType = z.ZodType> {
  /**
   * What a reader sees while the file does not exist yet – the generated ones
   * appear with the first run that needs them. `undefined` means the file has
   * to be there; a missing `passes.json` is not an empty list of passes.
   */
  empty?: unknown;
  layout: Layout;
  schema: S;
}

const curated = <S extends z.ZodType>(schema: S): DataFile<S> => ({
  layout: "indented",
  schema,
});
const generated = <S extends z.ZodType>(schema: S): DataFile<S> => ({
  empty: {},
  layout: "byKey",
  schema,
});
/** Hand-checked like the curated files, but keyed and allowed to be missing. */
const translated = <S extends z.ZodType>(schema: S): DataFile<S> => ({
  empty: {},
  layout: "indented",
  schema,
});

/**
 * Which schema validates which file, where it lives, whether it may be missing
 * and how it is written. One table, because six readers and three writers used
 * to decide each of those for themselves – and a writer that forgot the
 * validation is how a malformed answer reaches the repository. The one
 * `read`/`write` pair over it is `scripts/lib/data-files.ts`; the key is the
 * path under `data/`.
 */
export const FILES = {
  "destinations.json": curated(Destinations),
  "generated/climate.json": generated(Climate),
  "generated/photos.json": generated(Photos),
  "generated/profiles.json": generated(Profiles),
  "generated/rejected.json": generated(Rejected),
  "generated/routes-meta.json": generated(RoutesMeta),
  "generated/routes.json": generated(Routes),
  "generated/summits.json": generated(Summits),
  "i18n/en/destinations.json": translated(DestinationTranslations),
  "i18n/en/passes.json": translated(PassTranslations),
  "i18n/en/tours.json": translated(TourTranslations),
  "i18n/en/towns.json": translated(TownTranslations),
  "passes.json": curated(Passes),
  "tours.json": curated(Tours),
  "towns.json": curated(Towns),
} as const;

/** The name of one file in `data/`, as `FILES` spells it. */
export type DataFileName = keyof typeof FILES;
