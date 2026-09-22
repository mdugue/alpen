import { REACH_BANDS } from "@/lib/geo";
import type { ReachBand } from "@/lib/geo";
import {
  COUNTRY_NAME,
  RANGE,
  ROAD_TAG,
  ROAD_TYPE,
  SURFACE,
  TOWN_TAG,
} from "@/lib/regions";

/** One band's words, from the table the reach is computed with. */
const bandOf = (key: ReachBand): { hint: string; label: string } => {
  const b = REACH_BANDS.find((x) => x.key === key)!;
  return { hint: b.hint, label: b.label };
};

/**
 * The vocabulary: what a range, a country, a tag, a road type, a surface, a
 * reach band, a sort and a filter option is called. In German these are the
 * tables of `lib/regions.ts` and `lib/geo.ts` themselves – the scripts and
 * the search read them by name – so this file only gathers them under one
 * roof; the English file writes its own.
 */
export const vocab = {
  band: {
    day: bandOf("day"),
    door: bandOf("door"),
    trip: bandOf("trip"),
  },
  country: COUNTRY_NAME,
  /** The chips of the filter panel and their applied form. */
  filter: {
    beauty: (option: string) => `Schönheit ${option}`,
    difficulty: (lo: number, hi: number) =>
      lo === hi ? `Schwierigkeit ${lo}` : `Schwierigkeit ${lo}–${hi}`,
    fame: (option: string) => `Bekanntheit ${option}`,
    favoritesOnly: "nur Gemerkte",
    /** The status chips read as alternatives: "gut oder eingeschränkt". */
    statusOr: " oder ",
    traffic: (option: string) => `Verkehr ${option}`,
    valley: (option: string) => `Tal ${option}`,
    wetDays: (option: string) => `Regentage ${option}`,
  },
  /** The label of one threshold chip; `n` arrives formatted. */
  option: {
    any: "egal",
    elevationFrom: (m: string) => `ab ${m} m`,
    from: (n: number) => `ab ${n}`,
    only: (n: number) => `nur ${n}`,
    under: (t: number) => `unter ${t} °C`,
    upTo: (n: number) => `bis ${n}`,
    wetDays: (n: number) => `bis ${n} von 15`,
  },
  /** The legend line while the overview is thinned by fame. */
  prominence: {
    famous: "berühmte Pässe",
    known: "bekannte Pässe",
  },
  range: RANGE,
  /** What a base or an area says about the roads around it. */
  reach: {
    areaLine: (rideable: string, total: string) =>
      `${rideable} von ${total} Straßen gut`,
    areaNone: "keine Straße im Gebiet",
    count: {
      best: (n: number) => `${n} zur besten Zeit`,
      closed: (n: number) => `${n} oft gesperrt`,
      good: (n: number) => `${n} gut`,
      limited: (n: number) => `${n} eingeschränkt`,
    },
    noneRideable: (total: number) =>
      `Keiner der ${total} Pässe im Umkreis ist in diesem Halbmonat gut befahrbar.`,
    noneWithin: (km: number) => `Kein Pass im Umkreis von ${km} km.`,
    ofTotal: (total: number, parts: string) =>
      `Von ${total} Pässen im Umkreis: ${parts}.`,
  },
  roadTag: ROAD_TAG,
  roadType: ROAD_TYPE,
  sort: {
    beauty: "Schönheit",
    difficulty: "Schwierigkeit",
    elevation: "Höhe",
    fame: "Bekanntheit",
    name: "Name",
    status: "Status",
    traffic: "Verkehr",
  },
  surface: SURFACE,
  townTag: TOWN_TAG,
  /** The unit words that are not international: the metres of climbing, and "about". */
  unit: {
    approx: "ca.",
    climb: "hm",
  },
};
