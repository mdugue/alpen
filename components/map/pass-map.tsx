"use client";

import type { FeatureCollection } from "geojson";
import { Compass, MoreHorizontal, Scan } from "lucide-react";
import type { IControl, StyleSpecification } from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl,
  LngLat,
  Map as MLMap,
  Popup,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import {
  addIcons,
  appLayers,
  applyBase,
  baseStack,
  hillshadeLayer,
  hillshadePaint,
  readColors,
} from "@/components/map/app-layers";
import { useCamera } from "@/components/map/apply-camera";
import { applyScene, sceneHost } from "@/components/map/apply-scene";
import type { SceneHost } from "@/components/map/apply-scene";
import { baseLayers, OVERLAYS, VECTOR_BASE } from "@/components/map/map-style";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEFAULT_VIEW } from "@/lib/app-state";
import type { MapView, Selection, Shown } from "@/lib/app-state";
import {
  BASEMAP_ID,
  BASEMAP_SOURCE,
  BASEMAP_SOURCE_ID,
  GLYPHS,
} from "@/lib/basemap";
import { HIT_LAYERS, SOURCE } from "@/lib/layer-ids";
import type { MapAssets } from "@/lib/map-assets";
import {
  FIT_MS,
  FIT_PADDING,
  fitDone,
  flightFor,
  NO_INSET,
} from "@/lib/map-camera";
import type { CameraIntent, Inset } from "@/lib/map-camera";
import { DOUBLE_MS, isDoubleClick, pick } from "@/lib/map-pick";
import type { Tap } from "@/lib/map-pick";
import { buildScene } from "@/lib/map-scene";
import type { Scene } from "@/lib/map-scene";
import type { TownReach } from "@/lib/nearby";
import type { Scheme } from "@/lib/palette";
import { prominenceWord } from "@/lib/prominence";
import { entityKey } from "@/lib/route-key";
import type { Rows } from "@/lib/rows";
import type { LatLon } from "@/lib/types";
import type { MapEnvironment } from "@/lib/use-media-query";
import { useStored } from "@/lib/use-stored";
import { cn, MAP_CLUSTER, MAP_TOOL } from "@/lib/utils";

interface Props {
  /**
   * What the three lists show – the same rows, drawn as marks, lines and
   * names. `buildScene` (lib/map-scene.ts) turns them into what the map
   * draws; nothing is translated on the way in.
   */
  rows: Rows;
  /** The "auf der Karte" switches: the layer toggle on top of the lists. */
  shown: Shown;
  /**
   * The area each town reaches – the hull over the passes within reach,
   * precomputed in `lib/nearby.ts`. Drawn while a town is hovered, in the list
   * or on the map, so "was ist von hier aus erreichbar" is answered on the map
   * itself. A selected town is flown to instead: from inside the hull there is
   * nothing to see.
   */
  townReach: TownReach;
  /**
   * The ascent and tour lines never arrive as props: MapLibre fetches them as
   * static GeoJSON from these URLs and tiles them in its worker. Which lines
   * show and how is a layer filter and feature state, both of them scene
   * fields.
   */
  assets: MapAssets;
  selection: Selection | null;
  /**
   * What the pointer is over, from either half of the screen. The map both
   * reports it (its own pointer) and answers it (a row hovered in the list),
   * which is what finally ties the two together – see `hovered` in
   * `explorer.tsx`.
   */
  hovered?: Selection | null;
  onHover?: (sel: Selection | null) => void;
  onSelect: (sel: Selection) => void;
  /**
   * Where the camera has come to rest, once it has: the hash adapter writes it
   * (`writeHash` in `lib/map-camera.ts`). Not every frame of a flight – a link
   * to a camera still on its way is a link to nowhere in particular.
   */
  onViewChange: (v: MapView) => void;
  /**
   * What the opening camera owes the link the page was opened with, read from
   * the hash before the map is built (`cameraIntent`, lib/hash-adapter.ts).
   * The map is built on its `view` and waits for it, which is also why it is
   * the one prop with no default: `null` means the hash has not been read yet.
   */
  intent: CameraIntent | null;
  /**
   * Camera requested from outside (a hash pasted into an open page). The map
   * is otherwise the source of truth for its camera, so this is applied only
   * when the object identity changes.
   */
  requestedView?: MapView | null;
  /** Road point under the elevation-profile cursor, marked on the ascent. */
  profileCursor?: LatLon | null;
  /**
   * Fly-to request from a click on the elevation profile. A fresh object per
   * click, so the same point can be asked for twice.
   */
  profileZoom?: LatLon | null;
  /**
   * What the shell covers of the map on each edge, in pixels
   * (`shellGeometry`, lib/shell-geometry.ts): the panels on the left, the
   * header at the top, the season bar or whichever drawer is in front at the
   * bottom. Camera targets land in what is left of it.
   */
  inset?: Inset;
  /**
   * What the device does differently: the colour scheme the layers are painted
   * in, whether the pointer is a finger, whether motion is unwanted and whether
   * the shell is the phone one. All four used to be `matchMedia` calls inside
   * the map, one of them in a function documented as pure.
   */
  env: MapEnvironment;
}

const EMPTY: FeatureCollection = { features: [], type: "FeatureCollection" };
/** A click on the elevation profile: close enough to count the hairpins. */
const PROFILE_ZOOM = 13;
const PROFILE_MS = 900;

/**
 * The two tools share one segmented column in the map's top-right corner. They
 * are the only furniture on the map itself now that the period control has
 * moved into the shell's bottom bar, so the corner holds what is about the
 * *picture* – framing it, and what it is drawn on – and nothing about the
 * domain.
 */
const TOOL = "size-9";
const TERRAIN = { exaggeration: 1.25, source: "dem" } as const;

/**
 * The legend line for the level of detail (`lib/prominence.ts`): "Bei dieser
 * Zoomstufe: bekannte Pässe" while the overview is thinned by fame, nothing
 * once every road is drawn. A MapLibre control rather than a React node, so
 * it sits in a corner the way the scale bar and the attribution do – read,
 * not pressed – and keeps clear of the season bar with them.
 * It is silent while the passes are switched off: a line about which passes
 * are drawn is a lie when none are.
 */
class DetailLevelControl implements IControl {
  private el: HTMLDivElement | null = null;
  private map: MLMap | null = null;
  private shown = true;
  private readonly update = () => {
    if (!this.el || !this.map) return;
    const word = this.shown ? prominenceWord(this.map.getZoom()) : null;
    this.el.textContent = word ? `Bei dieser Zoomstufe: ${word}` : "";
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
/** Slack around the pointer, so a near miss on a label still counts. */
const HIT_SLOP = 4;

/**
 * The one entity under a point, resolved across every hit layer at once.
 *
 * A single query instead of a handler per layer: overlapping areas are the
 * normal case here, and only one of them may win a click. Which one is
 * `pick` (lib/map-pick.ts) – a decision over plain records, so the rule
 * behind every click is tested without a map.
 */
const pickAt = (m: MLMap, x: number, y: number): Selection | null => {
  const layers = HIT_LAYERS.filter((id) => m.getLayer(id));
  if (layers.length === 0) return null;
  const features = m.queryRenderedFeatures(
    [
      [x - HIT_SLOP, y - HIT_SLOP],
      [x + HIT_SLOP, y + HIT_SLOP],
    ],
    { layers },
  );
  return pick(
    features.map((f) => ({
      layer: f.layer.id,
      point:
        f.geometry.type === "Point"
          ? (f.geometry.coordinates as [number, number])
          : null,
      slug: String(f.properties.slug ?? ""),
    })),
    { x, y },
    (at) => m.project([at[0], at[1]]),
  );
};

/** The scale bar, the attribution ⓘ and the level-of-detail line, as a set. */
interface Provenance {
  attribution: AttributionControl;
  scale: ScaleControl;
  level: DetailLevelControl;
}

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
const placeProvenance = (
  m: MLMap,
  controls: Provenance,
  mobile: boolean,
  root: HTMLElement | null,
) => {
  // A right corner takes each new control on its *left*, so the ⓘ goes in
  // first and keeps the corner; the scale bar stands beside it.
  const corner = mobile ? "bottom-left" : "bottom-right";
  for (const control of [controls.attribution, controls.scale, controls.level])
    m.addControl(control, corner);
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

/** A stored base that no longer exists (a keyed raster, say) falls back to the default. */
const resolveBase = (id: string) =>
  id === BASEMAP_ID || baseLayers().some((b) => b.id === id) ? id : BASEMAP_ID;

// MapLibre resolves its worker via import.meta.url, which Turbopack does not
// serve; scripts/copy-maplibre-worker.ts places a copy under public/maplibre.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export const PassMap = ({
  rows,
  shown,
  townReach,
  assets,
  selection,
  hovered = null,
  onHover,
  onSelect,
  onViewChange,
  intent,
  profileCursor = null,
  profileZoom = null,
  requestedView = null,
  inset = NO_INSET,
  env,
}: Props) => {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [is3d, setIs3d] = useState(false);
  /**
   * Whether the map is turned away from north, and by how much.
   *
   * The compass is the one tool that is not always there: a map pointing north
   * needs no control saying so, and the corner is quieter without it. The
   * boolean is state, because it mounts and unmounts a button. The angle is a
   * ref, because the needle follows a drag frame by frame and a re-render per
   * frame to turn an icon would be the most expensive way to do that.
   */
  const [turned, setTurned] = useState(false);
  const detailLevel = useRef<DetailLevelControl | null>(null);
  useEffect(() => {
    detailLevel.current?.setShown(shown.passes);
  }, [shown.passes, ready]);
  /** The three controls in the map's quiet corner, and which layout put them there. */
  const provenance = useRef<Provenance | null>(null);
  const placedFor = useRef<boolean | null>(null);
  const bearing = useRef(0);
  const needle = useRef<SVGSVGElement | null>(null);
  /** Points the needle north; also applies the angle it mounts at. */
  const aimNeedle = (el: SVGSVGElement | null) => {
    needle.current = el;
    if (el) el.style.transform = `rotate(${-bearing.current}deg)`;
  };
  /**
   * What the map draws, as one value, and what of it has been applied.
   *
   * The scene is built from the props on every render (`buildScene`,
   * lib/map-scene.ts) and the effect below hands MapLibre the difference to
   * the last one – so a hover that changes nothing costs nothing, and nothing
   * the map shows is decided in an effect any more.
   */
  const scene = buildScene({
    env: { coarse: env.coarsePointer },
    hovered,
    profileCursor,
    rows,
    selection,
    shown,
    tourBounds: assets.tourBounds,
    townReach,
  });
  const applied = useRef<Scene | null>(null);
  const host = useRef<SceneHost | null>(null);
  /**
   * Every camera move the map makes by itself goes through this one machine
   * (`camera` in lib/map-camera.ts): the effects below turn a prop change into
   * an event, `send` hands back the commands and the adapter carries them out.
   * Nothing here branches on where the camera happens to be.
   */
  const { issue, send } = useCamera(map, onViewChange, () => ({
    reduceMotion: env.reduceMotion,
  }));
  /** One string per selected entity: what the camera effects change on. */
  const selKey = selection && entityKey(selection);
  const [base, setBase] = useStored("base");
  // The base the map currently shows. The map is built during the hydration
  // render, where a stored value is not known yet (useSyncExternalStore hands
  // out the server snapshot); the effect below catches up once it is.
  const appliedBase = useRef(BASEMAP_ID);
  /** And the scheme it was painted in, for the same reason. */
  const appliedScheme = useRef<Scheme>("light");
  const [overlays, setOverlays] = useStored("overlays");
  // Callbacks are needed in map event handlers that are only registered
  // during setup; refs keep them current without rebuilding the map.
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onHoverRef.current = onHover;
  }, [onSelect, onHover]);

  /**
   * What the pointer is over, as the map last heard it. The map reports a
   * hover and is answered by the scene like any other half of the screen, so
   * this is not a second hover state: it is what keeps the pointer from
   * dispatching the same entity on every mouse move across one dot.
   */
  const hoveredRef = useRef<Selection | null>(hovered);
  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  // --- Build the map once ------------------------------------------------
  // Once the intent is known, which is one tick after the first commit: the
  // map is built on the camera a shared link carries, and reading the hash for
  // it is the hash adapter's business, not the map's.
  useEffect(() => {
    if (!container.current || map.current || !intent) return;
    const colors = readColors(container.current);
    appliedBase.current = resolveBase(base);
    appliedScheme.current = env.scheme;
    const { ground, detail } = baseStack(appliedBase.current, env.scheme);

    const style: StyleSpecification = {
      glyphs: GLYPHS,
      layers: [
        ...ground,
        hillshadeLayer(env.scheme, overlays.includes("hillshade")),
        ...detail,
        ...OVERLAYS.map((o) => ({
          id: `ov-${o.id}`,
          layout: {
            visibility: overlays.includes(o.id)
              ? ("visible" as const)
              : ("none" as const),
          },
          paint: { "raster-opacity": o.opacity },
          source: `ov-${o.id}`,
          type: "raster" as const,
        })),
        ...appLayers(colors, env),
      ],
      sources: {
        [BASEMAP_SOURCE_ID]: BASEMAP_SOURCE,
        dem: {
          attribution: "Terrain © Mapzen/AWS",
          encoding: "terrarium",
          maxzoom: 15,
          tileSize: 256,
          tiles: [
            "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
          ],
          type: "raster-dem",
        },
        ...Object.fromEntries(
          baseLayers().map((b) => [
            b.id,
            {
              attribution: b.attribution,
              maxzoom: b.maxzoom,
              tileSize: 256,
              tiles: b.tiles,
              type: "raster",
            },
          ]),
        ),
        ...Object.fromEntries(
          OVERLAYS.map((o) => [
            `ov-${o.id}`,
            {
              attribution: o.attribution,
              maxzoom: o.maxzoom,
              tileSize: 256,
              tiles: [...o.tiles],
              type: "raster",
            },
          ]),
        ),
        // What the scene writes: empty until it has been applied once.
        [SOURCE.cursor]: { data: EMPTY, type: "geojson" },
        [SOURCE.hover]: { data: EMPTY, type: "geojson" },
        [SOURCE.passes]: { data: EMPTY, type: "geojson" },
        [SOURCE.reach]: { data: EMPTY, type: "geojson" },
        // Static files with a content hash in the name (scripts/build-map-assets.ts);
        // promoteId makes the `id` property the feature id for feature state.
        [SOURCE.routes]: {
          data: assets.routesUrl,
          promoteId: "id",
          type: "geojson",
        },
        [SOURCE.tours]: {
          data: assets.toursUrl,
          promoteId: "id",
          type: "geojson",
        },
        [SOURCE.towns]: { data: EMPTY, type: "geojson" },
      },
      version: 8,
    };

    const { view } = intent;
    const m = new MLMap({
      // Placed by hand below, in the corner opposite the tools.
      attributionControl: false,
      bearing: view.bearing,
      center: [view.lon, view.lat],
      container: container.current,
      locale: {
        "AttributionControl.ToggleAttribution": "Quellenangaben",
        "Map.Title": "Karte",
        "ScaleControl.Kilometers": "km",
        "ScaleControl.Meters": "m",
      },
      maxPitch: 75,
      pitch: view.pitch,
      style,
      zoom: view.zoom,
    });
    map.current = m;
    // Test hook for the e2e suite (never in a production build): the map
    // itself, and nothing else. What the suite needs to *judge* the map with –
    // the box a pass is framed into, say – it derives from the same data the
    // app does, rather than being handed it through the window.
    if (process.env.NEXT_PUBLIC_TEST_HOOKS === "1") {
      (window as unknown as { __alpen?: { map: MLMap } }).__alpen = { map: m };
    }
    /*
     * Provenance: the scale bar and who the map is by. Both quiet and small –
     * they are read once, not operated – while everything a visitor presses
     * lives in the top-right group. The level-of-detail line travels with
     * them: it is read too, and it must not sit under the sidebar on desktop.
     *
     * The attribution stays *on the map* behind a single ⓘ rather than moving
     * into the view menu: one clearly identifiable interaction is what the
     * OSM attribution guidelines ask for, and a line inside a menu about map
     * types is neither identifiable nor one interaction.
     */
    detailLevel.current = new DetailLevelControl();
    const controls: Provenance = {
      attribution: new AttributionControl({ compact: true }),
      level: detailLevel.current,
      scale: new ScaleControl({ unit: "metric" }),
    };
    provenance.current = controls;
    placedFor.current = env.mobile;
    placeProvenance(m, controls, env.mobile, container.current);

    // `style.load`, not `load`: the latter waits for every source, and the
    // ascent and tour lines are a megabyte of GeoJSON fetched over holiday
    // Wi-Fi. Once the style is parsed the sources exist, so the markers,
    // filters and feature state can go in at once; the lines follow when
    // their files arrive (state set before that is applied as they load).
    m.on("style.load", () => {
      addIcons(m, colors);
      if (view.pitch > 1) {
        m.setTerrain(TERRAIN);
        setIs3d(true);
      }
      setReady(true);
    });

    // One pointer resolution for the whole map rather than a handler per
    // layer: the hit areas overlap, and exactly one entity may answer a hover
    // or a click (`pickAt` above decides which).
    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    });
    host.current = sceneHost(m, popup);
    /** Last pointer position, so a moving map re-reads what is under it. */
    let at: { x: number; y: number } | null = null;

    const hover = () => {
      // While the map moves there is nothing to aim at, and a label following
      // a drag is only noise.
      const hit = at && !m.isMoving() ? pickAt(m, at.x, at.y) : null;
      m.getCanvas().style.cursor = hit ? "pointer" : "";
      const was = hoveredRef.current;
      if ((hit && was && entityKey(hit) === entityKey(was)) || (!hit && !was))
        return;
      // The map reports what its pointer is over and draws nothing itself: the
      // ring, the wider lines, the reach hull and the label all come back
      // through the scene, which is what makes a mark hovered here and a row
      // hovered in the list answer with the same picture (`hovered` in
      // explorer.tsx). Noted before it is dispatched, so the rest of the
      // pointer events in this frame do not repeat it.
      hoveredRef.current = hit;
      onHoverRef.current?.(hit);
    };

    // Hover is a mouse affordance; a finger has none, and a label under it
    // would cover what was just tapped.
    if (!env.coarsePointer) {
      m.on("mousemove", (e) => {
        at = { x: e.point.x, y: e.point.y };
        hover();
      });
      m.on("mouseout", () => {
        at = null;
        hover();
      });
    }
    /** The selection a click has resolved but not yet handed over. */
    let pending: ReturnType<typeof setTimeout> | null = null;
    /** The previous click, to tell the second half of a double click apart. */
    let clicked: Tap | null = null;
    const dropPending = () => {
      if (pending) clearTimeout(pending);
      pending = null;
    };

    m.on("click", (e) => {
      const tap: Tap = { t: Date.now(), x: e.point.x, y: e.point.y };
      const prev = clicked;
      clicked = tap;
      // A click that follows another one closely is the map's zoom gesture,
      // not a pick (`isDoubleClick`, lib/map-pick.ts): it drops what the first
      // one lined up and selects nothing itself. A third click in the same run
      // finds nothing pending and stops here too, so a run of fast clicks
      // never ends in a panel.
      if (isDoubleClick(prev, tap)) {
        dropPending();
        return;
      }
      const hit = pickAt(m, tap.x, tap.y);
      dropPending();
      if (!hit) return;
      pending = setTimeout(() => {
        pending = null;
        onSelectRef.current(hit);
      }, DOUBLE_MS);
    });
    // A mouse announces the double click itself; a tap on a phone may not, and
    // the timing above is what catches that one.
    m.on("dblclick", dropPending);

    // The needle follows the drag; `rotate` fires per frame, and the boolean
    // only changes on the first of them, so every later call bails out of the
    // render. `moveend` covers the flights that carry a bearing with them.
    const spin = () => {
      bearing.current = m.getBearing();
      needle.current?.style.setProperty(
        "transform",
        `rotate(${-bearing.current}deg)`,
      );
      setTurned(Math.abs(bearing.current) > 0.5);
    };
    m.on("rotate", spin);
    spin();

    // Keep the 3D toggle honest when the map is tilted by drag or compass.
    m.on("pitchend", () => {
      const pitched = m.getPitch() > 1;
      setIs3d(pitched);
      if (pitched && !m.getTerrain()) m.setTerrain(TERRAIN);
    });

    /*
     * One listener for everything a camera at rest settles: what is under the
     * pointer now that the picture has moved, where the needle points, and the
     * camera's own next move.
     *
     * There were three of these, registered in three places, and which of them
     * ran first decided whether a flight's leftover padding was applied before
     * or after the hash was written. Now the order is one function's three
     * lines, and only the third of them decides anything: `byUser` tells a
     * drag, a wheel and a pinch – the moves MapLibre makes on the visitor's
     * own behalf, and the only ones carrying a DOM event – from the app's.
     */
    m.on("moveend", (e) => {
      if (!env.coarsePointer) hover();
      spin();
      send({ byUser: Boolean(e.originalEvent), type: "moveend" });
    });

    // The container changes size when the sidebar collapses; MapLibre only
    // tracks window resizes on its own.
    const ro = new ResizeObserver(() => {
      m.resize();
    });
    ro.observe(container.current);

    return () => {
      ro.disconnect();
      dropPending();
      m.remove();
      map.current = null;
    };
    // Intentional: build only once. What it draws arrives as the scene below.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [intent, send]);

  // --- Which corner the provenance stands in -------------------------------
  // Placed with the map and moved when the layout changes under it; what each
  // corner means is `placeProvenance` above.
  useEffect(() => {
    const m = map.current;
    const controls = provenance.current;
    if (!m || !controls || placedFor.current === env.mobile) return;
    placedFor.current = env.mobile;
    for (const control of [
      controls.attribution,
      controls.scale,
      controls.level,
    ])
      m.removeControl(control);
    placeProvenance(m, controls, env.mobile, container.current);
  }, [env.mobile]);

  // --- Which base ----------------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const next = resolveBase(base);
    if (next === appliedBase.current) return;
    appliedBase.current = next;
    applyBase(m, next, env.scheme);
  }, [base, ready, env.scheme]);

  // --- Which overlays ------------------------------------------------------
  // What is on is applied from the stored value rather than only at the switch
  // that changed it, for the reason the base has an effect too: the map is
  // built before the stored value is known, so the first style carries the
  // defaults and this is what catches up.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    for (const id of ["hillshade", ...OVERLAYS.map((o) => o.id)])
      m.setLayoutProperty(
        id === "hillshade" ? "hillshade" : `ov-${id}`,
        "visibility",
        overlays.includes(id) ? "visible" : "none",
      );
  }, [overlays, ready]);

  // --- Follow the OS colour scheme -----------------------------------------
  // The tokens flip with it: the base is swapped for its twin, the icons are
  // repainted and every paint property of the app's layers is set again from
  // the definition the style was built from. Camera, sources, filters and
  // feature state are not touched, so nothing is lost or reloaded.
  //
  // The map is built in the scheme that was current then, so this is a change
  // and not a first application: the ref is what tells the two apart, and it
  // is why re-running on a base change costs nothing.
  useEffect(() => {
    const m = map.current;
    const el = container.current;
    if (!m || !el || !ready || appliedScheme.current === env.scheme) return;
    const s = env.scheme;
    appliedScheme.current = s;
    const colors = readColors(el);
    addIcons(m, colors);
    if (resolveBase(base) === BASEMAP_ID) applyBase(m, BASEMAP_ID, s);
    const repaint = (id: string, paint: object) => {
      for (const [k, v] of Object.entries(paint) as [never, never][])
        m.setPaintProperty(id, k, v);
    };
    repaint("hillshade", hillshadePaint(s));
    for (const layer of appLayers(colors, env))
      repaint(layer.id, layer.paint ?? {});
  }, [ready, base, env]);

  // --- The camera ----------------------------------------------------------
  // Five prop changes, five events, and the machine decides what each one
  // costs (`camera`, lib/map-camera.ts). The order they stand in is the order
  // they run in within one commit, and it is load-bearing twice: the opening
  // camera is known before the map reports for duty, and a selection is
  // announced before the padding its panel claims – so that padding belongs to
  // the flight instead of easing in ahead of it.
  useEffect(() => {
    if (intent) send({ intent, type: "intent" });
  }, [intent, send]);

  // What the map draws is what it opens on, so this is dispatched again until
  // something has been framed: the lines and dots may arrive after the style.
  useEffect(() => {
    if (ready) send({ bounds: scene.bounds, type: "ready" });
  }, [ready, scene.bounds, send]);

  useEffect(() => {
    if (!ready) return;
    send({
      key: selKey,
      target: selection
        ? flightFor(selection, {
            passBounds: assets.passBounds,
            passes: rows.pass.map((r) => r.pass),
            tourBounds: assets.tourBounds,
            towns: rows.town.map((r) => r.town),
          })
        : null,
      type: "selection",
    });
    // Intentional: the selection is the trigger; the boxes are only looked up
    // in it, and a filtered list must not re-fly the camera.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [selKey, ready]);

  const { bottom, left, right, top } = inset;
  useEffect(() => {
    send({ inset: { bottom, left, right, top }, type: "inset" });
  }, [bottom, left, right, top, send]);

  useEffect(() => {
    if (ready && requestedView)
      send({ type: "requestedView", view: requestedView });
  }, [requestedView, ready, send]);

  // --- What the map shows --------------------------------------------------
  /**
   * The scene, handed to MapLibre as the difference to the one before it
   * (`applyScene`, components/map/apply-scene.ts).
   *
   * This was four effects and two hover states: one deciding what the ascents
   * show, one the tours, two writing the point sources, and beside them a
   * `hoverKey` owned by the map's pointer and a `painted` ref owned by the
   * `hovered` prop. Nothing reconciled the two, which is why a town hovered in
   * the list drew no reach hull and a pass filtered out under the pointer kept
   * its ascents highlighted. One value, applied in one place, cannot disagree
   * with itself.
   *
   * Feature state set before the static line files have arrived is applied to
   * the tiles as they load, so nothing here waits for a source.
   */
  useEffect(() => {
    if (!ready || !host.current) return;
    applyScene(host.current, applied.current, scene);
    applied.current = scene;
  }, [scene, ready]);

  // Click on the profile: close enough to count the hairpins.
  useEffect(() => {
    if (!ready || !profileZoom) return;
    issue([
      {
        cmd: "flyTo",
        duration: env.reduceMotion ? 0 : PROFILE_MS,
        target: {
          kind: "point",
          point: { ...profileZoom, minZoom: PROFILE_ZOOM },
        },
      },
    ]);
  }, [profileZoom, ready, issue, env.reduceMotion]);

  const toggle3d = (pressed: boolean) => {
    const m = map.current;
    if (!m) return;
    setIs3d(pressed);
    m.setTerrain(pressed ? TERRAIN : null);
    // Coming back down straightens the map out as well: a tilted view is the
    // only reason to be turned away from north in the first place.
    issue([
      pressed
        ? { cmd: "easeTo", duration: 700, pitch: 60 }
        : { bearing: 0, cmd: "easeTo", duration: 600, pitch: 0 },
    ]);
  };

  const toggleOverlay = (id: string) =>
    setOverlays(
      overlays.includes(id)
        ? overlays.filter((o) => o !== id)
        : [...overlays, id],
    );

  /**
   * Fit the view to everything currently drawn. Pressed again while already
   * fitted (or when nothing is drawn) it returns to the whole-Alps overview.
   *
   * `cameraForBounds` is the one question only the map can answer – where a
   * box would put the camera at this size and padding; whether that is where
   * the camera already stands is `fitDone` (lib/map-camera.ts).
   */
  const fitToVisible = () => {
    const m = map.current;
    if (!m) return;
    const { bounds } = scene;
    const target = bounds
      ? m.cameraForBounds(bounds, { padding: FIT_PADDING })
      : undefined;
    const at = m.getCenter();
    const zoom = target?.zoom;
    const to =
      target && zoom !== undefined
        ? LngLat.convert(target.center as [number, number])
        : null;
    const already =
      to !== null &&
      zoom !== undefined &&
      fitDone(
        { lat: at.lat, lon: at.lng, zoom: m.getZoom() },
        { lat: to.lat, lon: to.lng, zoom },
      );
    issue([
      bounds && !already
        ? { bounds, cmd: "fitBounds", duration: FIT_MS, padding: FIT_PADDING }
        : {
            cmd: "flyTo",
            duration: FIT_MS,
            target: { kind: "view", view: DEFAULT_VIEW },
          },
    ]);
  };

  return (
    <div className="bg-muted relative size-full overflow-hidden">
      {/* Plain "absolute inset-0" loses against the unlayered maplibre-gl.css (`.maplibregl-map { position: relative }`). */}
      <div ref={container} className="size-full" />

      {/*
       * The map's own corner: which way is up, how it is framed, and what the
       * picture is drawn on. One group on one glass surface, opposite the
       * sidebar so the two never meet, and below the header bar, whose height
       * it is given as the inset's top edge. Everything a visitor presses is
       * here; the bottom-left corner carries only the things that are read.
       */}
      <div
        style={{ top: inset.top + 12 }}
        className="absolute right-3 z-10 transition-[top] duration-200 motion-reduce:transition-none"
      >
        <ButtonGroup orientation="vertical" className={MAP_CLUSTER}>
          {turned && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-lg"
                    variant="outline"
                    className={cn(TOOL, MAP_TOOL)}
                    onClick={() => {
                      issue([{ bearing: 0, cmd: "easeTo", duration: 400 }]);
                    }}
                    aria-label="Nach Norden ausrichten"
                  />
                }
              >
                <Compass ref={aimNeedle} />
              </TooltipTrigger>
              <TooltipContent side="left">
                Nach Norden ausrichten
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-lg"
                  variant="outline"
                  className={cn(TOOL, MAP_TOOL)}
                  onClick={fitToVisible}
                  aria-label="Ansicht einpassen"
                />
              }
            >
              <Scan />
            </TooltipTrigger>
            <TooltipContent side="left">
              Ansicht einpassen – erneut für die ganzen Alpen
            </TooltipContent>
          </Tooltip>

          {/*
           * Everything that changes how the map looks rather than where it
           * looks, behind one "…": the base, the overlays and the tilt. They
           * are answered once per visit and then left alone, so they do not
           * earn a button each on a phone screen.
           */}
          <Popover>
            <Tooltip>
              <TooltipTrigger
                render={
                  <PopoverTrigger
                    render={
                      <Button
                        size="icon-lg"
                        variant="outline"
                        className={cn(TOOL, MAP_TOOL)}
                        aria-label="Ansicht: Karte, Ebenen und 3D"
                      />
                    }
                  />
                }
              >
                <MoreHorizontal />
              </TooltipTrigger>
              <TooltipContent side="left">Ansicht</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" side="left" className="w-60 gap-3">
              <FieldSet className="gap-2">
                <FieldLegend variant="label">Grundkarte</FieldLegend>
                <RadioGroup
                  value={resolveBase(base)}
                  onValueChange={(v) => setBase(String(v))}
                  className="gap-1.5"
                >
                  {[VECTOR_BASE, ...baseLayers()].map((b) => (
                    <Field key={b.id} orientation="horizontal">
                      <RadioGroupItem value={b.id} id={`base-${b.id}`} />
                      <FieldLabel
                        htmlFor={`base-${b.id}`}
                        className="font-normal"
                      >
                        {b.name}
                      </FieldLabel>
                    </Field>
                  ))}
                </RadioGroup>
              </FieldSet>
              <FieldSet className="gap-2">
                <FieldLegend variant="label">Overlays</FieldLegend>
                {[
                  { id: "hillshade", name: "Relief-Schummerung" },
                  ...OVERLAYS,
                ].map((o) => (
                  <Field key={o.id} orientation="horizontal">
                    <Switch
                      size="sm"
                      id={`ov-${o.id}`}
                      checked={overlays.includes(o.id)}
                      onCheckedChange={() => toggleOverlay(o.id)}
                    />
                    <FieldLabel htmlFor={`ov-${o.id}`} className="font-normal">
                      {o.name}
                    </FieldLabel>
                  </Field>
                ))}
              </FieldSet>
              <FieldSet className="gap-2">
                <FieldLegend variant="label">Gelände</FieldLegend>
                <Field orientation="horizontal">
                  <Switch
                    size="sm"
                    id="terrain-3d"
                    checked={is3d}
                    onCheckedChange={toggle3d}
                  />
                  <FieldLabel htmlFor="terrain-3d" className="font-normal">
                    3D-Ansicht
                  </FieldLabel>
                </Field>
              </FieldSet>
            </PopoverContent>
          </Popover>
        </ButtonGroup>
      </div>
    </div>
  );
};
