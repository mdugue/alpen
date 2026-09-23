"use client";

import type { IControl, Map as MLMap } from "maplibre-gl";
import { AttributionControl, ScaleControl } from "maplibre-gl";

import {
  addIcons,
  appLayers,
  applyBase,
  hillshadePaint,
  readColors,
} from "@/components/map/app-layers";
import { baseLayers, OVERLAYS } from "@/components/map/map-style";
import { BASEMAP_ID } from "@/lib/basemap";
import { fill } from "@/lib/i18n";
import type { Messages } from "@/lib/i18n";
import { prominenceWord } from "@/lib/prominence";
import type { MapEnvironment } from "@/lib/use-media-query";

/**
 * The environment the map is *in*, carried out.
 *
 * The sibling of `applyScene` and `applyCamera`, and the same shape: a host, a
 * value, and no decisions of its own. Where those two carry out what the app
 * draws and where it looks, this one carries out everything around that – the
 * base under it, the overlays over it, the scheme it is painted in, the terrain
 * it stands on and the two controls that read differently on a phone.
 *
 * It was five effects in `pass-map.tsx`, each with its own "has this been
 * applied yet" ref, and between them nothing said which ran first. Now the
 * environment is one plain value built on every render and the difference to
 * the one the map is in is this function's business, in a fixed order that is
 * written down below.
 */

/** Tilt and terrain are one thing here: the DEM the 3D switch stands on. */
const TERRAIN = { exaggeration: 1.25, source: "dem" } as const;

/**
 * The legend line for the level of detail (`lib/prominence.ts`): "Bei dieser
 * Zoomstufe: bekannte Pässe" while the overview is thinned by fame, nothing
 * once every road is drawn. A MapLibre control rather than a React node, so
 * it sits in a corner the way the scale bar and the attribution do – read,
 * not pressed – and keeps clear of the season bar with them.
 * It is silent while the passes are switched off: a line about which passes
 * are drawn is a lie when none are.
 *
 * It is built with the page's words, like the map itself: switching the
 * language is a full load, so they never change under it.
 */
class DetailLevelControl implements IControl {
  private el: HTMLDivElement | null = null;
  private map: MLMap | null = null;
  private shown = true;
  private readonly w: Messages;

  constructor(w: Messages) {
    this.w = w;
  }

  private readonly update = () => {
    if (!this.el || !this.map) return;
    const word = this.shown ? prominenceWord(this.map.getZoom(), this.w) : null;
    this.el.textContent = word ? fill(this.w.map.levelLine, { word }) : "";
    this.el.hidden = !word;
  };

  onAdd(m: MLMap) {
    this.map = m;
    this.el = document.createElement("div");
    this.el.className =
      "maplibregl-ctrl bg-card/70 border-border/60 text-muted-foreground text-2xs rounded-xs border px-1 leading-4 backdrop-blur-sm";
    m.on("zoom", this.update);
    this.update();
    return this.el;
  }

  onRemove(m: MLMap) {
    m.off("zoom", this.update);
    this.el?.remove();
    this.el = null;
    this.map = null;
  }

  /** Whether the passes are drawn at all – with them off the line is hidden. */
  setShown(shown: boolean) {
    this.shown = shown;
    this.update();
  }
}

/** The scale bar, the attribution ⓘ and the level-of-detail line, as a set. */
export interface Provenance {
  attribution: AttributionControl;
  scale: ScaleControl;
  level: DetailLevelControl;
}

/** The three of them, in the order a right corner has to take them. */
const inCorner = (c: Provenance) => [c.attribution, c.scale, c.level];

/** Built once with the map, so the corner can be changed without rebuilding them. */
export const provenanceControls = (w: Messages): Provenance => ({
  attribution: new AttributionControl({ compact: true }),
  level: new DetailLevelControl(w),
  scale: new ScaleControl({ unit: "metric" }),
});

/**
 * Puts the three quiet controls in the corner the layout leaves them.
 *
 * On a phone they stack in the bottom-left corner above the season bar; on
 * desktop, where the season card stands beside the panels on the left, they sit
 * in a row in the bottom-right corner, the one corner nothing else claims.
 * MapLibre fixes a control's corner when it is added, so a change of layout
 * re-adds them – which is also what keeps the compact attribution unfolding
 * towards the map rather than off its edge.
 */
export const placeProvenance = (
  m: MLMap,
  controls: Provenance,
  mobile: boolean,
  root: HTMLElement | null,
) => {
  // A right corner takes each new control on its *left*, so the ⓘ goes in
  // first and keeps the corner; the scale bar stands beside it.
  const corner = mobile ? "bottom-left" : "bottom-right";
  for (const control of inCorner(controls)) m.addControl(control, corner);
  /*
   * MapLibre opens a compact attribution the first time it has something to
   * say, and folds it away only once it has been clicked. Nothing else on this
   * map is open before it is asked for, so it starts folded.
   *
   * Marking the container compact *here* is what does that, rather than
   * removing the open class afterwards: `_updateCompact` adds
   * `maplibregl-compact-show` only while the container is not compact yet, and
   * it runs again on every resize and whenever the attributions change – so a
   * class removed now is back the moment the first source reports in. Set the
   * flag it tests and it never opens by itself; the ⓘ still toggles. Which is
   * also why the controls go in while the style is still parsing: an
   * attribution that has something to say before the flag is set says it.
   */
  root
    ?.querySelector(".maplibregl-ctrl-attrib")
    ?.classList.add("maplibregl-compact");
};

/**
 * Everything around what the map draws, as one value.
 *
 * `device` is the environment the platform hands down (`MapEnvironment`,
 * lib/use-media-query.ts) – reused rather than spread out here, so the layer
 * definitions and this value read the same four answers. The four fields
 * beside it are what the visitor has chosen: the view menu's base and
 * overlays, its 3D switch, and whether the pass layer is on at all.
 */
export interface MapEnv {
  device: MapEnvironment;
  /** A resolved base id (`resolveBase`), so the applier never has to fall back. */
  base: string;
  /** The overlay ids that are on, `"hillshade"` among them. */
  overlays: readonly string[];
  /** The 3D switch. Its only consequence is the terrain, which is why it is here. */
  terrain: boolean;
  /** Whether pass dots are drawn – the level-of-detail line is silent without them. */
  passes: boolean;
  /** The page's words: the basemap's labels are read in their language. */
  w: Messages;
}

/** A stored base that no longer exists (a keyed raster, say) falls back to the default. */
const resolveBase = (id: string, w: Messages) =>
  id === BASEMAP_ID || baseLayers(w).some((b) => b.id === id) ? id : BASEMAP_ID;

/**
 * The environment as one value, the way `buildScene` builds the scene: a
 * function and not an object literal at the call site, because the base a
 * stored value names may no longer exist and the applier below must never have
 * to fall back on its own.
 */
export const buildEnv = (parts: MapEnv): MapEnv => ({
  ...parts,
  base: resolveBase(parts.base, parts.w),
});

/** The map as the environment needs it: the handle, the element and the controls. */
export interface EnvHost {
  map: MLMap;
  /** The map's container – where the theme tokens are read from. */
  root: HTMLElement;
  controls: Provenance;
}

/**
 * The difference between the environment the map is in and the one it should
 * be in. `prev` is not nullable: a built style is always in *some*
 * environment, and the map seeds it with the one it was built in.
 *
 * Ordering. The steps stand in the order the five effects they replace ran in,
 * and two of them care which:
 *
 *  - **the base is swapped before the scheme is repainted.** Both write the
 *    base stack – a scheme change re-adds the generated vector base in its
 *    dark or light twin – so the last writer decides, and only the scheme step
 *    knows which twin is wanted. The other way round a swap to the vector base
 *    in the same commit would leave it painted in the scheme that just went.
 *  - **the terrain is set last.** `setTerrain` makes MapLibre re-render the
 *    whole style against the DEM; after the layers are in their final state
 *    that costs one such pass instead of two.
 *
 * The other three – the level-of-detail line, the corner the provenance stands
 * in and the overlay visibilities – touch neither the base stack nor the DEM,
 * so their place is free; they keep the one they had.
 */
export const applyEnvironment = (
  host: EnvHost,
  env: MapEnv,
  prev: MapEnv,
): void => {
  const { controls, map: m, root } = host;

  // The line about which passes are drawn, silenced while none are.
  if (prev.passes !== env.passes) controls.level.setShown(env.passes);

  // Which corner the three quiet controls stand in. MapLibre fixes a
  // control's corner when it is added, so a change of layout re-adds them.
  if (prev.device.mobile !== env.device.mobile) {
    for (const control of inCorner(controls)) m.removeControl(control);
    placeProvenance(m, controls, env.device.mobile, root);
  }

  // The base under everything. The map is built before the stored value is
  // known (`useSyncExternalStore` hands out the server snapshot during
  // hydration), so this is also what catches up with it.
  if (prev.base !== env.base)
    applyBase(m, env.base, env.device.scheme, env.w.lang);

  // The overlays, the hillshade among them – same reason, same catching up.
  for (const id of ["hillshade", ...OVERLAYS.map((o) => o.id)]) {
    const on = env.overlays.includes(id);
    if (on === prev.overlays.includes(id)) continue;
    m.setLayoutProperty(
      id === "hillshade" ? "hillshade" : `ov-${id}`,
      "visibility",
      on ? "visible" : "none",
    );
  }

  /*
   * The OS colour scheme. The tokens flip with it: the base is swapped for its
   * twin, the icons are repainted and every paint property of the app's layers
   * is set again from the definition the style was built from. Camera,
   * sources, filters and feature state are not touched, so nothing is lost or
   * reloaded – and a pointer or layout change costs nothing here, because only
   * the scheme is compared.
   */
  if (prev.device.scheme !== env.device.scheme) {
    const s = env.device.scheme;
    const colors = readColors(root);
    addIcons(m, colors);
    if (env.base === BASEMAP_ID) applyBase(m, BASEMAP_ID, s, env.w.lang);
    const repaint = (id: string, paint: object) => {
      for (const [k, v] of Object.entries(paint) as [never, never][])
        m.setPaintProperty(id, k, v);
    };
    repaint("hillshade", hillshadePaint(s));
    for (const layer of appLayers(colors, env.device))
      repaint(layer.id, layer.paint ?? {});
  }

  // The 3D switch, which is the terrain and nothing else.
  if (prev.terrain !== env.terrain) m.setTerrain(env.terrain ? TERRAIN : null);
};
