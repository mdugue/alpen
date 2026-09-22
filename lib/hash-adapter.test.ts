import { expect, test } from "bun:test";

import { DEFAULT_VIEW, EMPTY_HASH } from "@/lib/app-state";
import { cameraIntent } from "@/lib/hash-adapter";

test("a link with a camera is opened on that camera", () => {
  const intent = cameraIntent({
    ...EMPTY_HASH,
    view: { lat: 45.06, lon: 6.4, zoom: 12 },
  });
  expect(intent.kind).toBe("view");
  expect(intent.view).toEqual({
    bearing: DEFAULT_VIEW.bearing,
    lat: 45.06,
    lon: 6.4,
    pitch: DEFAULT_VIEW.pitch,
    zoom: 12,
  });
});

test("a link that only names a pass is left to that pass's flight", () => {
  expect(
    cameraIntent({
      ...EMPTY_HASH,
      selection: { kind: "pass", slug: "col-du-galibier" },
    }),
  ).toEqual({ kind: "selection", view: DEFAULT_VIEW });
});

test("a bare link opens on what the map draws", () => {
  expect(cameraIntent(EMPTY_HASH)).toEqual({ kind: "fit", view: DEFAULT_VIEW });
});

test("a tilt alone is not a camera, but it is still what the map is built with", () => {
  const intent = cameraIntent({ ...EMPTY_HASH, view: { pitch: 60 } });
  expect(intent.kind).toBe("fit");
  expect(intent.view.pitch).toBe(60);
});
