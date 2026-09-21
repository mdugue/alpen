/**
 * Where the OSM facts come from. Two questions are asked of OSM – the drivable
 * ways under a point and the pass nodes around it – and two hosts can answer
 * them:
 *
 * - **Overpass** answers a query. One request covers a batch of points, which
 *   is why it is asked first.
 * - **the OSM map API** answers a bounding box with everything inside it. One
 *   request per point, megabytes where Overpass sends kilobytes, and the
 *   filtering happens here instead of on the server.
 *
 * The fallback exists because Overpass is a single host with no SLA: while
 * `overpass-api.de` refused every connection, `bun run data:locate` could not
 * be run at all and thirteen wrong pass coordinates – and the 27 ascents the
 * gate holds back behind them – had no path forward. The map API is
 * openstreetmap.org itself, so "OSM is down" and "the data cannot be curated"
 * are at least the same outage now.
 *
 * It is a fallback, not a choice: the first Overpass failure of a run switches
 * every later question over and says so once, and nothing switches back,
 * because a host that just refused a connection will refuse the next one too
 * and each retry costs the wall-clock of a timeout.
 *
 * The I/O is the `Transport` handed in (`scripts/lib/transport.ts`), which
 * paces both hosts; the two questions themselves are `overpass.query` and
 * `osmMap.bbox` in `hosts.ts`. So this module has no pacer of its own and the
 * pure measuring helpers in `locate.ts` stay pure.
 */
import type { LatLon } from "../../lib/types";
import {
  OSM_MAP_URL,
  OVERPASS_URL,
  osmMap,
  overpass as overpassHost,
} from "./hosts";
import {
  CANDIDATE_RADIUS,
  ROAD_RADIUS,
  candidatesQuery,
  mapBbox,
  passNodesWithin,
  waysWithGeometry,
  roadsQuery,
} from "./locate";
import type { OsmElement, OverpassWay } from "./locate";
import type { Transport } from "./transport";

export interface OsmOptions {
  log?: (line: string) => void;
  /** Force the map API, e.g. with `OVERPASS_URL=""`. */
  overpass?: boolean;
  transport: Transport;
}

/** One line, no stack: the reason belongs in the log, the trace does not. */
const reasonOf = (error: unknown) =>
  (error instanceof Error ? error.message : String(error))
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, 120);

/**
 * A box the map API refused as too full. It answers 400 with the limit in the
 * body; halving the radius is worth a try because what is being looked for –
 * the road under the point, the saddle next to it – sits at the centre.
 */
const tooManyNodes = (error: unknown) =>
  /too many nodes|bbox.*too large|too large.*bbox/iu.test(reasonOf(error));

export const osmSource = (opts: OsmOptions) => {
  const log = (line: string) => opts.log?.(line);
  /** Set to the reason once Overpass has failed; the run stays on the map API. */
  let overpassDown: string | null =
    opts.overpass === false || OVERPASS_URL === ""
      ? "abgeschaltet (OVERPASS_URL)"
      : null;
  /**
   * The last two bbox answers of the run. `locate-pass` asks for the pass
   * nodes within 6 km and then for the roads under that point and every
   * candidate – all inside the box it already has, so the cache turns eight
   * requests of a few megabytes into one.
   */
  const boxes: {
    elements: OsmElement[];
    maxLat: number;
    maxLon: number;
    minLat: number;
    minLon: number;
  }[] = [];

  const overpass = async (query: string): Promise<OsmElement[] | null> => {
    if (overpassDown) return null;
    try {
      return await overpassHost.query(opts.transport, query);
    } catch (error) {
      overpassDown = reasonOf(error);
      log(
        `  Overpass antwortet nicht (${overpassDown}) – der Rest dieses Laufs kommt von ${new URL(OSM_MAP_URL).host}: eine Anfrage je Punkt statt eine je Bündel, und deutlich mehr Bytes.`,
      );
      return null;
    }
  };

  const map = async (p: LatLon, radiusKm: number): Promise<OsmElement[]> => {
    const [minLon, minLat, maxLon, maxLat] = mapBbox(p, radiusKm)
      .split(",")
      .map(Number) as [number, number, number, number];
    const cached = boxes.find(
      (b) =>
        b.minLat <= minLat &&
        b.minLon <= minLon &&
        b.maxLat >= maxLat &&
        b.maxLon >= maxLon,
    );
    if (cached) return cached.elements;

    for (let r = radiusKm, tries = 0; ; r /= 2, tries += 1) {
      try {
        const elements = await osmMap.bbox(opts.transport, mapBbox(p, r));
        // Only a box that was asked for in full answers for a later, smaller
        // one; a halved box would answer for a question it does not cover.
        if (tries === 0) {
          boxes.unshift({ elements, maxLat, maxLon, minLat, minLon });
          // Two: the box a pass is being worked on plus the one before it.
          // Every box is megabytes, so this is a window, not a store.
          boxes.length = Math.min(boxes.length, 2);
        }
        return elements;
      } catch (error) {
        if (!tooManyNodes(error) || tries >= 2) throw error;
        log(
          `  OSM-API: Ausschnitt um ${p.lat}, ${p.lon} zu voll – noch einmal mit ${(r / 2).toFixed(1)} km`,
        );
      }
    }
  };

  return {
    /** Which host answered – for the closing line of a run. */
    get fallback() {
      return overpassDown;
    },
    /**
     * The pass and saddle nodes around a point, best-effort: the map API's box
     * is cut back to the same circle Overpass would have answered with.
     */
    async passNodes(p: LatLon, radiusKm = CANDIDATE_RADIUS) {
      const viaOverpass = await overpass(candidatesQuery(p, radiusKm));
      return viaOverpass === null
        ? passNodesWithin(p, radiusKm, await map(p, radiusKm))
        : viaOverpass.filter((e) => e.type === "node");
    },
    /**
     * The drivable ways near any of the points. The result is one flat list
     * for the batch, exactly as `distanceToWays` wants it: the nearest way
     * wins, and which point's box it came out of does not matter.
     */
    async roads(
      points: LatLon[],
      radiusKm = ROAD_RADIUS,
    ): Promise<OverpassWay[]> {
      const viaOverpass = await overpass(roadsQuery(points, radiusKm));
      if (viaOverpass !== null) return waysWithGeometry(viaOverpass);
      const out: OverpassWay[] = [];
      for (const p of points)
        out.push(...waysWithGeometry(await map(p, radiusKm)));
      return out;
    },
  };
};

export type OsmSource = ReturnType<typeof osmSource>;
