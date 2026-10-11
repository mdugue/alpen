"use client";

import { useState } from "react";

import type { Fix } from "@/lib/types";

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
export interface Located {
  /**
   * `denied`: the visitor or the browser said no, and only the browser's
   * settings can undo it. `unavailable`: no fix in time, or a browser without
   * the API.
   */
  status: "idle" | "locating" | "found" | "denied" | "unavailable";
  /**
   * The last fix. It is kept while a new one is asked for, and when that one
   * times out – the visitor has not moved because the second answer was
   * slow – but not once the permission is withdrawn.
   */
  at: Fix | null;
}

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
  (onFound: (at: Fix) => void) => void,
] => {
  const [located, setLocated] = useState<Located>({ at: null, status: "idle" });
  const locate = (onFound: (at: Fix) => void) => {
    if (!("geolocation" in navigator)) {
      setLocated({ at: null, status: "unavailable" });
      return;
    }
    setLocated((was) => ({ ...was, status: "locating" }));
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
        setLocated((was) =>
          error.code === error.PERMISSION_DENIED
            ? { at: null, status: "denied" }
            : { ...was, status: "unavailable" },
        );
      },
      OPTIONS,
    );
  };
  return [located, locate];
};
