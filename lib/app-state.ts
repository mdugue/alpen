import { ROAD_TYPES } from "@/lib/regions";
import { STATUS_ORDER } from "@/lib/status";
import type { LatLon, Period, RoadTag, RoadType, Status } from "@/lib/types";

export type EntityKind = "pass" | "tour" | "town";
export interface Selection {
  kind: EntityKind;
  slug: string;
}

/**
 * All three selected = no status filter, see `Filters.status`. A copy rather
 * than an alias of `STATUS_ORDER`: the filter's array is handed to callers
 * that build new arrays from it, and sharing one object under two names would
 * let a stray sort reach the map icons, the share image and the calibration
 * script.
 */
export const ALL_STATUS: Status[] = [...STATUS_ORDER];
/** All five road types selected = no type filter, see `Filters.types`. */
export const ALL_TYPES: RoadType[] = [...ROAD_TYPES];
/** Stable empty snapshot for the tag filter (`Filters.tags`). */
export const NO_TAGS: RoadTag[] = [];
export const ALL_KINDS: EntityKind[] = ["pass", "tour", "town"];
/**
 * What each kind is called, beside the vocabulary it labels rather than beside
 * the tab row that draws it – the season bar names the current list too, and
 * `STATUS_LABEL` sits next to `STATUS_ORDER` for the same reason. "Straßen"
 * rather than "Pässe": the list holds spurs and valley roads as well.
 */
export const KIND_LABEL: Record<EntityKind, string> = {
  pass: "Straßen",
  tour: "Touren",
  town: "Orte",
};

export const PASS_SORTS = [
  "elevation",
  "name",
  "status",
  "beauty",
  "fame",
  "difficulty",
  "traffic",
] as const;
export type PassSort = (typeof PASS_SORTS)[number];

/** Editorial 1–5 scale bounds; the difficulty filter is a window inside them. */
export const RATING_MIN = 1;
export const RATING_MAX = 5;

/**
 * The thresholds the chips offer, hash value → chip label. The first entry
 * of every list is "no filter" (its value is the default) and gets no chip:
 * a threshold chip is pressed while it applies and pressed again to lift it,
 * so an untouched group shows no pressed chip at all. The hash parsers accept
 * exactly these values, so a link never applies a filter the control cannot
 * show. Wording: `ab` for a lower bound, `bis` for an upper bound, `nur` for
 * the end of the scale.
 */
export type Options = readonly (readonly [value: number, label: string])[];
export const TRAFFIC_OPTIONS = [
  [5, "egal"],
  [3, "bis 3"],
  [2, "bis 2"],
  [1, "nur 1"],
] as const satisfies Options;
export const BEAUTY_OPTIONS = [
  [1, "egal"],
  [3, "ab 3"],
  [4, "ab 4"],
  [5, "nur 5"],
] as const satisfies Options;
/**
 * The full ladder, "nur 5" included: nine roads carry it – Galibier, Alpe
 * d'Huez, Ventoux, Stelvio, Mortirolo, Großglockner, Zoncolan, Ghisallo,
 * Sormano – and "only the ones everybody knows" is exactly the question
 * somebody planning their first Alpine week asks.
 */
export const FAME_OPTIONS = [
  [1, "egal"],
  [3, "ab 3"],
  [4, "ab 4"],
  [5, "nur 5"],
] as const satisfies Options;
/**
 * Pass height as a few round thresholds rather than a slider: the question is
 * "the high ones" or "the really high ones", not "above 1.700 m", and a
 * threshold is a chip a thumb can hit.
 */
export const ELEVATION_OPTIONS = [
  [0, "egal"],
  [1500, "ab 1.500 m"],
  [2000, "ab 2.000 m"],
  [2500, "ab 2.500 m"],
] as const satisfies Options;
/**
 * The raw summer signals, so the data that makes July queryable is not buried
 * under the composite status: the valley's derived mean daily maximum and the
 * share of rain days in the chosen half-month (`lib/status.ts`).
 */
export const HEAT_NONE = 99;
/**
 * A regular ladder in 2 °C steps rather than a pair of hand-picked numbers: a
 * ladder is read as a scale, where two lonely values are read as somebody's
 * opinion. 26 °C is `HEAT_VALLEY_TMAX` from `lib/status.ts`, the line at which
 * the status itself starts saying "eingeschränkt: Hitze", so one rung of the
 * ladder is exactly "kein Hitze-Hinweis" and the filter asks what the list
 * answers. The bound is strict, as the status one is, hence "unter" rather
 * than "bis": a pass flagged for heat must never survive the heat filter.
 * The span covers the summer field, which runs from about 18 °C to 31 °C in
 * mid-July; what a rung is worth in a given half-month is on its chip.
 */
export const HEAT_OPTIONS = [
  [HEAT_NONE, "egal"],
  [28, "unter 28 °C"],
  [26, "unter 26 °C"],
  [24, "unter 24 °C"],
  [22, "unter 22 °C"],
] as const satisfies Options;
/** All fifteen days of the half-month: no filter. */
export const WET_NONE = 15;
/**
 * Counted in rain days out of the fifteen a half-month has, not in per cent.
 * The climate bucket stores a share, but the share is not what anybody plans
 * with – "an 53 % der Tage" is a number to convert, "8 von 15 Tagen" is one to
 * picture – and it is already the unit `REASON_TEXT` writes. Storing the days
 * also means the hash carries the number on the chip (`w=6`), so nothing in
 * the URL looks invented either. `daysOf` in `lib/status.ts` does the
 * conversion at comparison time.
 *
 * Another regular ladder, every second day. Its top rung is exactly the line
 * the status draws: `daysOf(pct) <= 10` holds precisely when `pct` is below
 * `WET_LIMITED_PCT`, so "bis 10 von 15" is "kein Nass-Hinweis", the way
 * "unter 26 °C" is "kein Hitze-Hinweis".
 */
export const WET_OPTIONS = [
  [WET_NONE, "egal"],
  [10, "bis 10 von 15"],
  [8, "bis 8 von 15"],
  [6, "bis 6 von 15"],
  [4, "bis 4 von 15"],
] as const satisfies Options;

/**
 * The chips of a threshold group: every option but the first, which is "no
 * filter" and has no chip of its own.
 */
export const thresholdChips = (options: Options) => options.slice(1);

/**
 * One member of a "which of these" set toggled – the status, the road types.
 * The set is stored as "what stays visible" and the whole vocabulary means
 * no filter, so the chips show nothing pressed then; pressing one narrows
 * the list to it, pressing the last pressed one lifts the filter again. An
 * empty set is never produced: a filter that hides everything is not a state
 * anyone asks for, and it is what "all or none selected" used to allow.
 */
export const toggleMember = <T extends string>(
  current: readonly T[],
  all: readonly T[],
  member: T,
): T[] => {
  const picked = current.length === all.length ? [] : current;
  const next = picked.includes(member)
    ? picked.filter((m) => m !== member)
    : [...picked, member];
  return next.length === 0 || next.length === all.length
    ? [...all]
    : all.filter((m) => next.includes(m));
};

/** The chips that show as pressed for such a set: none while the whole vocabulary is in. */
export const pickedMembers = <T extends string>(
  current: readonly T[],
  all: readonly T[],
): readonly T[] => (current.length === all.length ? [] : current);

/**
 * One level of the difficulty window toggled. The five cells behave like
 * checkboxes that keep the window in one piece: a cell outside the window
 * extends it, an end cell shrinks it, an interior cell narrows the window to
 * itself, and the last cell lifts the filter. The full scale is no filter and
 * shows no pressed cell, like the sets above.
 */
export const toggleLevel = (
  [lo, hi]: readonly [number, number],
  level: number,
): [number, number] => {
  const full: [number, number] = [RATING_MIN, RATING_MAX];
  if (lo === RATING_MIN && hi === RATING_MAX) return [level, level];
  if (level < lo) return [level, hi];
  if (level > hi) return [lo, level];
  if (lo === hi) return full;
  if (level === lo) return [lo + 1, hi];
  if (level === hi) return [lo, hi - 1];
  return [level, level];
};

export interface Filters {
  period: Period;
  /** Statuses that stay visible; all three = no filter. Passes and tours. */
  status: Status[];
  /**
   * The pass criteria below apply to passes and, through their passes, to
   * tours: a tour needs one pass that clears the lower bounds (elevation,
   * fame, beauty, min. difficulty) and every pass has to respect the upper
   * bounds (max. difficulty, traffic). Towns see only search and favourites.
   */
  minFame: number;
  minElevation: number;
  /** Inclusive window on the 1–5 scale; [1, 5] = no filter. */
  difficulty: [min: number, max: number];
  /** 5 = no filter. */
  maxTraffic: number;
  /** 1 = no filter. */
  minBeauty: number;
  /**
   * Upper bounds on the raw summer signals of the chosen half-month, see
   * `HEAT_OPTIONS` and `WET_OPTIONS`; a pass without the value does not pass
   * an active one. `HEAT_NONE` / `WET_NONE` = no filter.
   */
  maxValleyTmax: number;
  maxWetDays: number;
  /**
   * Which kinds of road stay in the lists; all five = no filter. A set rather
   * than a single choice, because "passes and spurs, but no valleys" is a real
   * question. Like the other lower bounds it reaches a tour through its
   * passes: one member road of a selected type is enough.
   */
  types: RoadType[];
  /**
   * Editorial road labels that all have to be present (and-semantics): two
   * selected labels mean "car-free *and* glacier", which is what a planner
   * asks two filters for. Empty = no filter. Not applied to tours – a label
   * describes one road, and a loop with a car-free spur in it is not a
   * car-free loop.
   */
  tags: RoadTag[];
  sort: PassSort;
  query: string;
  favoritesOnly: boolean;
}

/**
 * The period here is only a placeholder: the page is handed today's half-month
 * by the server and the visitor's own choice wins over both (`load` below).
 */
export const DEFAULT_FILTERS: Filters = {
  difficulty: [RATING_MIN, RATING_MAX],
  favoritesOnly: false,
  maxTraffic: RATING_MAX,
  maxValleyTmax: HEAT_NONE,
  maxWetDays: WET_NONE,
  minBeauty: RATING_MIN,
  minElevation: 0,
  minFame: 1,
  period: 10,
  query: "",
  sort: "elevation",
  status: ALL_STATUS,
  tags: NO_TAGS,
  types: ALL_TYPES,
};

export interface MapView {
  lat: number;
  lon: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export const DEFAULT_VIEW: MapView = {
  bearing: 0,
  lat: 46.3,
  lon: 9.6,
  pitch: 0,
  zoom: 6.5,
};

/** Drops keys that are undefined (or NaN) so a spread does not overwrite defaults. */
export const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(o).filter(
      ([, v]) => v !== undefined && !(typeof v === "number" && Number.isNaN(v)),
    ),
  ) as Partial<T>;

// ── What the map shows ───────────────────────────────────────────────────────

/**
 * The "auf der Karte" switches: passes and towns as one bit each, tours as the
 * hidden ones – so a tour added to the data is on the map until somebody turns
 * it off. Not a filter: what the list shows for a kind is what the map draws
 * for that kind, and this only adds a layer toggle on top of it.
 */
export interface Shown {
  passes: boolean;
  towns: boolean;
  hiddenTours: string[];
}

export const ALL_SHOWN: Shown = {
  hiddenTours: [],
  passes: true,
  towns: true,
};

/** The switch of a kind that has one. */
const SWITCH = { pass: "passes", town: "towns" } as const;

export const isShown = (shown: Shown, kind: EntityKind, slug: string) =>
  kind === "tour" ? !shown.hiddenTours.includes(slug) : shown[SWITCH[kind]];

/**
 * How many of `total` tours the map draws – the n/m beside the master switch,
 * and "all of them" is what that switch is on for. Counted from the hidden
 * ones rather than from the slugs, because `reconcileShown` has already
 * dropped whatever left the data.
 */
export const shownTourCount = (shown: Shown, total: number) =>
  total - shown.hiddenTours.length;

/**
 * Drops hidden slugs that left `data/tours.json`. Without it a stale slug in
 * storage kept the master switch reading "off" while every tour was drawn.
 */
export const reconcileShown = (
  shown: Shown,
  tourSlugs: readonly string[],
): Shown => {
  const hiddenTours = shown.hiddenTours.filter((s) => tourSlugs.includes(s));
  return hiddenTours.length === shown.hiddenTours.length
    ? shown
    : { ...shown, hiddenTours };
};

/** Selecting something makes it visible: nobody asks for a detail of what is hidden. */
const reveal = (shown: Shown, sel: Selection): Shown => {
  if (isShown(shown, sel.kind, sel.slug)) return shown;
  return sel.kind === "tour"
    ? { ...shown, hiddenTours: shown.hiddenTours.filter((s) => s !== sel.slug) }
    : { ...shown, [SWITCH[sel.kind]]: true };
};

// ── The phone's two sheets ───────────────────────────────────────────────────

/**
 * The two bottom sheets on phones, and where each rests.
 *
 * Two drawers again, but not the two it started with. The first version kept
 * the list drawer on screen *always*, resting on a peek row – so a detail
 * always had a second, useless drawer behind it, and the map was never free of
 * furniture. Collapsing both into one sheet fixed the overlap and lost the
 * separation. This keeps both: neither drawer exists until it is asked for.
 *
 * No drawer covers the map at rest. The season bar's "Liste" button opens the
 * list; the list is dismissed by a swipe and is gone again. A selection opens
 * the detail drawer over whatever is there – over the list when the tap came
 * from a row, over the bare map when it came from the map itself – and
 * dismissing it uncovers exactly what was underneath. That is the model the
 * two drawers were always trying to express, and it only works because the
 * one behind is there by choice.
 */
export const LIST_SNAPS = [0.5, 0.92] as const;
export const DETAIL_SNAPS = [0.55, 0.92] as const;
const [LIST_HALF, LIST_FULL] = LIST_SNAPS;
const [DETAIL_HALF, DETAIL_FULL] = DETAIL_SNAPS;

export interface SheetState {
  /** The list drawer exists only while it is wanted. */
  list: { open: boolean; snap: number };
  /**
   * Whether the filter panel inside the list is unfolded, `null` while nobody
   * has said. Here rather than in the sidebar because the phone's "Filter"
   * button opens the list and the panel in one press.
   */
  filters: boolean | null;
  detail: {
    snap: number;
    /**
     * Whether the detail drawer belongs *inside* the list drawer – which is
     * how Base UI is told to stack the two, the list scaling back and peeking
     * above the detail in front of it.
     *
     * It is decided when the selection is made and then left alone: what is
     * underneath a detail is where it was opened from, and that does not
     * change while it is open. Moving a mounted drawer from one tree to the
     * other would remount it anyway.
     */
    nested: boolean;
  };
}

const SHEETS_AT_REST: SheetState = {
  detail: { nested: false, snap: DETAIL_HALF },
  filters: null,
  list: { open: false, snap: LIST_HALF },
};

// ── The app state ────────────────────────────────────────────────────────────

export interface AppState {
  /**
   * Whether `load` has run: what the hash and the storage said has been read
   * in. Until then nothing is written back to either – the first commit holds
   * the defaults, and writing those would overwrite a shared link or the last
   * visit's settings before they have been read.
   */
  loaded: boolean;
  /**
   * What is selected. The panel opens with the tap, not with the camera's
   * arrival: selecting something is an answer about that thing, and the map's
   * flight is the slower, secondary half of it. The panel, the map's layers
   * and feature state, the highlighted row and the URL hash all follow this
   * value in the same frame, and the camera sets off once the panel is on
   * screen (`SELECT_DELAY` in `pass-map.tsx`). That order is what keeps the
   * two out of each other's frames – drawing the panel *into* a flight cost
   * that flight about a third of its frame rate on a phone-sized viewport –
   * and it is the honest one: the expensive thing is what was asked for, the
   * flight is not.
   */
  selection: Selection | null;
  /**
   * What the sheet keeps showing while it slides away; without it the sheet
   * would empty out the moment the selection is cleared.
   */
  last: Selection | null;
  /** Which of the three lists is on screen. */
  tab: EntityKind;
  /**
   * What the pointer is over – wherever the pointer happens to be. The list
   * and the map are two halves of one screen showing the same entities, and
   * one piece of state shared by both is what lets a row ring its mark and a
   * mark tint its row. It deliberately lives *next to* the selection rather
   * than inside it, because hovering must never move the camera, write the
   * hash or open a panel.
   *
   * It is not persisted and not in the hash: it describes a pointer, and a
   * pointer is not part of a shared link.
   */
  hovered: Selection | null;
  /** Where the elevation-profile cursor sits on the road; the map draws it. */
  profileCursor: LatLon | null;
  filters: Filters;
  /**
   * The visitor's own last choice of half-month, and the only thing the
   * period preference is written from: `filters.period` is what is applied,
   * and a half-month from a shared link lands there without becoming the
   * visitor's own.
   */
  ownPeriod: Period | null;
  view: MapView;
  /** Camera from a hash pasted into an open page; the map applies it once. */
  requestedView: MapView | null;
  shown: Shown;
  sheet: SheetState;
}

/** The persisted slices, as the storage adapter reads them (`lib/use-stored.ts`). */
export interface StoredState {
  period?: Period | null;
  shown?: Shown;
  tab?: EntityKind;
}

/**
 * What a shared link can carry: a shape over the three values above, which is
 * why it is declared here rather than beside the parser. `lib/hash.ts` reads
 * this module's vocabulary – the option ladders a hash value is validated
 * against, the defaults it falls back to – so the dependency runs one way and
 * the two modules do not import each other.
 */
export interface HashState {
  filters: Partial<Filters>;
  selection: Selection | null;
  view: Partial<MapView>;
}

export const EMPTY_HASH: HashState = { filters: {}, selection: null, view: {} };

export type Action =
  /** The world read in: on hydration, and again on every `hashchange`. */
  | { type: "load"; hash: HashState; stored: StoredState }
  | { type: "select"; selection: Selection }
  | { type: "back" }
  | { type: "hover"; selection: Selection | null }
  | { type: "profileCursor"; at: LatLon | null }
  | { type: "view"; view: MapView }
  | { type: "filters"; update: (f: Filters) => Filters }
  | { type: "period"; period: Period }
  | { type: "tab"; tab: EntityKind }
  | { type: "toggleKind"; kind: "pass" | "town"; on: boolean }
  | { type: "toggleTour"; slug: string; on: boolean }
  /** The master switch over every tour. */
  | { type: "toggleTours"; on: boolean }
  /** Opens or closes the list drawer, with or without its filter panel. */
  | { type: "list"; open: boolean; filters?: boolean }
  | { type: "snap"; sheet: "list" | "detail"; snap: number }
  | { type: "filtersOpen"; open: boolean | null };

/** What the reducer needs from outside the state and never changes it. */
export interface Env {
  /** Whether the two sheets are the layout (`MOBILE_QUERY`). */
  mobile: boolean;
  /** Today's half-month, computed on the server; where the period falls back to. */
  today: Period;
  /** Every tour's slug, for `reconcileShown` and the master switch. */
  tours: readonly string[];
}

/**
 * Selecting something: the one copy of the rule. The row's tab comes forward
 * (the lists are one at a time, and a highlighted row behind a tab is no
 * answer), the hover and the profile cursor are cleared, the kind is revealed
 * on the map, and on a phone the detail drawer comes up over whatever is
 * there – stacked on the list when it is open, alone over the map otherwise,
 * and at least as high as the list it covers, so the list's swipe handle never
 * peeks out above it and leaves two of them on screen.
 */
const select = (state: AppState, selection: Selection, env: Env): AppState => {
  const { list } = state.sheet;
  const sheet: SheetState = env.mobile
    ? {
        ...state.sheet,
        detail: {
          nested: list.open,
          snap: list.open && list.snap >= LIST_FULL ? DETAIL_FULL : DETAIL_HALF,
        },
      }
    : state.sheet;
  return {
    ...state,
    hovered: null,
    last: selection,
    profileCursor: null,
    selection,
    sheet,
    shown: reveal(state.shown, selection),
    tab: selection.kind,
  };
};

/** Nothing selected any more; `last` stays so the leaving sheet has something to show. */
const close = (state: AppState): AppState => ({
  ...state,
  hovered: null,
  profileCursor: null,
  selection: null,
});

/**
 * What the hash and the storage say, applied: the filters and the camera are
 * the defaults under whatever the link carries. A selection in the link is
 * selected the way a tap selects, so the tab, the reveal and the sheet all
 * follow; a link without one closes whatever was open.
 */
const load = (
  state: AppState,
  hash: HashState,
  stored: StoredState,
  env: Env,
): AppState => {
  const view = { ...DEFAULT_VIEW, ...defined(hash.view) };
  const next: AppState = {
    ...state,
    filters: {
      ...DEFAULT_FILTERS,
      ...defined(hash.filters),
      // The half-month the app opens on: a shared link wins over the
      // visitor's own last choice, which wins over today's half-month from
      // the server (docs/data-model.md, "Time reckoning").
      period: hash.filters.period ?? stored.period ?? env.today,
    },
    ownPeriod: stored.period ?? null,
    // Only a hash that arrives at an open page asks the camera for anything.
    // The one the page opened on is what the map is *built* with (`cameraIntent`,
    // lib/hash-adapter.ts), and asking for it a second time would take the
    // camera off the flight that frames what the same link names – every link
    // the app writes carries a camera, so that is every shared link with an
    // entity in it.
    requestedView:
      state.loaded &&
      (hash.view.lat !== undefined || hash.view.zoom !== undefined)
        ? view
        : state.requestedView,
    shown: reconcileShown(stored.shown ?? state.shown, env.tours),
    tab: stored.tab ?? state.tab,
    view,
  };
  return hash.selection ? select(next, hash.selection, env) : close(next);
};

export const reduce = (state: AppState, action: Action, env: Env): AppState => {
  switch (action.type) {
    case "load": {
      return { ...load(state, action.hash, action.stored, env), loaded: true };
    }
    case "select": {
      return select(state, action.selection, env);
    }
    case "back": {
      return close(state);
    }
    case "hover": {
      return { ...state, hovered: action.selection };
    }
    case "profileCursor": {
      return { ...state, profileCursor: action.at };
    }
    case "view": {
      return { ...state, view: action.view };
    }
    case "filters": {
      return { ...state, filters: action.update(state.filters) };
    }
    case "period": {
      return {
        ...state,
        filters: { ...state.filters, period: action.period },
        ownPeriod: action.period,
      };
    }
    case "tab": {
      return { ...state, tab: action.tab };
    }
    case "toggleKind": {
      return {
        ...state,
        shown: { ...state.shown, [SWITCH[action.kind]]: action.on },
      };
    }
    case "toggleTour": {
      const { hiddenTours } = state.shown;
      const next = action.on
        ? hiddenTours.filter((s) => s !== action.slug)
        : [...new Set([...hiddenTours, action.slug])];
      return { ...state, shown: { ...state.shown, hiddenTours: next } };
    }
    case "toggleTours": {
      return {
        ...state,
        shown: { ...state.shown, hiddenTours: action.on ? [] : [...env.tours] },
      };
    }
    case "list": {
      return {
        ...state,
        sheet: {
          ...state.sheet,
          filters: action.filters ?? state.sheet.filters,
          list: { ...state.sheet.list, open: action.open },
        },
      };
    }
    case "snap": {
      return {
        ...state,
        sheet: {
          ...state.sheet,
          [action.sheet]: { ...state.sheet[action.sheet], snap: action.snap },
        },
      };
    }
    case "filtersOpen": {
      return { ...state, sheet: { ...state.sheet, filters: action.open } };
    }
    default: {
      // Every action has its case above; a new one is a type error here.
      return action satisfies never;
    }
  }
};

/**
 * The state before anything has been read: today's half-month, nothing
 * selected, everything shown. It is what both the server and the hydrating
 * client render – identical, so no hydration mismatch – and the `load` action
 * dispatched once hydrated is what the hash and the storage make of it
 * (`useHashAdapter`), which is where the resolution is tested.
 */
export const initialState = (today: Period): AppState => ({
  filters: { ...DEFAULT_FILTERS, period: today },
  hovered: null,
  last: null,
  loaded: false,
  ownPeriod: null,
  profileCursor: null,
  requestedView: null,
  selection: null,
  sheet: SHEETS_AT_REST,
  shown: ALL_SHOWN,
  tab: "pass",
  view: DEFAULT_VIEW,
});
