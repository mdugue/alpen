import type { DetailAssets } from "@/lib/detail-assets";
import type { MapAssets } from "@/lib/map-assets";
import type { NearbyTours, TownReach } from "@/lib/nearby";
import type { PassIndex, Years } from "@/lib/status";
import type { ClimateYear, Pass, Tour, Town } from "@/lib/types";

/**
 * Everything the page hands the client, as one value.
 *
 * `lib/data.ts` promised eleven getters for one bundle, so the explorer had
 * eleven datasets as props and the detail panel eight of them again. None of
 * the eleven is ever wanted on its own – the page awaits all of them in one
 * `Promise.all` – and a function that takes "the page's data" should be able
 * to say so (docs/plans/31-panel-model.md).
 *
 * The type lives here rather than beside `getPageData` because both sides
 * read it: the server builds it, `detailModel` and the explorer read it, and
 * `lib/data.ts` is `server-only`.
 */
export interface PageData {
  passes: Pass[];
  tours: Tour[];
  towns: Town[];
  /** Where MapLibre loads the ascent and tour lines from; see `lib/map-assets.ts`. */
  assets: MapAssets;
  /** Which tours run within reach of each entity; see `lib/nearby.ts`. */
  nearbyTours: NearbyTours;
  /** The area each town reaches, drawn on hover; see `lib/nearby.ts`. */
  townReach: TownReach;
  /** One URL per entity for its profiles and photos; see `lib/detail-assets.ts`. */
  detail: DetailAssets;
  climate: Record<string, ClimateYear>;
  /** Lowest ascent start per pass, for the derived valley heat (`lib/status.ts`). */
  valleys: Record<string, number>;
  /**
   * The 24 graded half-months of every pass and tour, computed once on the
   * server (`getYears`). Nothing on the client grades a pass itself.
   */
  years: Years;
}

/**
 * The page data plus the one index every reader of it builds. It is built
 * where the data is used rather than where it is loaded – the passes travel
 * as an array, and a `Map` does not survive the wire – but only once: the
 * explorer holds it, and the panel model takes it rather than building a
 * second one per selected tour.
 */
export interface PageBundle extends PageData {
  passIndex: PassIndex;
}
