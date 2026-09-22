"use client";

import type { FlyToOptions, Map as MLMap } from "maplibre-gl";
import { useEffect, useRef } from "react";

import type { MapView } from "@/lib/app-state";
import { camera, COLD, fitInset, toInset } from "@/lib/map-camera";
import type {
  CameraCommand,
  CameraEnv,
  CameraEvent,
  CameraState,
} from "@/lib/map-camera";

/** What the adapter needs besides the map: the timer, and who to tell. */
interface Host {
  map: MLMap;
  timer: { current: ReturnType<typeof setTimeout> | null };
  /** `SELECT_DELAY` has elapsed – dispatched back into the machine. */
  onDelay: () => void;
  /** Where the camera has come to rest; the hash adapter writes it. */
  onView: (view: MapView) => void;
}

/** The camera as the app's own state reads it. */
const viewOf = (m: MLMap): MapView => {
  const c = m.getCenter();
  return {
    bearing: m.getBearing(),
    lat: c.lat,
    lon: c.lng,
    pitch: m.getPitch(),
    zoom: m.getZoom(),
  };
};

/**
 * A flight's landing point, in MapLibre's terms.
 *
 * Not `fitBounds`, which drops the padding before it flies: the frame has to be
 * measured against where the camera lands (`fitInset`), and the padding has to
 * travel with it. `cameraForBounds` can still refuse a box, which is what the
 * fallback point is for; `null` means the map has nowhere to go.
 */
const flight = (
  m: MLMap,
  c: Extract<CameraCommand, { cmd: "flyTo" }>,
): FlyToOptions | null => {
  const base: FlyToOptions = { duration: c.duration };
  if (c.padding) base.padding = c.padding;
  const at = (p: { lat: number; lon: number; minZoom: number }) => ({
    ...base,
    center: [p.lon, p.lat] as [number, number],
    zoom: Math.max(m.getZoom(), p.minZoom),
  });
  if (c.target.kind === "view") {
    const { bearing, lat, lon, pitch, zoom } = c.target.view;
    return { ...base, bearing, center: [lon, lat], pitch, zoom };
  }
  if (c.target.kind === "point") return at(c.target.point);
  const now = toInset(m.getPadding());
  const fit = m.cameraForBounds(c.target.bounds, {
    maxZoom: c.target.maxZoom,
    padding: fitInset(now, c.padding ?? now, c.target.extra),
  });
  if (fit) return { ...base, ...fit };
  return c.target.fallback ? at(c.target.fallback) : null;
};

/**
 * The commands, carried out. Every MapLibre camera call the app makes by itself
 * is in this one switch, which is what keeps the decisions in `lib/map-camera.ts`
 * testable without a WebGL context – in a test the whole adapter is the list of
 * commands the machine returned.
 *
 * `easeTo` and `flyTo` are given a padding only when the move is about the
 * panels: MapLibre reads `'padding' in options`, so a key with `undefined`
 * behind it is not the same as no key at all.
 */
export const applyCamera = (host: Host, commands: CameraCommand[]) => {
  const { map: m, timer } = host;
  for (const c of commands) {
    switch (c.cmd) {
      case "setPadding": {
        m.setPadding(c.padding);
        break;
      }
      case "jumpTo": {
        m.jumpTo({
          bearing: c.view.bearing,
          center: [c.view.lon, c.view.lat],
          padding: c.padding,
          pitch: c.view.pitch,
          zoom: c.view.zoom,
        });
        break;
      }
      case "easeTo": {
        const options: Parameters<typeof m.easeTo>[0] = {
          duration: c.duration,
        };
        if (c.padding) options.padding = c.padding;
        if (c.bearing !== undefined) options.bearing = c.bearing;
        if (c.pitch !== undefined) options.pitch = c.pitch;
        m.easeTo(options);
        break;
      }
      case "fitBounds": {
        m.fitBounds(c.bounds, {
          animate: c.duration > 0,
          duration: c.duration,
          padding: c.padding,
        });
        break;
      }
      case "flyTo": {
        const to = flight(m, c);
        // A box the map will not turn into a camera still owes the panel its
        // space – and the machine is waiting for the `moveend` either way.
        if (to) m.flyTo(to);
        else m.easeTo({ duration: c.duration, padding: c.padding });
        break;
      }
      case "schedule": {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(host.onDelay, c.ms);
        break;
      }
      case "cancel": {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        break;
      }
      case "writeHash": {
        host.onView(viewOf(m));
        break;
      }
      default: {
        c satisfies never;
      }
    }
  }
};

/** One map's camera: the machine, its timer and the map to carry it out on. */
export interface Camera {
  send: (event: CameraEvent) => void;
  /** For the map's own tools, which answer a press rather than a prop. */
  issue: (commands: CameraCommand[]) => void;
}

const NOTHING = () => {
  // A command list with no `schedule` in it never reaches for the timer.
};

/**
 * The machine and its adapter, wired to one map.
 *
 * The state is a ref because every event – a flight landing, a timer, a sheet
 * dragged – would otherwise re-render the whole map to change a value no render
 * reads, and because the handlers MapLibre keeps from the setup call would
 * otherwise read a state one render old. The two functions hold nothing but
 * those refs and the map, so the compiler hands out the same pair for as long
 * as the map lives and an effect may name them as dependencies.
 */
export const useCamera = (
  map: { current: MLMap | null },
  onView: (view: MapView) => void,
  env: () => CameraEnv,
): Camera => {
  const state = useRef<CameraState>(COLD);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ env, onView });
  useEffect(() => {
    latest.current = { env, onView };
  }, [env, onView]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const run = (commands: CameraCommand[], onDelay: () => void) => {
    const m = map.current;
    // Only `cold` issues nothing, and `cold` is the only phase without a map.
    if (!m || commands.length === 0) return;
    applyCamera(
      { map: m, onDelay, onView: (view) => latest.current.onView(view), timer },
      commands,
    );
  };
  const send = (event: CameraEvent) => {
    const [next, commands] = camera(state.current, event, latest.current.env());
    state.current = next;
    run(commands, () => send({ type: "delay" }));
  };
  // A tool's commands are its own; only the machine's can ask for a timer.
  return { issue: (commands: CameraCommand[]) => run(commands, NOTHING), send };
};
