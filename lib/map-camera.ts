/**
 * Where the camera goes, and the arithmetic it goes there with – kept out of
 * `pass-map.tsx` so both can be read and tested without a WebGL context.
 *
 * MapLibre draws the camera centre in the middle of the *padded* box, so the
 * padding is not a passive margin: changing it moves the picture. The panels in
 * front of the map change it often – the detail sheet on a phone takes more
 * than half the screen – and `Map.setPadding` is a `jumpTo`, which is why the
 * app never calls it after the first frame. A padding change either rides along
 * with the camera move that caused it or eases on its own; both need the numbers
 * below.
 *
 * Which of the two it is, is not a property of the padding but of what the
 * camera is doing at that moment, and that is what `camera` at the foot of this
 * file answers: one `(state, event, env) → [state, commands]` for every camera
 * move the app makes by itself. The rule "a flight owns the padding until it
 * lands" is a transition there rather than a boolean read by three schedulers
 * (docs/plans/29-camera-machine.md). `applyCamera` in `components/map/` is the
 * only place the commands meet MapLibre.
 *
 * The app reaches for ten of the names below – `camera`, `COLD`, `toInset`,
 * `fitInset` and the `Inset` type from the two appliers and the shell,
 * `flightFor`, `fitDone`, `FIT_MS`, `FIT_PADDING` and `NO_INSET` from the map
 * component, `visibleBounds` from the scene. The rest are the thresholds this
 * file decides with, exported so the tests can name a duration or a padding
 * instead of repeating its number: a test that spelled `600` would still pass
 * after the flight was made slower, and say nothing about it.
 */

import type { MapView, Selection } from "@/lib/app-state";
import { haversine } from "@/lib/geo";
import type { Bounds } from "@/lib/geo";

/** Padding on all four edges in pixels, every side filled in. */
export interface Inset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSET: Inset = { bottom: 0, left: 0, right: 0, top: 0 };

/** MapLibre's `getPadding()` may leave sides out; here they are all numbers. */
export const toInset = (p?: Partial<Inset>): Inset => ({
  bottom: p?.bottom ?? 0,
  left: p?.left ?? 0,
  right: p?.right ?? 0,
  top: p?.top ?? 0,
});

export const sameInset = (a: Inset, b: Inset): boolean =>
  a.top === b.top &&
  a.right === b.right &&
  a.bottom === b.bottom &&
  a.left === b.left;

/**
 * The padding to hand `cameraForBounds` when the flight that follows re-pads
 * the map as it moves.
 *
 * `cameraForBounds` measures the free space against the padding the map has
 * *now* (`now`) and adds the padding it is given, but the camera lands under
 * `next`. Folding the growth of an axis into the fit padding puts the frame
 * right where the camera arrives: the sum of the two sides is what takes space
 * away from the box, so half of it per side leaves the difference of the sides
 * – and with it the centring, which the transform itself applies once the
 * flight has finished – untouched. `extra` is the breathing room around the
 * frame and is kept on every edge.
 */
export const fitInset = (now: Inset, next: Inset, extra: number): Inset => {
  const x = (next.left + next.right - now.left - now.right) / 2;
  const y = (next.top + next.bottom - now.top - now.bottom) / 2;
  return {
    bottom: extra + y,
    left: extra + x,
    right: extra + x,
    top: extra + y,
  };
};

// ── What a camera move costs, and how much room it leaves ────────────────────

/** Breathing room around a fitted frame, in pixels; the map padding is added on top. */
export const FIT_PADDING = 48;
/** The same around a selected tour, which is framed tighter than the whole map. */
export const TOUR_PADDING = 60;
/** And around a selected pass, whose box is the smaller of the two framings. */
export const PASS_PADDING = 40;
/**
 * How close a pass may be framed. Its box is the ascents, so a short one would
 * otherwise fill the screen with two hairpins; the point is the road and where
 * it starts, not the surface of it.
 */
export const PASS_MAX_ZOOM = 12.5;
/** Where a pass with no drawn ascent, and a town, are at least zoomed to. */
export const PASS_MIN_ZOOM = 11;
export const TOWN_MIN_ZOOM = 10.5;
/** A destination never flies closer than this: it is an overview, and its members are the detail. */
export const DESTINATION_MAX_ZOOM_FIT = 10;
/** A padding change nothing else moves with: long enough to read as a slide. */
export const PADDING_MS = 400;
/**
 * The camera's share of a selection: how long it leaves the panel alone, and
 * how long it then takes.
 *
 * The panel opens with the tap and the flight follows it (the `select` case of
 * `reduce`, lib/app-state.ts). It used to be the other way round – the map
 * moved and the panel opened on arrival – because the panel is the most
 * expensive thing the app draws and drawing it into a flight cost that flight
 * about a third of its frame rate on a phone. That bought a smooth flight with
 * a wait in front of the answer, which is the wrong way round: the tap was
 * about the pass, not about the camera. Opening first and moving after keeps
 * the two out of each other's frames just as well, and now it is the secondary
 * half that waits.
 *
 * The delay is the panel's first paint plus the phone drawer's slide, which
 * covers most of its distance well inside it. The flight itself is longer than
 * the 500 ms it was: nothing is waiting behind it any more, so it can be a
 * movement to follow rather than a jump to sit out.
 */
export const SELECT_DELAY = 260;
export const SELECT_MS = 1100;
/** How long a fit or a return to the overview takes when a visitor asks for it. */
export const FIT_MS = 800;

/**
 * How near the fitted frame the camera has to be for the fit button to read as
 * "already there" and offer the whole-Alps overview instead. Half a zoom step
 * is too coarse to notice and two kilometres is inside the width of one pass.
 */
const FIT_TOLERANCE = { km: 2, zoom: 0.05 };

/** Whether the camera is close enough to a fitted frame to count as on it. */
export const fitDone = (
  now: { lat: number; lon: number; zoom: number },
  target: { lat: number; lon: number; zoom: number },
): boolean =>
  Math.abs(now.zoom - target.zoom) < FIT_TOLERANCE.zoom &&
  haversine(now, target) < FIT_TOLERANCE.km;

/**
 * The box around everything the map currently draws, or `null` while it draws
 * nothing. Plain numbers rather than a `LngLatBounds`: this is what the opening
 * frame and the fit button are measured from, and neither question needs a map.
 */
export const visibleBounds = (
  passes: readonly { lat: number; lon: number }[],
  tours: readonly { slug: string; visible: boolean }[],
  tourBounds: Record<string, Bounds>,
  showPasses: boolean,
): Bounds | null => {
  let box: Bounds | null = null;
  const extend = (w: number, s: number, e: number, n: number) => {
    box = box
      ? [
          Math.min(box[0], w),
          Math.min(box[1], s),
          Math.max(box[2], e),
          Math.max(box[3], n),
        ]
      : [w, s, e, n];
  };
  if (showPasses) for (const p of passes) extend(p.lon, p.lat, p.lon, p.lat);
  for (const t of tours) {
    const b = tourBounds[t.slug];
    if (t.visible && b) extend(b[0], b[1], b[2], b[3]);
  }
  return box;
};

/** A box of no extent – a pass whose ascents the map has none of – is no box. */
const box = (b: Bounds | undefined): Bounds | null =>
  b && (b[0] !== b[2] || b[1] !== b[3]) ? b : null;

// ── The machine ──────────────────────────────────────────────────────────────

/** What a selection's flight aims at. */
export interface FlightPoint {
  lat: number;
  lon: number;
  /** The flight never zooms *out* to a point: a closer look is not a step back. */
  minZoom: number;
}

export type FlightTarget =
  | {
      kind: "bounds";
      bounds: Bounds;
      /** Breathing room around the frame, in pixels. */
      extra: number;
      maxZoom: number;
      /** Where to go when the box turns out to be unusable after all. */
      fallback: FlightPoint | null;
    }
  | { kind: "point"; point: FlightPoint }
  | { kind: "view"; view: MapView };

/**
 * What the opening camera owes a shared link, decided in `lib/hash-adapter.ts`
 * before the map is built: the link's own camera, the frame around what it
 * selected, or – with nothing in the link – whatever the map draws. `view` is
 * the camera the map is constructed with, the link's under the defaults.
 */
export interface CameraIntent {
  kind: "view" | "selection" | "fit";
  view: MapView;
}

export type CameraEvent =
  /** The opening camera, known before the map is built. */
  | { type: "intent"; intent: CameraIntent }
  /** The style is parsed and the map can be moved; `bounds` is what it draws. */
  | { type: "ready"; bounds: Bounds | null }
  | { type: "selection"; key: string | null; target: FlightTarget | null }
  | { type: "inset"; inset: Inset }
  /** A camera pasted into the address bar of an open page. */
  | { type: "requestedView"; view: MapView }
  /** A frame asked for by a control – the range chip – rather than a selection. */
  | { type: "requestedFit"; bounds: Bounds }
  /** `SELECT_DELAY` has elapsed. */
  | { type: "delay" }
  | { type: "moveend"; byUser: boolean };

export type CameraState =
  /** Before the map can be moved; what the panels ask for is collected here. */
  | { phase: "cold"; intent: CameraIntent | null; inset: Inset }
  /** The camera is where it belongs; `padded` is what the map is padded with. */
  | { phase: "idle"; padded: Inset; fitted: boolean }
  /** The panel is open, the flight is scheduled; `padding` is what it will carry. */
  | {
      phase: "awaiting";
      key: string;
      target: FlightTarget | null;
      padding: Inset;
      padded: Inset;
    }
  /** In the air with `carried`; `padding` is what has been asked for since. */
  | { phase: "flying"; key: string; carried: Inset; padding: Inset }
  /** Landed, and easing in the padding the flight could not carry. */
  | { phase: "settling"; padded: Inset };

export type CameraCommand =
  | { cmd: "setPadding"; padding: Inset }
  | { cmd: "jumpTo"; view: MapView; padding: Inset }
  | { cmd: "flyTo"; target: FlightTarget; padding?: Inset; duration: number }
  | {
      cmd: "easeTo";
      padding?: Inset;
      duration: number;
      bearing?: number;
      pitch?: number;
    }
  | { cmd: "fitBounds"; bounds: Bounds; padding: number; duration: number }
  | { cmd: "schedule"; ms: number }
  | { cmd: "cancel" }
  | { cmd: "writeHash" };

export interface CameraEnv {
  reduceMotion: boolean;
}

/** Nothing read, nothing drawn, nothing padded. */
export const COLD: CameraState = {
  inset: NO_INSET,
  intent: null,
  phase: "cold",
};

/** What the map is padded with at this moment. */
const paddedNow = (state: CameraState): Inset =>
  state.phase === "cold"
    ? NO_INSET
    : state.phase === "flying"
      ? state.carried
      : state.padded;

/** What the panels ask for at this moment, applied or not. */
const asked = (state: CameraState): Inset =>
  state.phase === "cold"
    ? state.inset
    : state.phase === "awaiting" || state.phase === "flying"
      ? state.padding
      : state.padded;

const ease = (padding: Inset, env: CameraEnv): CameraCommand => ({
  cmd: "easeTo",
  duration: env.reduceMotion ? 0 : PADDING_MS,
  padding,
});

const fit = (bounds: Bounds, duration: number): CameraCommand => ({
  bounds,
  cmd: "fitBounds",
  duration,
  padding: FIT_PADDING,
});

/**
 * What the panels ask for, applied or held back.
 *
 * A flight owns the padding until it lands: the panels can ask for a different
 * one while it is in the air – a sheet dragged to another snap point, a phone's
 * toolbar changing the viewport height by four pixels – and easing to it there
 * would cut the flight short a frame before it arrived. What is still owed is
 * applied when it settles. With nothing moving there is nothing to ride along
 * with, so a padding change with no camera move behind it – a sheet dragged,
 * the sidebar folding away – eases in on its own.
 */
const onInset = (
  state: CameraState,
  inset: Inset,
  env: CameraEnv,
): [CameraState, CameraCommand[]] => {
  if (state.phase === "cold") return [{ ...state, inset }, []];
  if (state.phase === "awaiting" || state.phase === "flying")
    return [{ ...state, padding: inset }, []];
  return sameInset(state.padded, inset)
    ? [state, []]
    : [{ ...state, padded: inset }, [ease(inset, env)]];
};

/** The camera has stopped: what that means depends on who moved it. */
const onMoveend = (
  state: CameraState,
  byUser: boolean,
  env: CameraEnv,
): [CameraState, CameraCommand[]] => {
  switch (state.phase) {
    case "cold": {
      return [state, []];
    }
    case "idle": {
      // Wherever the camera has ended up is what a link to this page should
      // carry; nothing else follows from a move that is already over.
      return [state, [{ cmd: "writeHash" }]];
    }
    case "awaiting": {
      // A hand on the map outranks a flight that has not set off.
      if (byUser)
        return [
          { fitted: true, padded: state.padded, phase: "idle" },
          [{ cmd: "cancel" }, { cmd: "writeHash" }],
        ];
      // Otherwise this is an older flight landing inside this selection's delay
      // window. It is not this camera's arrival, so nothing settles on it –
      // easing here is what used to pull the previous selection's leftover
      // padding into the flight about to set off.
      return [state, []];
    }
    case "flying": {
      return sameInset(state.carried, state.padding)
        ? [
            { fitted: true, padded: state.carried, phase: "idle" },
            [{ cmd: "writeHash" }],
          ]
        : [
            { padded: state.padding, phase: "settling" },
            [ease(state.padding, env)],
          ];
    }
    case "settling": {
      // The hash is written once per selection, and this is where the camera
      // has finally stopped.
      return [
        { fitted: true, padded: state.padded, phase: "idle" },
        [{ cmd: "writeHash" }],
      ];
    }
    default: {
      return [state satisfies never, []];
    }
  }
};

/**
 * What the map opens on: the link's camera, the frame around what it names, or
 * – with neither – what the map draws of the home range (`Scene.opening`). The
 * first two win, because a
 * selection is flown to and framing everything first would only be a camera
 * move the visitor never asked for. The fit waits for something to frame: the
 * lines and the dots may arrive after the style does.
 */
const onReady = (
  state: CameraState,
  bounds: Bounds | null,
): [CameraState, CameraCommand[]] => {
  if (state.phase !== "cold")
    return state.phase === "idle" && !state.fitted && bounds
      ? [{ ...state, fitted: true }, [fit(bounds, 0)]]
      : [state, []];
  const padded = state.inset;
  const commands: CameraCommand[] = [];
  // The first padding is set outright: the map has not drawn a frame yet, so
  // there is nothing that could jump, and the opening frame is fitted into it.
  if (!sameInset(padded, NO_INSET))
    commands.push({ cmd: "setPadding", padding: padded });
  const wants = (state.intent?.kind ?? "fit") === "fit";
  if (wants && bounds) commands.push(fit(bounds, 0));
  return [
    { fitted: !wants || bounds !== null, padded, phase: "idle" },
    commands,
  ];
};

/**
 * Every camera move the app makes by itself, as one transition table.
 *
 * The commands are what a caller then hands to MapLibre; the state is a value,
 * so a whole selection – the panel opening, the delay, the flight, the landing,
 * the hash – is a list of events in a test and needs no browser. What the
 * visitor does with the map directly (a drag, a wheel, a pinch) is not in here:
 * it arrives as `moveend` and is only ever answered with the hash.
 */
export const camera = (
  state: CameraState,
  event: CameraEvent,
  env: CameraEnv,
): [CameraState, CameraCommand[]] => {
  switch (event.type) {
    case "intent": {
      // Only ever the opening camera. A hash pasted into an open page arrives
      // as a `requestedView` or as a selection, and both outrank an intent.
      return state.phase === "cold"
        ? [{ ...state, intent: event.intent }, []]
        : [state, []];
    }

    case "inset": {
      return onInset(state, event.inset, env);
    }

    case "ready": {
      return onReady(state, event.bounds);
    }

    case "selection": {
      // Dispatched only once the map can be moved; before that a selection is
      // the `selection` intent and flies when `ready` arrives.
      if (state.phase === "cold") return [state, []];
      if (event.key === null) {
        // A flight already in the air is left to land: MapLibre cannot un-fly,
        // and a camera stopped halfway is worse than one that arrives. The
        // padding the closing panel gives back arrives as an `inset` and rides
        // that landing.
        return state.phase === "awaiting"
          ? [
              { fitted: true, padded: state.padded, phase: "idle" },
              [{ cmd: "cancel" }],
            ]
          : [state, []];
      }
      // A second selection while the first is still scheduled or in the air
      // replaces it, and the flight it had coming is dropped: what lands from
      // here on belongs to this key.
      return [
        {
          key: event.key,
          padded: paddedNow(state),
          padding: asked(state),
          phase: "awaiting",
          target: event.target,
        },
        [
          ...(state.phase === "awaiting"
            ? [{ cmd: "cancel" } as CameraCommand]
            : []),
          { cmd: "schedule", ms: env.reduceMotion ? 0 : SELECT_DELAY },
        ],
      ];
    }

    case "delay": {
      if (state.phase !== "awaiting") return [state, []];
      const { padding, target } = state;
      // What the map cannot frame – an entity it draws no line and no dot for –
      // still owes the panel its space, or the padding would sit unapplied
      // until some later sheet drag moved the picture for no reason at all.
      if (!target)
        return [
          { fitted: true, padded: padding, phase: "idle" },
          sameInset(state.padded, padding) ? [] : [ease(padding, env)],
        ];
      // The flight carries the padding the panels ask for, so opening the
      // detail and moving to what it describes is one movement rather than a
      // jump and a movement.
      return [
        { carried: padding, key: state.key, padding, phase: "flying" },
        [
          {
            cmd: "flyTo",
            duration: env.reduceMotion ? 0 : SELECT_MS,
            padding,
            target,
          },
        ],
      ];
    }

    case "moveend": {
      return onMoveend(state, event.byUser, env);
    }

    case "requestedView": {
      // The map is built on the view a link carries; this is the same link
      // pasted into a page that is already open, and it outranks what the
      // camera was doing – with the panels' padding, like every other move.
      if (state.phase === "cold") return [state, []];
      const padding = asked(state);
      return [
        { fitted: true, padded: padding, phase: "idle" },
        [
          ...(state.phase === "awaiting"
            ? [{ cmd: "cancel" } as CameraCommand]
            : []),
          { cmd: "jumpTo", padding, view: event.view },
        ],
      ];
    }

    case "requestedFit": {
      // A press on the range chip: the same standing as a hand on the map – it
      // outranks a flight still scheduled, and the frame is fitted into the
      // padding the panels ask for, which the fit carries the way a selection's
      // flight does. A box of no extent – a range whose one road has no drawn
      // ascent – is flown to as a point, like a pass without one.
      if (state.phase === "cold") return [state, []];
      const padding = asked(state);
      const bounds = box(event.bounds);
      const point: FlightPoint = {
        lat: event.bounds[1],
        lon: event.bounds[0],
        minZoom: PASS_MIN_ZOOM,
      };
      return [
        { fitted: true, padded: padding, phase: "idle" },
        [
          ...(state.phase === "awaiting"
            ? [{ cmd: "cancel" } as CameraCommand]
            : []),
          {
            cmd: "flyTo",
            duration: env.reduceMotion ? 0 : FIT_MS,
            padding,
            target: bounds
              ? {
                  bounds,
                  extra: FIT_PADDING,
                  fallback: point,
                  kind: "bounds",
                  maxZoom: PASS_MAX_ZOOM,
                }
              : { kind: "point", point },
          },
        ],
      ];
    }

    default: {
      // Every event has its case above; a new one is a type error here.
      return [event satisfies never, []];
    }
  }
};

/**
 * Where a selection's flight goes, read off what the map has to draw it with.
 *
 * A pass is framed by its roads, not centred on its marker: what makes one
 * worth a holiday is the climb to it, and on a phone the sheet leaves less than
 * half the screen, so a camera aimed at the summit pushed both ends of the
 * ascent out of the picture. A box of no extent – a pass the map draws no
 * ascent for – has no frame to speak of and falls back to the marker.
 */
export const flightFor = (
  selection: Selection,
  world: {
    passBounds: Record<string, Bounds>;
    tourBounds: Record<string, Bounds>;
    /** The box around each destination's members (`membersOf`). */
    destinationBounds: Record<string, Bounds>;
    passes: readonly { slug: string; lat: number; lon: number }[];
    towns: readonly { slug: string; lat: number; lon: number }[];
  },
): FlightTarget | null => {
  const at = (
    of: readonly { slug: string; lat: number; lon: number }[],
    minZoom: number,
  ): FlightPoint | null => {
    const found = of.find((x) => x.slug === selection.slug);
    return found ? { lat: found.lat, lon: found.lon, minZoom } : null;
  };
  if (selection.kind === "town") {
    const point = at(world.towns, TOWN_MIN_ZOOM);
    return point && { kind: "point", point };
  }
  // An area is framed by what it holds, with the room a fit gets: the circle
  // is the overview's picture, the members are what selecting it is about.
  if (selection.kind === "destination") {
    const bounds = box(world.destinationBounds[selection.slug]);
    return (
      bounds && {
        bounds,
        extra: FIT_PADDING,
        fallback: null,
        kind: "bounds",
        maxZoom: DESTINATION_MAX_ZOOM_FIT,
      }
    );
  }
  if (selection.kind === "tour") {
    const bounds = box(world.tourBounds[selection.slug]);
    return (
      bounds && {
        bounds,
        extra: TOUR_PADDING,
        fallback: null,
        kind: "bounds",
        maxZoom: PASS_MAX_ZOOM,
      }
    );
  }
  const fallback = at(world.passes, PASS_MIN_ZOOM);
  const bounds = box(world.passBounds[selection.slug]);
  if (bounds)
    return {
      bounds,
      extra: PASS_PADDING,
      fallback,
      kind: "bounds",
      maxZoom: PASS_MAX_ZOOM,
    };
  return fallback && { kind: "point", point: fallback };
};
