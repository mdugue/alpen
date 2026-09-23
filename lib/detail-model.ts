import type { Selection } from "@/lib/app-state";
import {
  areaText,
  areaVerdict,
  basesOf,
  destinationOf,
  destinationsOfTown,
} from "@/lib/destination";
import type { Bases, BaseVerdict, DerivedVerdict } from "@/lib/destination";
import type { DetailState } from "@/lib/detail-state";
import { fill, surfaceWord } from "@/lib/i18n";
import type { Messages } from "@/lib/i18n";
import type { PageBundle } from "@/lib/page-data";
import { periodIndex } from "@/lib/period";
import { reachedPasses, reachedTowns, withinReach } from "@/lib/reach";
import type { Reach, ReachKind } from "@/lib/reach";
import { entityKey } from "@/lib/route-key";
import {
  bestText,
  cellAt,
  climateText,
  inputAt,
  reasonParagraph,
  seasonText,
  signalsOf,
  statusRank,
  tourSeasonText,
  tourText,
} from "@/lib/status";
import type { Year, YearCell } from "@/lib/status";
import type {
  ClimateBucket,
  ClimateYear,
  Destination,
  LatLon,
  Pass,
  Period,
  Tour,
  Town,
} from "@/lib/types";

/**
 * What the detail panel shows, as a value.
 *
 * The panel was a shell that found the entity, cast it seven times, branched
 * on its kind three more and handed all nineteen of its props to whichever
 * branch won – which is why adding a field to what a pass shows meant reading
 * a thousand lines to find out who else was passing it on
 * (docs/plans/31-panel-model.md). `detailModel` resolves once and returns one
 * discriminated value; the four kind modules under `components/panel/` take
 * their half of it and render markup.
 *
 * It is a pure function of the page's data and three pieces of browser state,
 * all of them arguments: the chosen half-month, what the pointer is over, and
 * where the entity's detail file has got to. Nothing here reads a hook, a
 * storage key or the DOM.
 */

/** Every folding block of the panel, by `Section` id. */
export type BlockId =
  | "rating"
  | "ascents"
  | "weather"
  | "climate"
  | "bases"
  | "nearby"
  | "tour-passes"
  | "destination-passes"
  | "area-passes"
  | "area-tours"
  | "area-towns"
  | "area-travel";

/**
 * Which blocks each kind can show, in the order it shows them. The four kind
 * modules render that order in JSX; this is the list they are held to, by the
 * test that reads the `data-block` ids back out of the rendered panel
 * (`components/panel/kind-detail.test.tsx`) – which is why the order lives
 * here and not only in the markup. Can, not does: `nearby` renders nothing for
 * an entity with nothing inside `REACH_MAX_KM`, so a reader counting sections
 * has to ask the block, not this list. It is also the vocabulary of the fold
 * state:
 * `Section` takes a `BlockId` and nothing else, so a block that is folded away
 * keeps its fold across entities because it cannot be spelled two ways.
 */
export const BLOCKS: Record<DetailModel["kind"], BlockId[]> = {
  destination: ["area-passes", "area-tours", "area-towns", "area-travel"],
  pass: ["rating", "ascents", "weather", "climate", "bases", "nearby"],
  tour: ["tour-passes", "nearby"],
  town: ["destination-passes", "nearby"],
};

/** What stands over the name in the panel head. */
const KICKER = {
  destination: (d: Destination, w: Messages) =>
    fill(w.panel.kicker.destination, { country: d.country }),
  pass: (p: Pass, w: Messages) =>
    [
      w.vocab.roadType[p.type].label,
      surfaceWord(p.surface, w),
      w.vocab.region[p.region],
      p.country,
    ]
      .filter(Boolean)
      .join(" · "),
  tour: (w: Messages) => w.panel.kicker.tour,
  town: (t: Town, w: Messages) =>
    fill(w.panel.kicker.town, { country: t.country }),
};

/** What the verdict box reads: the graded year and the two lines beside it. */
export interface Verdict {
  year: Year | undefined;
  /** The best window, as `bestText` writes it; a tour names none. */
  best: string | null;
  /** The one sentence under the badge: why the verdict is what it is. */
  text: string | null;
}

interface Common {
  period: Period;
  /** What the pointer is over, anywhere on screen; every name here lights a mark. */
  hovered: Selection | null;
  kicker: string;
  name: string;
  detail: DetailState;
}

/** The three kinds with a point of their own, and so a "what is near it" block. */
interface Reaching extends Common {
  /**
   * What else is within reach, minus what this kind's own ranked block already
   * shows – measured once in `lib/reach.ts` and read two ways.
   */
  reach: Reach;
}

export interface PassModel extends Reaching {
  kind: "pass";
  pass: Pass;
  cell: YearCell;
  verdict: Verdict;
  /** Every line the pass panel shows outside the verdict box, in the page's language. */
  sentences: {
    season: string;
    /** The pass's own note, as curated. */
    note: string;
    /** The "abgeleitet" paragraph; absent with no climate series. */
    climate: string | null;
  };
  /** The climate series and the bucket of the chosen half-month. */
  climate: ClimateYear | undefined;
  bucket: ClimateBucket | null;
  /** Towns this road could be ridden from, banded and ranked. */
  bases: Bases;
}

export interface TourModel extends Reaching {
  kind: "tour";
  tour: Tour;
  verdict: Verdict;
  /** The season paragraph: the loop's own window, or that its passes decide, then the note. */
  season: string;
  /** The passes of the round, in the tour's own order; unknown slugs are dropped. */
  members: { pass: Pass; cell: YearCell }[];
}

export interface TownModel extends Reaching {
  kind: "town";
  town: Town;
  /** The verdict of a base is the verdict of what it reaches. */
  destination: BaseVerdict;
  /** The areas this town lies in, the ones naming it as a base first. */
  areas: Destination[];
}

/**
 * What a destination shows: the area as curated, its members resolved, the
 * verdict derived from the members' years. No reach block – the members are
 * what the curator drew the circle around, and a second list of "what else is
 * near the centre" would only repeat them with distances.
 */
export interface DestinationModel extends Common {
  kind: "destination";
  destination: Destination;
  verdict: DerivedVerdict;
  /** "7 von 9 Straßen gut" – the sentence under the badge. */
  text: string;
  /** The member roads, best cell first, then by beauty and elevation; `season` is the road's own strip. */
  passes: { pass: Pass; cell: YearCell; season: YearCell[] }[];
  tours: { tour: Tour; cell: YearCell }[];
  /** The towns inside, the named bases first. */
  towns: Town[];
}

export type DetailModel = PassModel | TourModel | TownModel | DestinationModel;
/** The models the nearby block reads: every kind but the area, which has no point to measure from. */
export type ReachingModel = Exclude<DetailModel, DestinationModel>;

/** The browser state the model is read for; none of it is reached for here. */
export interface DetailInput {
  period: Period;
  hovered: Selection | null;
  detail: DetailState;
  /** The page's words: every sentence of the model is in them. */
  w: Messages;
}

export const detailModel = (
  selection: Selection,
  data: PageBundle,
  state: DetailInput,
): DetailModel | null => {
  const { period, w } = state;
  const common = {
    detail: state.detail,
    hovered: state.hovered,
    period,
  };
  /** The one reach call, with what is fixed for this selection filled in. */
  const reachOf = (
    at: LatLon,
    claimed?: ReachKind[],
    /** The entity's own slug, where the entity is a point among its own kind. */
    exclude?: string,
  ): Reach =>
    withinReach(at, {
      claimed,
      exclude,
      passes: data.passes,
      period,
      tourReach: data.nearbyTours[entityKey(selection)] ?? [],
      tours: data.tours,
      towns: data.towns,
      years: data.years,
    });

  if (selection.kind === "pass") {
    const pass = data.passes.find((p) => p.slug === selection.slug);
    if (!pass) return null;
    const year = data.years.passes[pass.slug];
    const cell = cellAt(year, period);
    const signals = signalsOf(data, pass.slug);
    const climate = data.climate[pass.slug];
    const bucket = climate?.[periodIndex(period)] ?? null;
    return {
      ...common,
      // The towns are the pass panel's own ranked block, so the reach leaves
      // them out rather than listing them again under a second heading.
      bases: basesOf(
        reachedTowns(pass, data.towns, data.passes, data.years, period),
      ),
      bucket,
      cell,
      climate,
      kicker: KICKER.pass(pass, w),
      kind: "pass",
      name: pass.name,
      pass,
      reach: reachOf(pass, ["towns"], pass.slug),
      sentences: {
        climate: bucket ? climateText(pass, bucket, signals, period, w) : null,
        note: pass.note,
        season: seasonText(pass, w),
      },
      verdict: {
        best: bestText(year, w),
        text: reasonParagraph(
          pass,
          period,
          cell.reasons,
          inputAt(signals, period),
          w,
        ),
        year,
      },
    };
  }

  if (selection.kind === "tour") {
    const tour = data.tours.find((t) => t.slug === selection.slug);
    if (!tour) return null;
    const year = data.years.tours[tour.slug];
    const cell = cellAt(year, period);
    return {
      ...common,
      kicker: KICKER.tour(w),
      kind: "tour",
      members: tour.passes
        .map((slug) => data.passIndex.get(slug))
        .filter((pass) => pass !== undefined)
        .map((pass) => ({
          cell: cellAt(data.years.passes[pass.slug], period),
          pass,
        })),
      name: tour.name,
      // A tour is a line; the panel has always read its surroundings from the
      // first waypoint, and the server measured the tours the same way.
      reach: reachOf(tour.waypoints[0]!),
      season: tourSeasonText(tour, w),
      tour,
      verdict: {
        best: null,
        // The passes that hold the tour back come from the cell, not from a
        // second pass over the members: the sentence and the badge describe
        // one set.
        text: tourText(tour, cell, (slug) => data.passIndex.get(slug)?.name, w),
        year,
      },
    };
  }

  if (selection.kind === "destination") {
    const destination = data.destinations.find(
      (d) => d.slug === selection.slug,
    );
    const members = data.destinationMembers[selection.slug];
    if (!destination || !members) return null;
    const verdict = areaVerdict(members.passes, data.years, period);
    const isBase = (slug: string) => destination.baseTowns.includes(slug);
    return {
      ...common,
      destination,
      kicker: KICKER.destination(destination, w),
      kind: "destination",
      name: destination.name,
      passes: members.passes
        .map((slug) => data.passIndex.get(slug))
        .filter((pass) => pass !== undefined)
        .map((pass) => ({
          cell: cellAt(data.years.passes[pass.slug], period),
          pass,
          season: data.years.passes[pass.slug]?.cells ?? [],
        }))
        .toSorted(
          (a, b) =>
            statusRank(a.cell.status) - statusRank(b.cell.status) ||
            b.pass.beauty - a.pass.beauty ||
            b.pass.elevation - a.pass.elevation,
        ),
      text: areaText(verdict, w),
      tours: members.tours
        .map((slug) => data.tours.find((t) => t.slug === slug))
        .filter((tour) => tour !== undefined)
        .map((tour) => ({
          cell: cellAt(data.years.tours[tour.slug], period),
          tour,
        })),
      towns: members.towns
        .map((slug) => data.townIndex.get(slug))
        .filter((town) => town !== undefined)
        .toSorted(
          (a, b) =>
            Number(isBase(b.slug)) - Number(isBase(a.slug)) ||
            a.name.localeCompare(b.name, "de"),
        ),
      verdict,
    };
  }

  const town = data.towns.find((t) => t.slug === selection.slug);
  if (!town) return null;
  return {
    ...common,
    areas: destinationsOfTown(town, data.destinations, data.destinationMembers),
    // The passes are the town panel's own ranked block, one fold above.
    destination: destinationOf(
      reachedPasses(town, data.passes, data.years, period),
      period,
    ),
    kicker: KICKER.town(town, w),
    kind: "town",
    name: town.name,
    reach: reachOf(town, ["passes"], town.slug),
    town,
  };
};
