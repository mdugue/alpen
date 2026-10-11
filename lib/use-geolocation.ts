"use client";

import { useState } from "react";

import type { LatLon } from "@/lib/types";

/**
 * The adapter for the one platform question the map asks on request: where
 * is the visitor? Asked only when the locate button is pressed – never on
 * load, because a permission prompt nobody asked for is the fastest way to a
 * "block" that the button then cannot undo – and answered once, not watched:
 * the app is for choosing a destination, not for following a ride.
 *
 * The position stays in this hook's state. It is not stored, not written to
 * the hash and not sent anywhere: the map draws it and the camera frames it,
 * and a reload forgets it.
 */
export type Located =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "found"; at: LatLon & { accuracy: number } }
  /** The visitor or the browser said no; only the browser's settings can undo it. */
  | { status: "denied" }
  /** No fix in time, or a browser without the API. */
  | { status: "unavailable" };

/**
 * How long a fix may take, and how old a cached one may be. A city-level fix
 * is all the question needs – which range, which passes nearby – so a fresh
 * high-accuracy fix, which wakes the GPS and can take half a minute indoors,
 * is not asked for.
 */
const OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 5 * 60 * 1000,
  timeout: 15_000,
};

export const useGeolocation = (): [
  Located,
  (onFound: (at: LatLon & { accuracy: number }) => void) => void,
] => {
  const [located, setLocated] = useState<Located>({ status: "idle" });
  const locate = (onFound: (at: LatLon & { accuracy: number }) => void) => {
    if (!("geolocation" in navigator)) {
      setLocated({ status: "unavailable" });
      return;
    }
    setLocated({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const at = {
          accuracy: coords.accuracy,
          lat: coords.latitude,
          lon: coords.longitude,
        };
        setLocated({ at, status: "found" });
        onFound(at);
      },
      (error) => {
        setLocated({
          status:
            error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        });
      },
      OPTIONS,
    );
  };
  return [located, locate];
};
