import { describe, expect, test } from "bun:test";

import type { Bounds } from "@/lib/map-assets";
import {
  camera,
  COLD,
  FIT_PADDING,
  fitDone,
  fitInset,
  flightFor,
  NO_INSET,
  PADDING_MS,
  PASS_MAX_ZOOM,
  PASS_MIN_ZOOM,
  PASS_PADDING,
  sameInset,
  SELECT_DELAY,
  SELECT_MS,
  shellEdge,
  toInset,
  TOUR_PADDING,
  TOWN_MIN_ZOOM,
  visibleBounds,
} from "@/lib/map-camera";
import type {
  CameraCommand,
  CameraEnv,
  CameraEvent,
  CameraIntent,
  FlightTarget,
  Inset,
} from "@/lib/map-camera";

test("toInset fills in the sides MapLibre leaves out", () => {
  expect(toInset({ left: 400 })).toEqual({
    bottom: 0,
    left: 400,
    right: 0,
    top: 0,
  });
  expect(toInset()).toEqual(NO_INSET);
});

test("sameInset compares all four edges", () => {
  const a = { bottom: 440, left: 12, right: 0, top: 0 };
  expect(sameInset(a, { ...a })).toBe(true);
  expect(sameInset(a, { ...a, bottom: 80 })).toBe(false);
  expect(sameInset(a, { ...a, top: 1 })).toBe(false);
});

describe("fitInset", () => {
  test("is the plain breathing room while the padding stays put", () => {
    const now = { bottom: 80, left: 12, right: 0, top: 0 };
    expect(fitInset(now, now, 60)).toEqual({
      bottom: 60,
      left: 60,
      right: 60,
      top: 60,
    });
  });

  test("the sheet growing takes half of the growth off each edge", () => {
    // The detail sheet opens: 80 px of padding below become 440.
    const fit = fitInset(
      { bottom: 80, left: 0, right: 0, top: 0 },
      { bottom: 440, left: 0, right: 0, top: 0 },
      60,
    );
    // The box loses the 360 px the sheet took …
    expect(fit.top + fit.bottom).toBe(60 + 60 + 360);
    // … and stays centred where the camera lands, so the sides keep their
    // difference – here zero.
    expect(fit.top).toBe(fit.bottom);
    expect(fit.left).toBe(60);
    expect(fit.right).toBe(60);
  });

  test("a panel that folds away gives the space back", () => {
    const fit = fitInset(
      { bottom: 0, left: 760, right: 0, top: 0 },
      { bottom: 0, left: 396, right: 0, top: 0 },
      48,
    );
    expect(fit.left + fit.right).toBe(48 + 48 - 364);
    expect(fit.top).toBe(48);
  });
});

describe("shellEdge", () => {
  test("a phone's bar carries the controls and covers its height", () => {
    expect(shellEdge(true, 96, 400, 12)).toEqual({
      controls: 96,
      cover: 96,
      left: 0,
    });
  });
  test("a desktop card stands beside the panels and covers the gap too", () => {
    expect(shellEdge(false, 80, 396, 12)).toEqual({
      controls: 0,
      cover: 92,
      left: 396,
    });
  });
  test("with no panel open the card keeps the gap from the left edge", () => {
    expect(shellEdge(false, 80, 0, 12).left).toBe(12);
  });
});

describe("visibleBounds", () => {
  const passes = [
    { lat: 45.06, lon: 6.4 },
    { lat: 46.5, lon: 11.2 },
  ];
  const tours = [
    { slug: "a", visible: true },
    { slug: "b", visible: false },
  ];
  const boxes = {
    a: [7, 44, 8, 45] as Bounds,
    b: [0, 0, 1, 1] as Bounds,
  };

  test("is the box around the dots and the tours on the map", () => {
    expect(visibleBounds(passes, tours, boxes, true)).toEqual([
      6.4, 44, 11.2, 46.5,
    ]);
  });

  test("leaves out what is switched off", () => {
    expect(visibleBounds(passes, tours, boxes, false)).toEqual([7, 44, 8, 45]);
    expect(visibleBounds(passes, [], {}, false)).toBeNull();
  });
});

describe("fitDone", () => {
  const frame = { lat: 46.3, lon: 9.6, zoom: 6.5 };
  test("a camera on the frame counts as fitted", () => {
    expect(fitDone({ ...frame, zoom: 6.51 }, frame)).toBe(true);
  });
  test("half a zoom step or a valley away does not", () => {
    expect(fitDone({ ...frame, zoom: 6.6 }, frame)).toBe(false);
    expect(fitDone({ ...frame, lat: 46.5 }, frame)).toBe(false);
  });
});

describe("flightFor", () => {
  const world = {
    passBounds: {
      "col-du-galibier": [6.3, 45, 6.5, 45.1] as Bounds,
      "flat-pass": [6.4, 45.06, 6.4, 45.06] as Bounds,
    },
    passes: [
      { lat: 45.06, lon: 6.4, slug: "col-du-galibier" },
      { lat: 45.06, lon: 6.4, slug: "flat-pass" },
    ],
    tourBounds: { "giro-sella": [11.7, 46.4, 11.9, 46.6] as Bounds },
    towns: [{ lat: 46.5, lon: 11.3, slug: "bozen" }],
  };

  test("a pass is framed by its ascents, with its marker as the fallback", () => {
    expect(flightFor({ kind: "pass", slug: "col-du-galibier" }, world)).toEqual(
      {
        bounds: [6.3, 45, 6.5, 45.1],
        extra: PASS_PADDING,
        fallback: { lat: 45.06, lon: 6.4, minZoom: PASS_MIN_ZOOM },
        kind: "bounds",
        maxZoom: PASS_MAX_ZOOM,
      },
    );
  });

  test("a box of no extent is no frame: the marker answers instead", () => {
    expect(flightFor({ kind: "pass", slug: "flat-pass" }, world)).toEqual({
      kind: "point",
      point: { lat: 45.06, lon: 6.4, minZoom: PASS_MIN_ZOOM },
    });
  });

  test("a town is a point, a tour is its box, and what is not drawn is nothing", () => {
    expect(flightFor({ kind: "town", slug: "bozen" }, world)).toEqual({
      kind: "point",
      point: { lat: 46.5, lon: 11.3, minZoom: TOWN_MIN_ZOOM },
    });
    expect(
      flightFor({ kind: "tour", slug: "giro-sella" }, world),
    ).toMatchObject({
      extra: TOUR_PADDING,
      fallback: null,
      kind: "bounds",
    });
    expect(flightFor({ kind: "pass", slug: "unknown" }, world)).toBeNull();
    expect(flightFor({ kind: "tour", slug: "unknown" }, world)).toBeNull();
  });
});

// ── The camera machine, as traces ────────────────────────────────────────────

const MOVING: CameraEnv = { reduceMotion: false };
const STILL: CameraEnv = { reduceMotion: true };

/** The header alone, a header and the sidebar, and a phone's detail sheet. */
const BARE: Inset = { bottom: 0, left: 0, right: 0, top: 64 };
const SIDEBAR: Inset = { ...BARE, left: 396 };
const PANELS: Inset = { ...BARE, left: 804 };
const SHEET: Inset = { ...BARE, bottom: 440 };

const BOX: Bounds = [6.3, 45, 6.5, 45.1];
const GALIBIER: FlightTarget = {
  bounds: BOX,
  extra: PASS_PADDING,
  fallback: null,
  kind: "bounds",
  maxZoom: PASS_MAX_ZOOM,
};
const VIEW = { bearing: 0, lat: 45.06, lon: 6.4, pitch: 0, zoom: 12 };

/** Replays a list of events and keeps what each one issued. */
const drive = (events: CameraEvent[], env: CameraEnv = MOVING) => {
  let state = COLD;
  const per: CameraCommand[][] = [];
  for (const event of events) {
    const [next, commands] = camera(state, event, env);
    state = next;
    per.push(commands);
  }
  return { per, state, trace: per.flat() };
};

/** The three events every trace below starts from: a map with a header bar. */
const opened = (
  kind: CameraIntent["kind"],
  bounds: Bounds | null = BOX,
  inset: Inset = SIDEBAR,
): CameraEvent[] => [
  { intent: { kind, view: VIEW }, type: "intent" },
  { inset, type: "inset" },
  { bounds, type: "ready" },
];

describe("camera · what the map opens on", () => {
  test("with nothing in the link it frames what it draws, once", () => {
    const { per, state, trace } = drive([
      ...opened("fit"),
      { byUser: false, type: "moveend" },
      { bounds: BOX, type: "ready" },
    ]);
    expect(trace).toEqual([
      { cmd: "setPadding", padding: SIDEBAR },
      { bounds: BOX, cmd: "fitBounds", duration: 0, padding: FIT_PADDING },
      { cmd: "writeHash" },
    ]);
    // The second `ready` – the lines arriving after the style – frames nothing.
    expect(per.at(-1)).toEqual([]);
    expect(state).toEqual({ fitted: true, padded: SIDEBAR, phase: "idle" });
  });

  test("with nothing to draw yet it waits for something to frame", () => {
    const { per } = drive([
      ...opened("fit", null),
      { bounds: BOX, type: "ready" },
      { bounds: BOX, type: "ready" },
    ]);
    expect(per[2]).toEqual([{ cmd: "setPadding", padding: SIDEBAR }]);
    expect(per[3]).toEqual([
      { bounds: BOX, cmd: "fitBounds", duration: 0, padding: FIT_PADDING },
    ]);
    expect(per[4]).toEqual([]);
  });

  test("a camera or a selection in the link is never framed over", () => {
    for (const kind of ["view", "selection"] as CameraIntent["kind"][]) {
      const { state, trace } = drive(opened(kind));
      expect(trace).toEqual([{ cmd: "setPadding", padding: SIDEBAR }]);
      expect(state).toEqual({ fitted: true, padded: SIDEBAR, phase: "idle" });
    }
  });

  test("an unpadded map is not padded at all", () => {
    expect(drive(opened("fit", null, NO_INSET)).trace).toEqual([]);
  });
});

describe("camera · a selection", () => {
  test("opens the panel, waits, flies with its padding and writes the hash once", () => {
    const { per, state, trace } = drive([
      ...opened("fit"),
      { byUser: false, type: "moveend" },
      { key: "pass:col-du-galibier", target: GALIBIER, type: "selection" },
      // The detail panel claims its share in the same commit as the selection.
      { inset: PANELS, type: "inset" },
      { type: "delay" },
      { byUser: false, type: "moveend" },
    ]);
    expect(trace.slice(3)).toEqual([
      { cmd: "schedule", ms: SELECT_DELAY },
      { cmd: "flyTo", duration: SELECT_MS, padding: PANELS, target: GALIBIER },
      { cmd: "writeHash" },
    ]);
    // The padding the panel asked for while the flight was scheduled rode
    // along with it, so nothing eased.
    expect(per[5]).toEqual([]);
    expect(state).toEqual({ fitted: true, padded: PANELS, phase: "idle" });
  });

  test("a padding asked for mid-air lands with the flight, not into it", () => {
    const { per, state } = drive([
      ...opened("selection", BOX, PANELS),
      { key: "pass:a", target: GALIBIER, type: "selection" },
      { type: "delay" },
      // The sheet is dragged up while the camera is crossing the Alps.
      { inset: SHEET, type: "inset" },
      { byUser: false, type: "moveend" },
      { byUser: false, type: "moveend" },
    ]);
    expect(per[5]).toEqual([]);
    expect(per[6]).toEqual([
      { cmd: "easeTo", duration: PADDING_MS, padding: SHEET },
    ]);
    expect(per[7]).toEqual([{ cmd: "writeHash" }]);
    expect(state).toEqual({ fitted: true, padded: SHEET, phase: "idle" });
  });

  test("a flight for A that lands during B's delay does not ease into B", () => {
    const { per, state } = drive([
      ...opened("fit"),
      { key: "pass:a", target: GALIBIER, type: "selection" },
      { type: "delay" },
      // B is picked before A has landed, and asks for more room than A.
      { key: "pass:b", target: GALIBIER, type: "selection" },
      { inset: SHEET, type: "inset" },
      // A arrives.
      { byUser: false, type: "moveend" },
      { type: "delay" },
      { byUser: false, type: "moveend" },
    ]);
    expect(per[5]).toEqual([{ cmd: "schedule", ms: SELECT_DELAY }]);
    // A's landing settles nothing: B owns what happens next.
    expect(per[7]).toEqual([]);
    expect(per[8]).toEqual([
      { cmd: "flyTo", duration: SELECT_MS, padding: SHEET, target: GALIBIER },
    ]);
    expect(state).toEqual({ fitted: true, padded: SHEET, phase: "idle" });
  });

  test("a second pick while one is scheduled drops the flight it had coming", () => {
    const { per } = drive([
      ...opened("fit"),
      { key: "pass:a", target: GALIBIER, type: "selection" },
      { key: "pass:b", target: GALIBIER, type: "selection" },
    ]);
    expect(per[4]).toEqual([
      { cmd: "cancel" },
      { cmd: "schedule", ms: SELECT_DELAY },
    ]);
  });

  test("closing the panel drops a flight that has not set off", () => {
    const { per, state } = drive([
      ...opened("fit"),
      { key: "pass:a", target: GALIBIER, type: "selection" },
      { key: null, target: null, type: "selection" },
      { inset: BARE, type: "inset" },
    ]);
    expect(per[4]).toEqual([{ cmd: "cancel" }]);
    expect(per[5]).toEqual([
      { cmd: "easeTo", duration: PADDING_MS, padding: BARE },
    ]);
    expect(state).toEqual({ fitted: true, padded: BARE, phase: "idle" });
  });

  test("what the map cannot frame still gets the panel its space", () => {
    const { per, state } = drive([
      ...opened("fit"),
      { key: "town:x", target: null, type: "selection" },
      { inset: SHEET, type: "inset" },
      { type: "delay" },
    ]);
    expect(per[5]).toEqual([
      { cmd: "easeTo", duration: PADDING_MS, padding: SHEET },
    ]);
    expect(state).toEqual({ fitted: true, padded: SHEET, phase: "idle" });
  });

  test("… and asks for nothing when there is nothing to give it", () => {
    const { per } = drive([
      ...opened("fit"),
      { key: "town:x", target: null, type: "selection" },
      { type: "delay" },
    ]);
    expect(per[4]).toEqual([]);
  });

  test("reduced motion keeps the order and takes no time over it", () => {
    const { trace } = drive(
      [
        ...opened("fit"),
        { key: "pass:a", target: GALIBIER, type: "selection" },
        { inset: SHEET, type: "inset" },
        { type: "delay" },
        { byUser: false, type: "moveend" },
      ],
      STILL,
    );
    expect(trace).toEqual([
      { cmd: "setPadding", padding: SIDEBAR },
      { bounds: BOX, cmd: "fitBounds", duration: 0, padding: FIT_PADDING },
      { cmd: "schedule", ms: 0 },
      { cmd: "flyTo", duration: 0, padding: SHEET, target: GALIBIER },
      { cmd: "writeHash" },
    ]);
  });
});

describe("camera · the padding on its own", () => {
  test("a change with no camera move behind it eases in, once", () => {
    const { per, state } = drive([
      ...opened("fit"),
      { inset: PANELS, type: "inset" },
      { inset: PANELS, type: "inset" },
    ]);
    expect(per[3]).toEqual([
      { cmd: "easeTo", duration: PADDING_MS, padding: PANELS },
    ]);
    expect(per[4]).toEqual([]);
    expect(state).toEqual({ fitted: true, padded: PANELS, phase: "idle" });
  });

  test("what the panels ask for before the map exists is the first padding", () => {
    const { trace } = drive([
      { intent: { kind: "fit", view: VIEW }, type: "intent" },
      { inset: BARE, type: "inset" },
      { inset: SIDEBAR, type: "inset" },
      { bounds: null, type: "ready" },
    ]);
    expect(trace).toEqual([{ cmd: "setPadding", padding: SIDEBAR }]);
  });
});

describe("camera · what the visitor does with the map", () => {
  test("a drag while idle changes nothing but the hash", () => {
    const before = drive(opened("fit")).state;
    const [after, commands] = camera(
      before,
      { byUser: true, type: "moveend" },
      MOVING,
    );
    expect(commands).toEqual([{ cmd: "writeHash" }]);
    expect(after).toBe(before);
  });

  test("a hand on the map outranks a flight that has not set off", () => {
    const { per, state } = drive([
      ...opened("fit"),
      { key: "pass:a", target: GALIBIER, type: "selection" },
      { byUser: true, type: "moveend" },
      { type: "delay" },
    ]);
    expect(per[4]).toEqual([{ cmd: "cancel" }, { cmd: "writeHash" }]);
    expect(per[5]).toEqual([]);
    expect(state.phase).toBe("idle");
  });

  test("a camera pasted into an open page jumps, with the padding", () => {
    const { per, state } = drive([
      ...opened("fit"),
      { inset: PANELS, type: "inset" },
      { type: "requestedView", view: VIEW },
    ]);
    expect(per[4]).toEqual([{ cmd: "jumpTo", padding: PANELS, view: VIEW }]);
    expect(state).toEqual({ fitted: true, padded: PANELS, phase: "idle" });
  });

  test("… and takes the camera off a flight that was about to start", () => {
    const { per } = drive([
      ...opened("fit"),
      { key: "pass:a", target: GALIBIER, type: "selection" },
      { type: "requestedView", view: VIEW },
    ]);
    expect(per[4]).toEqual([
      { cmd: "cancel" },
      { cmd: "jumpTo", padding: SIDEBAR, view: VIEW },
    ]);
  });
});
