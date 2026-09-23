"use client";

import type { GeoJSONSource, Map as MLMap, Popup } from "maplibre-gl";

import { LAYERS, layersOf, SOURCE } from "@/lib/layer-ids";
import type { PopupContent, Ring, Scene } from "@/lib/map-scene";
import { tagIconSvg } from "@/lib/tag-icons";

/**
 * The scene, carried out.
 *
 * Every `setFilter`, `setFeatureState` and `setData` the app makes is in this
 * one module, which is what keeps `buildScene` testable without a WebGL
 * context – in a test the whole adapter is a host that records what it was
 * asked to do. The sibling of `applyCamera`, and the same shape: a host, a
 * value, and no decisions of its own.
 *
 * It diffs rather than reapplies. A scene is built per keystroke and per
 * pointer move, and a `setData` on a source of two hundred points re-tiles it
 * in the worker: a hover that changes nothing has to cost nothing.
 */

/** The map as the scene needs it – four calls, so a test can record them. */
export interface SceneHost {
  setFilter: (layer: string, filter: unknown) => void;
  setFeatureState: (
    target: { id: string; source: string },
    state: object,
  ) => void;
  setData: (source: string, data: unknown) => void;
  /** The hover label: what it says and where it points, or nothing at all. */
  label: (content: PopupContent | null) => void;
}

const escapeHtml = (s: string) =>
  s.replaceAll(
    /[&<>"']/gu,
    (c) =>
      ({ '"': "&quot;", "&": "&amp;", "'": "&#39;", "<": "&lt;", ">": "&gt;" })[
        c
      ]!,
  );

/**
 * The hover label's body: the name, the one line under it and the editorial
 * labels with the same glyphs the sidebar and the panel use – `lib/tag-icons.ts`
 * exists because this is an HTML string and not React, and this is the only
 * place that reads it.
 */
export const popupHtml = (content: PopupContent) => {
  const title = `<b>${escapeHtml(content.name)}</b>`;
  const subtitle = content.subtitle
    ? `<br>${escapeHtml(content.subtitle)}`
    : "";
  if (content.tags.length === 0) return `${title}${subtitle}`;
  const chips = content.tags
    .map(
      ([tag, label]) =>
        `<span class="flex items-center gap-1">${tagIconSvg(tag)}${escapeHtml(label)}</span>`,
    )
    .join("");
  return `${title}${subtitle}<div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">${chips}</div>`;
};

/** The host that drives a real map, and the one place MapLibre is spoken to. */
export const sceneHost = (map: MLMap, popup: Popup): SceneHost => ({
  label: (content) => {
    if (!content) {
      popup.remove();
      return;
    }
    popup.setHTML(popupHtml(content));
    popup.setLngLat(content.anchor);
    // `addTo` on an open popup re-appends its element, so it goes in once.
    if (!popup.isOpen()) popup.addTo(map);
  },
  setData: (source, data) => {
    void map.getSource<GeoJSONSource>(source)?.setData(data as never);
  },
  setFeatureState: (target, state) => {
    map.setFeatureState(target, state);
  },
  setFilter: (layer, filter) => {
    map.setFilter(layer, filter as never);
  },
});

/** Deep equality over the arrays and primitives a scene is made of. */
const same = (a: unknown, b: unknown): boolean =>
  a === b ||
  (Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((x, i) => same(x, b[i])));

const sameProps = (a: object, b: object): boolean => {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (k) =>
      (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k],
  );
};

/** Point and polygon collections alike: `same` walks nested coordinates. */
const samePoints = (
  a: {
    features: { geometry: { coordinates: unknown[] }; properties: object }[];
  },
  b: {
    features: { geometry: { coordinates: unknown[] }; properties: object }[];
  },
): boolean =>
  a.features.length === b.features.length &&
  a.features.every((f, i) => {
    const g = b.features[i]!;
    return (
      same(f.geometry.coordinates, g.geometry.coordinates) &&
      sameProps(f.properties, g.properties)
    );
  });

const samePopup = (a: PopupContent | null, b: PopupContent | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.name === b.name &&
    a.subtitle === b.subtitle &&
    same(a.anchor, b.anchor) &&
    same(a.tags, b.tags));

const hullData = (hull: Ring | null) => ({
  features: hull
    ? [
        {
          geometry: { coordinates: [hull], type: "Polygon" },
          properties: {},
          type: "Feature",
        },
      ]
    : [],
  type: "FeatureCollection",
});

/**
 * The feature state of one source.
 *
 * Only what changed is written: a hover crosses a list of two hundred rows,
 * and four hundred `setFeatureState` calls per row is enough repaint work to
 * starve a flight in progress. An id that has left the scene needs no write –
 * its line is filtered out, so nothing of it is drawn, and when the filter
 * lets it through again it is missing from the applied scene and written in
 * full. That is the bug the two hover states used to leave behind: a pass
 * filtered out under the pointer kept `hovered: 1` on its ascents.
 */
const applyState = <S extends object>(
  host: SceneHost,
  source: string,
  prev: Record<string, S> | undefined,
  next: Record<string, S>,
) => {
  for (const [id, state] of Object.entries(next)) {
    const was = prev?.[id];
    if (was && sameProps(was, state)) continue;
    host.setFeatureState({ id, source }, state);
  }
};

/** `prev` is `null` on the first scene: nothing has been applied yet. */
export const applyScene = (
  host: SceneHost,
  prev: Scene | null,
  next: Scene,
): void => {
  if (!prev || !same(prev.routes.filter, next.routes.filter))
    for (const id of layersOf(LAYERS.route))
      host.setFilter(id, next.routes.filter);
  applyState(host, LAYERS.route.source, prev?.routes.state, next.routes.state);

  if (!prev || !same(prev.tours.filter, next.tours.filter))
    for (const id of layersOf(LAYERS.tour))
      host.setFilter(id, next.tours.filter);
  applyState(host, LAYERS.tour.source, prev?.tours.state, next.tours.state);

  if (!prev || !samePoints(prev.passes, next.passes))
    host.setData(SOURCE.passes, next.passes);
  if (!prev || !samePoints(prev.towns, next.towns))
    host.setData(SOURCE.towns, next.towns);
  // The rings are rebuilt per scene, so the comparison walks the coordinates:
  // 36 circles of 49 points is what a hover over the list would otherwise
  // re-tile in the worker.
  if (!prev || !samePoints(prev.destinations, next.destinations))
    host.setData(SOURCE.destinations, next.destinations);
  if (!prev || !samePoints(prev.hover.mark, next.hover.mark))
    host.setData(SOURCE.hover, next.hover.mark);
  if (!prev || !samePoints(prev.cursor, next.cursor))
    host.setData(SOURCE.cursor, next.cursor);
  // The rings come straight out of `townReach`, so the same hull is the same
  // array; a town that is no longer hovered clears the layer.
  if (!prev || !same(prev.hover.hull, next.hover.hull))
    host.setData(SOURCE.reach, hullData(next.hover.hull));
  if (!prev || !samePopup(prev.hover.popup, next.hover.popup))
    host.label(next.hover.popup);
};
