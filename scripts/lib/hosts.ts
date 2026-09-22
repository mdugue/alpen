/**
 * One function per question a script asks a host. Each takes a `Transport`
 * (`scripts/lib/transport.ts`) and returns a parsed answer; the URL, the
 * request body, the weight Open-Meteo bills and the answer's shape are known
 * here and nowhere else. A script that spends API calls validates what it
 * gets (principle 4 in AGENTS.md): every answer a script reads structured
 * fields from goes through a zod schema before a number of it is trusted.
 *
 * The hosts are configured by environment: `ORS_KEY` (without it there is no
 * road-cycling router), `OSRM_HOST` to point a local OSRM at the data (see
 * docs/plans/00-…md), `OVERPASS_URL` and `OSM_MAP_URL` for a mirror.
 */
import { z } from "zod";

import { PHOTO_WIDTH } from "../../lib/photos";
import type { LatLon, RouteGeometry } from "../../lib/types";
import { overpassPost } from "./locate";
import type { OsmElement } from "./locate";
import type { Page } from "./photo-rank";
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
  from = 0,
  out: RouteGeometry = [],
): Promise<RouteGeometry> => {
  if (from >= waypoints.length - 1) return out;
  const cs = await ask(
    waypoints.slice(from, Math.min(from + perRequest, waypoints.length)),
  );
  return await stitched(waypoints, perRequest, ask, from + perRequest - 1, [
    ...out,
    ...(out.length ? cs.slice(1) : cs),
  ]);
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

/** One elevation request carries this many coordinates, and is billed one call each. */
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
  /** ERA5-Land daily series 2015–2024, height-corrected to `elevation`. */
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
  /** Copernicus DEM heights, one per point, in the points' order. */
  elevation: async (t: Transport, points: LatLon[]): Promise<number[]> =>
    Elevation.parse(
      await t.getJson(
        "openMeteo",
        `https://api.open-meteo.com/v1/elevation?latitude=${points.map((p) => p.lat).join(",")}&longitude=${points.map((p) => p.lon).join(",")}`,
        undefined,
        points.length,
      ),
    ).elevation,
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
/** Overpass `out geom` carries the coordinates inline; the map API the node ids. */
const OsmWay = z.union([
  z.object({
    geometry: z.array(z.object({ lat: z.number(), lon: z.number() })),
    id: z.number(),
    tags: Tags,
    type: z.literal("way"),
  }),
  z.object({
    id: z.number(),
    nodes: z.array(z.number()),
    tags: Tags,
    type: z.literal("way"),
  }),
]);
/** Relations and whatever else a box holds pass through and are dropped. */
const Elements = z.object({
  elements: z
    .array(z.union([OsmNode, OsmWay, z.object({ type: z.string() })]))
    .optional(),
});
const isElement = (e: { type: string }): e is OsmElement =>
  e.type === "node" || e.type === "way";
const elementsOf = (json: unknown): OsmElement[] =>
  (Elements.parse(json).elements ?? []).filter(isElement);

export const overpass = {
  /** The nodes and ways an Overpass QL query selects. */
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

const Pages = z.object({
  query: z
    .object({
      pages: z
        .array(
          z.object({
            imageinfo: z
              .array(
                z.object({
                  descriptionurl: z.string(),
                  extmetadata: z
                    .record(
                      z.string(),
                      z.object({ value: z.string().optional() }).optional(),
                    )
                    .optional(),
                  height: z.number(),
                  mime: z.string(),
                  thumburl: z.string().optional(),
                  url: z.string(),
                  width: z.number(),
                }),
              )
              .optional(),
            title: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
});

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
  return json.query?.pages ?? [];
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
