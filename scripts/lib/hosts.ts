/**
 * One function per question a script asks a host. Each takes a `Transport`
 * (`scripts/lib/transport.ts`) and returns a parsed answer; the URL, the
 * request body, the weight Open-Meteo bills and the answer's shape are known
 * here and nowhere else. A script that spends API calls validates what it
 * gets (principle 4 in AGENTS.md): every answer a script reads structured
 * fields from goes through a zod schema before a number of it is trusted, and
 * the shapes the pure modules work on are inferred from those schemas
 * (`OsmElement` for `locate.ts`, `Page` for `photo-rank.ts`) so that a shape
 * is described once rather than written down a second time by hand.
 *
 * An answer is a list of rows, and a row a host cannot deliver in full is
 * dropped rather than taken for the whole answer: Commons indexes files whose
 * image info is missing the fields the ranking reads, and an OSM box holds
 * relations among its nodes and ways. Skipping them is what the hand-written
 * filters did before the schemas existed, and a run that ends on one of them
 * is a run that fetched nothing.
 *
 * The hosts are configured by environment: `ORS_KEY` (without it there is no
 * road-cycling router), `OSRM_HOST` to point a local OSRM at the data (see
 * docs/plans/00-…md), `OVERPASS_URL` and `OSM_MAP_URL` for a mirror.
 */
import { z } from "zod";

import { PHOTO_WIDTH } from "../../lib/photos";
import type { LatLon, RouteGeometry } from "../../lib/types";
import type { Bytes, Transport } from "./transport";
import { LIMITS } from "./validate";

export const ORS_KEY = process.env.ORS_KEY ?? "";
const OSRM_HOST = process.env.OSRM_HOST ?? "https://router.project-osrm.org";
export const OVERPASS_URL =
  process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
/** `.json` rather than the XML default – the elements then read like Overpass'. */
export const OSM_MAP_URL =
  process.env.OSM_MAP_URL ?? "https://api.openstreetmap.org/api/0.6/map.json";
/** Commons asks for a descriptive User-Agent; the CDN gets the same one. */
const COMMONS_UA =
  "alpenpaesse-data-build/1.0 (https://github.com/mdugue/alpen; mail@manuel.fyi)";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/**
 * A list in the sizes one request may carry. `overlap` repeats that many of
 * the previous chunk's last entries in the next one, which is what a route
 * through more waypoints than fit needs: the last point of one chunk is the
 * first of the next, so the pieces meet on the road rather than beside it.
 */
const chunks = <T>(xs: T[], size: number, overlap = 0): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length - overlap; i += size - overlap)
    out.push(xs.slice(i, i + size));
  return out;
};

/** The rows of an answer that parse; a row that does not is skipped. */
const parsable = <T>(rows: unknown[], row: z.ZodType<T>): T[] => {
  const out: T[] = [];
  for (const r of rows) {
    const parsed = row.safeParse(r);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
};

/**
 * How far ORS may snap a waypoint onto the road network. Deliberately the same
 * number as the gate's `maxStartDist`: the router is allowed to move a start
 * exactly as far as the gate still considers it the same start.
 */
const SNAP_RADIUS = LIMITS.ascent.maxStartDist;

// ---------------------------------------------------------------------------
// Routers

/** GeoJSON `[lon, lat]`, sometimes with a third value; only the first two count. */
const Coordinates = z.array(z.tuple([z.number(), z.number()], z.number()));
const OrsAnswer = z.object({
  features: z.array(
    z.object({ geometry: z.object({ coordinates: Coordinates }) }),
  ),
});
const OsrmAnswer = z.object({
  code: z.string(),
  routes: z
    .array(z.object({ geometry: z.object({ coordinates: Coordinates }) }))
    .optional(),
});

/** GeoJSON `[lon, lat]` to the stored `[lat, lon]`, five decimals (≈ 1 m). */
const toGeometry = (coords: [number, number, ...number[]][]): RouteGeometry =>
  coords.map(([x, y]) => [+y.toFixed(5), +x.toFixed(5)]);

/**
 * A route through more waypoints than one request may carry is asked for in
 * overlapping chunks – the last point of one is the first of the next – and
 * stitched back together without the shared point. One chunk after the other:
 * the host paces them anyway, and the order is the road.
 */
const stitched = async (
  waypoints: LatLon[],
  perRequest: number,
  ask: (chunk: LatLon[]) => Promise<RouteGeometry>,
): Promise<RouteGeometry> => {
  const out: RouteGeometry = [];
  for (const piece of chunks(waypoints, perRequest, 1)) {
    const cs = await ask(piece);
    out.push(...(out.length ? cs.slice(1) : cs));
  }
  return out;
};

export const ors = {
  /** The road-cycling route through the waypoints, 50 per request. */
  route: (t: Transport, waypoints: LatLon[]) =>
    stitched(waypoints, 50, async (chunk) => {
      const json = OrsAnswer.parse(
        await t.getJson(
          "ors",
          "https://api.openrouteservice.org/v2/directions/cycling-road/geojson",
          {
            body: JSON.stringify({
              coordinates: chunk.map((c) => [c.lon, c.lat]),
              instructions: false,
              // Some ascent starts sit in a village centre > 350 m (ORS default) from a cycling-road edge.
              radiuses: chunk.map(() => SNAP_RADIUS * 1000),
            }),
            headers: {
              Authorization: ORS_KEY,
              "Content-Type": "application/json",
            },
            method: "POST",
          },
        ),
      );
      return toGeometry(json.features[0]!.geometry.coordinates);
    }),
};

export const osrm = {
  /** The car route through the waypoints, 12 per request. */
  route: (t: Transport, waypoints: LatLon[]) =>
    stitched(waypoints, 12, async (chunk) => {
      const coords = chunk.map((c) => `${c.lon},${c.lat}`).join(";");
      const json = OsrmAnswer.parse(
        await t.getJson(
          "osrm",
          `${OSRM_HOST}/route/v1/driving/${coords}?overview=full&geometries=geojson`,
        ),
      );
      if (json.code !== "Ok") throw new Error(json.code);
      return toGeometry(json.routes![0]!.geometry.coordinates);
    }),
};

// ---------------------------------------------------------------------------
// Open-Meteo

/**
 * One elevation request carries this many coordinates, and is billed one call
 * each. A longer list is split here rather than by the caller, so no caller
 * can forget – the way `ors.route` and `osrm.route` chunk their waypoints.
 */
export const ELEVATION_BATCH = 100;
const CLIMATE_FROM = "2015-01-01";
const CLIMATE_TO = "2024-12-31";
/** Open-Meteo weight of one climate request: one call per started 14-day period. */
export const CLIMATE_WEIGHT = Math.ceil(
  (Date.parse(CLIMATE_TO) - Date.parse(CLIMATE_FROM)) / 86_400_000 / 14,
);

const Elevation = z.object({ elevation: z.array(z.number()) });
const Daily = z.object({
  daily: z.object({
    precipitation_sum: z.array(z.number().nullable()),
    snowfall_sum: z.array(z.number().nullable()),
    temperature_2m_max: z.array(z.number().nullable()),
    temperature_2m_min: z.array(z.number().nullable()),
    time: z.array(z.string()),
  }),
});
export type DailySeries = z.infer<typeof Daily>["daily"];

export const openMeteo = {
  /**
   * Daily series 2015–2024, height-corrected to `elevation`, from Open-Meteo's
   * default archive model ("Best Match": ERA5 and ERA5-Land, from 2017 ECMWF
   * IFS at 9 km, blended). No `models=` is passed, so that is what
   * `data/generated/climate.json` holds; pinning `models=era5_land` would
   * change every stored series and means fetching all of them again.
   */
  archive: async (
    t: Transport,
    at: { lat: number; lon: number; elevation: number },
  ): Promise<DailySeries> =>
    Daily.parse(
      await t.getJson(
        "openMeteo",
        `https://archive-api.open-meteo.com/v1/archive?latitude=${at.lat}&longitude=${at.lon}` +
          `&elevation=${at.elevation}&start_date=${CLIMATE_FROM}&end_date=${CLIMATE_TO}` +
          `&daily=temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_sum&timezone=Europe%2FBerlin`,
        undefined,
        CLIMATE_WEIGHT,
      ),
    ).daily,
  /**
   * Copernicus DEM heights, one per point, in the points' order –
   * `ELEVATION_BATCH` points per request, billed one call per point.
   */
  elevation: async (t: Transport, points: LatLon[]): Promise<number[]> => {
    const out: number[] = [];
    for (const chunk of chunks(points, ELEVATION_BATCH)) {
      out.push(
        ...Elevation.parse(
          await t.getJson(
            "openMeteo",
            `https://api.open-meteo.com/v1/elevation?latitude=${chunk.map((p) => p.lat).join(",")}&longitude=${chunk.map((p) => p.lon).join(",")}`,
            undefined,
            chunk.length,
          ),
        ).elevation,
      );
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// OSM: Overpass and the map API

const Tags = z.record(z.string(), z.string()).optional();
const OsmNode = z.object({
  id: z.number(),
  lat: z.number(),
  lon: z.number(),
  tags: Tags,
  type: z.literal("node"),
});
/** Overpass `out geom` carries the coordinates inline … */
const OsmGeomWay = z.object({
  geometry: z.array(z.object({ lat: z.number(), lon: z.number() })),
  id: z.number(),
  tags: Tags,
  type: z.literal("way"),
});
/** … the map API the node ids, resolved in `waysWithGeometry`. */
const OsmNodesWay = z.object({
  id: z.number(),
  nodes: z.array(z.number()),
  tags: Tags,
  type: z.literal("way"),
});
const OsmElementRow = z.union([OsmNode, OsmGeomWay, OsmNodesWay]);
const Elements = z.object({ elements: z.array(z.unknown()).optional() });

export type OverpassNode = z.infer<typeof OsmNode>;
export type OverpassWay = z.infer<typeof OsmGeomWay>;
export type OsmElement = z.infer<typeof OsmElementRow>;

/**
 * The nodes and ways of an answer. A bounding box holds relations too, and
 * they are dropped here the way the measuring filtered them out before – as
 * is a node without coordinates or a way without either a geometry or its
 * node ids, because what is half-read is not a measurement.
 */
const elementsOf = (json: unknown): OsmElement[] =>
  parsable(Elements.parse(json).elements ?? [], OsmElementRow);

/**
 * A POST to Overpass. The Apache in front of overpass-api.de answers a bare
 * `fetch` with 406 before the query is ever parsed – it wants the form
 * content type and a User-Agent it recognises as a client rather than a
 * runtime default.
 */
const overpassPost = (query: string): RequestInit => ({
  body: `data=${encodeURIComponent(query)}`,
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "alpen-data/1.0 (https://github.com/mdugue/alpen)",
  },
  method: "POST",
});

export const overpass = {
  /** The nodes and ways an Overpass QL query selects (`locate.ts` writes it). */
  query: async (t: Transport, query: string): Promise<OsmElement[]> =>
    elementsOf(await t.getJson("overpass", OVERPASS_URL, overpassPost(query))),
};

export const osmMap = {
  /** Everything inside a `minlon,minlat,maxlon,maxlat` box (`mapBbox`). */
  bbox: async (t: Transport, bbox: string): Promise<OsmElement[]> =>
    elementsOf(await t.getJson("osmApi", `${OSM_MAP_URL}?bbox=${bbox}`)),
};

// ---------------------------------------------------------------------------
// Wikimedia Commons

/** The parts of one `imageinfo` entry that the choice depends on. */
const CommonsImageInfo = z.object({
  descriptionurl: z.string(),
  extmetadata: z
    .record(z.string(), z.object({ value: z.string().optional() }).optional())
    .optional(),
  height: z.number(),
  mime: z.string(),
  /** The thumbnail Commons rendered for the requested width, if any. */
  thumburl: z.string().optional(),
  url: z.string(),
  width: z.number(),
});
/** One page of an `action=query` answer, in the order the API returned it. */
const CommonsPage = z.object({
  imageinfo: z.array(CommonsImageInfo).optional(),
  title: z.string(),
});
const Pages = z.object({
  query: z.object({ pages: z.array(z.unknown()).optional() }).optional(),
});

export type ImageInfo = z.infer<typeof CommonsImageInfo>;
export type Page = z.infer<typeof CommonsPage>;

/** An `action=query` for files with their image info, plus the generator's own parameters. */
const commonsQuery = async (
  t: Transport,
  params: Record<string, string>,
): Promise<Page[]> => {
  const url = new URL(COMMONS_API);
  for (const [k, v] of Object.entries({
    action: "query",
    format: "json",
    formatversion: "2",
    iiextmetadatafilter: "Artist|Credit|LicenseShortName|LicenseUrl",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: String(PHOTO_WIDTH),
    prop: "imageinfo",
    ...params,
  }))
    url.searchParams.set(k, v);
  const json = Pages.parse(
    await t.getJson("commons", url.href, {
      headers: { "User-Agent": COMMONS_UA },
    }),
  );
  // Commons indexes files whose image info has no size, no file URL or no
  // description page. Such a page cannot be ranked or credited, so it is
  // dropped here rather than allowed to end a run of 120 requests.
  return parsable(json.query?.pages ?? [], CommonsPage);
};

export const commons = {
  /** Everything Commons has within `radius` metres of the point, in its order. */
  geosearch: (t: Transport, at: { lat: number; lon: number }, radius: number) =>
    commonsQuery(t, {
      generator: "geosearch",
      ggscoord: `${at.lat}|${at.lon}`,
      ggslimit: "50",
      ggsnamespace: "6",
      ggsradius: String(radius),
    }),
  /** Bitmap files whose name or description mentions the place. */
  search: (t: Transport, name: string) =>
    commonsQuery(t, {
      generator: "search",
      gsrlimit: "30",
      gsrnamespace: "6",
      gsrsearch: `filetype:bitmap ${name}`,
    }),
  /** The bytes of a thumbnail on the file CDN (`thumbUrl` in `lib/photos.ts`). */
  thumbnail: (t: Transport, url: string): Promise<Bytes> =>
    t.getBytes("commonsThumb", url, {
      headers: { "User-Agent": COMMONS_UA },
    }),
};

// ---------------------------------------------------------------------------
// GitHub

export const github = {
  /** One asset of a release, e.g. the Inter zip the glyphs are rasterised from. */
  release: (
    t: Transport,
    repo: string,
    tag: string,
    asset: string,
  ): Promise<Bytes> =>
    t.getBytes(
      "github",
      `https://github.com/${repo}/releases/download/${tag}/${asset}`,
    ),
};
