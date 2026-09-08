"use client";

import { Box, Focus, Layers } from "lucide-react";
import type {
  GeoJSONSource,
  MapLayerMouseEvent,
  StyleSpecification,
} from "maplibre-gl";
import {
  LngLat,
  LngLatBounds,
  Map as MLMap,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";

import { baseLayers, OVERLAYS } from "@/components/map/map-style";
import { Button } from "@/components/ui/button";
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
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEFAULT_VIEW, readHash, useStored } from "@/lib/app-state";
import type { MapView, Selection } from "@/lib/app-state";
import type {
  LatLon,
  Pass,
  RouteGeometry,
  Status,
  Tour,
  Town,
} from "@/lib/types";
import { cn, MAP_CONTROL, PRESSED } from "@/lib/utils";

export interface MapPass extends Pass {
  status: Status;
  favorite: boolean;
}

interface Props {
  /** The passes the list shows: drawn as markers, their ascents highlighted. */
  passes: MapPass[];
  /** Every pass, for the ascent geometry that is uploaded once (see below). */
  allPasses: Pass[];
  tours: (Tour & {
    status: Status;
    visible: boolean;
    geometry: RouteGeometry;
  })[];
  towns: (Town & { favorite: boolean })[];
  routes: Record<string, RouteGeometry>;
  showTowns: boolean;
  selection: Selection | null;
  onSelect: (sel: Selection) => void;
  onViewChange: (v: MapView) => void;
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
  /** Pixels on the left covered by floating panels; camera targets stay right of them. */
  insetLeft?: number;
  /** Pixels at the bottom covered by the mobile sheet; camera targets stay above it. */
  insetBottom?: number;
  /** Rendered over the map in the top-left corner. */
  children?: React.ReactNode;
}

const EMPTY = { features: [], type: "FeatureCollection" } as const;
const TERRAIN = { exaggeration: 1.25, source: "dem" } as const;

// MapLibre resolves its worker via import.meta.url, which Turbopack does not
// serve; scripts/copy-maplibre-worker.ts places a copy under public/maplibre.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

/**
 * Normalises any CSS colour (oklch, lab, color-mix …) to an rgb/rgba string.
 * Browsers hand back computed custom properties in `lab()` notation, which
 * MapLibre cannot parse; painting one pixel and reading it back yields sRGB.
 */
const toRgb = (color: string, fallback: string): string => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallback;
  const sentinel = "#010203";
  ctx.fillStyle = sentinel;
  ctx.fillStyle = color;
  // An unparseable value leaves the previous fillStyle untouched.
  if (ctx.fillStyle === sentinel) return fallback;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return a === 255
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${((a ?? 0) / 255).toFixed(3)})`;
};

/** Read colour values from the theme tokens – MapLibre cannot use CSS variables. */
const readColors = (el: HTMLElement) => {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) => {
    const raw = s.getPropertyValue(name).trim();
    return raw ? toRgb(raw, fallback) : fallback;
  };
  return {
    accent: v("--accent", "#e8a33d"),
    closed: v("--status-closed", "#c43d3d"),
    ink: v("--foreground", "#1b2430"),
    open: v("--status-open", "#2e8b57"),
    paper: v("--card", "#ffffff"),
    risky: v("--status-risky", "#d9932a"),
    town: v("--town", "#1f4e79"),
  };
};

/** Paints one icon on a fresh canvas and returns its pixels. */
const draw = (
  paint: (ctx: CanvasRenderingContext2D, s: number) => void,
  size = 48,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  paint(ctx, size);
  return ctx.getImageData(0, 0, size, size);
};

/** Star and diamond as canvas icons so that no font glyphs are needed. */
const addIcons = (map: MLMap, c: ReturnType<typeof readColors>) => {
  const star = (fill: string, stroke: string) =>
    draw((ctx, s) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = (i % 2 ? 0.46 : 1) * s * 0.42;
        ctx.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = s * 0.07;
      ctx.lineJoin = "round";
      ctx.strokeStyle = stroke;
      ctx.stroke();
    });

  const add = (id: string, data: ImageData) => {
    if (!map.hasImage(id)) map.addImage(id, data, { pixelRatio: 2 });
  };
  for (const k of ["open", "risky", "closed"] as const) {
    add(`star-${k}-0`, star(c[k], c.paper));
    add(`star-${k}-1`, star(c[k], c.ink));
  }
  add("star-town-0", star(c.accent, c.paper));
  add("star-town-1", star(c.accent, c.ink));
  add(
    "town",
    draw((ctx, s) => {
      ctx.translate(s / 2, s / 2);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = c.town;
      ctx.fillRect(-s * 0.26, -s * 0.26, s * 0.52, s * 0.52);
      ctx.lineWidth = s * 0.07;
      ctx.strokeStyle = c.paper;
      ctx.strokeRect(-s * 0.26, -s * 0.26, s * 0.52, s * 0.52);
    }),
  );
};

const escapeHtml = (s: string) =>
  s.replaceAll(
    /[&<>"']/gu,
    (c) =>
      ({ '"': "&quot;", "&": "&amp;", "'": "&#39;", "<": "&lt;", ">": "&gt;" })[
        c
      ]!,
  );

const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && !Number.isNaN(v)),
  ) as Partial<T>;

export const PassMap = ({
  passes,
  allPasses,
  tours,
  towns,
  routes,
  showTowns,
  selection,
  onSelect,
  onViewChange,
  profileCursor = null,
  profileZoom = null,
  requestedView = null,
  insetLeft = 0,
  insetBottom = 0,
  children,
}: Props) => {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [is3d, setIs3d] = useState(false);
  const [base, setBase] = useStored("alpenpaesse:base", "osm");
  const [overlays, setOverlays] = useStored<string[]>("alpenpaesse:overlays", [
    "hillshade",
  ]);
  // Callbacks are needed in map event handlers that are only registered
  // during setup; refs keep them current without rebuilding the map.
  const onSelectRef = useRef(onSelect);
  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onViewChangeRef.current = onViewChange;
  }, [onSelect, onViewChange]);

  // --- Build the map once ------------------------------------------------
  useEffect(() => {
    if (!container.current || map.current) return;
    const colors = readColors(container.current);
    const bases = baseLayers();
    const statusColor = [
      "match",
      ["get", "status"],
      "open",
      colors.open,
      "risky",
      colors.risky,
      "closed",
      colors.closed,
      "#888888",
    ] as never;
    // The ascent lines carry status and selection as feature state, so a
    // filter change never re-uploads their geometry (66 000 points).
    const routeSelected = ["==", ["feature-state", "selected"], 1];
    const routeColor = [
      "match",
      ["coalesce", ["feature-state", "status"], "none"],
      "open",
      colors.open,
      "risky",
      colors.risky,
      "closed",
      colors.closed,
      "#888888",
    ] as never;

    const style: StyleSpecification = {
      glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
      layers: [
        {
          id: "base",
          source: bases.some((b) => b.id === base) ? base : "osm",
          type: "raster",
        },
        {
          id: "hillshade",
          layout: {
            visibility: overlays.includes("hillshade") ? "visible" : "none",
          },
          paint: { "hillshade-exaggeration": 0.3 },
          source: "dem",
          type: "hillshade",
        },
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
        {
          id: "tours-casing",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": colors.paper,
            "line-opacity": 0.55,
            "line-width": 6,
          },
          source: "tours",
          type: "line",
        },
        {
          id: "tours",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-opacity": 0.85,
            "line-width": ["case", ["==", ["get", "selected"], 1], 5, 3],
          },
          source: "tours",
          type: "line",
        },
        {
          id: "routes",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": routeColor,
            "line-opacity": ["case", routeSelected, 1, 0.85],
            "line-width": ["case", routeSelected, 6, 3.5],
          },
          source: "routes",
          type: "line",
        },
        {
          id: "tours-label",
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": 600,
            "text-field": ["get", "name"],
            "text-font": ["Open Sans Semibold"],
            "text-size": 11,
          },
          paint: {
            "text-color": ["get", "color"],
            "text-halo-color": colors.paper,
            "text-halo-width": 1.5,
          },
          source: "tours",
          type: "symbol",
        },
        {
          id: "towns",
          layout: {
            "icon-allow-overlap": true,
            "icon-image": [
              "case",
              ["==", ["get", "favorite"], 1],
              "star-town-0",
              "town",
            ],
            "icon-size": ["case", ["==", ["get", "favorite"], 1], 0.62, 0.5],
          },
          source: "towns",
          type: "symbol",
        },
        {
          id: "towns-label",
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Open Sans Italic"],
            "text-justify": "auto",
            "text-radial-offset": 0.8,
            "text-size": 11,
            "text-variable-anchor": ["left", "right", "top", "bottom"],
          },
          minzoom: 8,
          paint: {
            "text-color": colors.town,
            "text-halo-color": colors.paper,
            "text-halo-width": 1.5,
          },
          source: "towns",
          type: "symbol",
        },
        {
          filter: ["!=", ["get", "favorite"], 1],
          id: "passes",
          paint: {
            // "closed" is additionally encoded as a hollow circle so that the
            // three states do not rely on hue alone.
            "circle-color": [
              "case",
              ["==", ["get", "status"], "closed"],
              colors.paper,
              statusColor,
            ],
            "circle-opacity": [
              "case",
              [">=", ["get", "fame"], 4],
              0.95,
              ["==", ["get", "fame"], 3],
              0.8,
              0.62,
            ],
            "circle-pitch-alignment": "map",
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              6,
              ["+", 2, ["*", 1.1, ["get", "fame"]]],
              12,
              ["+", 4, ["*", 1.8, ["get", "fame"]]],
            ],
            "circle-stroke-color": [
              "case",
              ["==", ["get", "selected"], 1],
              colors.ink,
              ["==", ["get", "status"], "closed"],
              colors.closed,
              colors.paper,
            ],
            "circle-stroke-width": [
              "case",
              ["==", ["get", "selected"], 1],
              3,
              ["==", ["get", "status"], "closed"],
              2.5,
              1.5,
            ],
          },
          source: "passes",
          type: "circle",
        },
        {
          filter: ["==", ["get", "favorite"], 1],
          id: "pass-stars",
          layout: {
            "icon-allow-overlap": true,
            "icon-image": [
              "concat",
              "star-",
              ["get", "status"],
              "-",
              ["to-string", ["get", "selected"]],
            ],
            "icon-size": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 12, 0.9],
          },
          source: "passes",
          type: "symbol",
        },
        // Labels staggered by prominence; MapLibre resolves collisions
        ...(
          [
            [5, 0],
            [4, 7],
            [3, 8],
            [2, 9.5],
            [1, 10.5],
          ] as const
        ).map(([fame, minzoom]) => ({
          filter:
            fame === 5
              ? ([
                  "any",
                  ["==", ["get", "fame"], 5],
                  ["==", ["get", "selected"], 1],
                  ["==", ["get", "favorite"], 1],
                ] as never)
              : ([
                  "all",
                  ["==", ["get", "fame"], fame],
                  ["!=", ["get", "selected"], 1],
                  ["!=", ["get", "favorite"], 1],
                ] as never),
          id: `pass-label-${fame}`,
          layout: {
            "symbol-sort-key": ["-", 6, ["get", "fame"]] as never,
            "text-field": ["get", "name"] as never,
            "text-font": ["Open Sans Semibold"],
            "text-justify": "auto" as never,
            "text-radial-offset": 1,
            "text-size": fame >= 5 ? 13 : fame <= 2 ? 11 : 12.5,
            "text-variable-anchor": ["left", "right", "top", "bottom"] as never,
          },
          minzoom,
          paint: {
            "text-color": colors.ink,
            "text-halo-color": colors.paper,
            "text-halo-width": 1.6,
            "text-opacity": fame <= 2 ? 0.85 : 1,
          },
          source: "passes",
          type: "symbol" as const,
        })),
        // Topmost: the profile cursor must stay visible over its own ascent.
        {
          id: "profile-cursor",
          paint: {
            "circle-color": colors.paper,
            "circle-pitch-alignment": "map",
            "circle-radius": 6,
            "circle-stroke-color": colors.ink,
            "circle-stroke-width": 2.5,
          },
          source: "cursor",
          type: "circle",
        },
      ] as StyleSpecification["layers"],
      sources: {
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
          bases.map((b) => [
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
        cursor: { data: EMPTY, type: "geojson" },
        passes: { data: EMPTY, type: "geojson" },
        routes: { data: EMPTY, promoteId: "id", type: "geojson" },
        tours: { data: EMPTY, type: "geojson" },
        towns: { data: EMPTY, type: "geojson" },
      } as StyleSpecification["sources"],
      version: 8,
    };

    // The hash is read here rather than taken from props: this effect runs
    // before the parent's hash initialisation, and the map is built only once.
    const view = { ...DEFAULT_VIEW, ...defined(readHash().view) };
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const m = new MLMap({
      attributionControl: { compact: true },
      bearing: view.bearing,
      center: [view.lon, view.lat],
      container: container.current,
      locale: {
        "AttributionControl.ToggleAttribution": "Quellenangaben",
        "Map.Title": "Karte",
        "NavigationControl.ResetBearing": "Nach Norden ausrichten",
        "NavigationControl.ZoomIn": "Vergrößern",
        "NavigationControl.ZoomOut": "Verkleinern",
        "ScaleControl.Kilometers": "km",
        "ScaleControl.Meters": "m",
      },
      maxPitch: 75,
      pitch: view.pitch,
      style,
      zoom: view.zoom,
    });
    map.current = m;
    // Test hook for the e2e suite (never in a production build).
    if (process.env.NEXT_PUBLIC_TEST_HOOKS === "1") {
      (window as unknown as { __alpen?: { map: MLMap } }).__alpen = { map: m };
    }
    m.addControl(
      new NavigationControl({ showZoom: !coarse, visualizePitch: true }),
      "bottom-right",
    );
    m.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    m.on("load", () => {
      addIcons(m, colors);
      if (view.pitch > 1) {
        m.setTerrain(TERRAIN);
        setIs3d(true);
      }
      setReady(true);
    });

    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
    });
    for (const layer of ["passes", "pass-stars", "routes", "tours", "towns"]) {
      m.on("mouseenter", layer, (e: MapLayerMouseEvent) => {
        m.getCanvas().style.cursor = "pointer";
        const p = e.features?.[0]?.properties as
          | Record<string, string>
          | undefined;
        if (!p) return;
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<b>${escapeHtml(p.name ?? "")}</b><br>${escapeHtml(p.subtitle ?? "")}`,
          )
          .addTo(m);
      });
      m.on("mousemove", layer, (e: MapLayerMouseEvent) =>
        popup.setLngLat(e.lngLat),
      );
      m.on("mouseleave", layer, () => {
        m.getCanvas().style.cursor = "";
        popup.remove();
      });
      m.on("click", layer, (e: MapLayerMouseEvent) => {
        const p = e.features?.[0]?.properties as
          | { kind: string; slug: string }
          | undefined;
        if (!p) return;
        onSelectRef.current({
          kind: p.kind === "route" ? "pass" : (p.kind as Selection["kind"]),
          slug: p.slug,
        });
      });
    }

    // Keep the 3D toggle honest when the map is tilted by drag or compass.
    m.on("pitchend", () => {
      const pitched = m.getPitch() > 1;
      setIs3d(pitched);
      if (pitched && !m.getTerrain()) m.setTerrain(TERRAIN);
    });

    m.on("moveend", () => {
      const c = m.getCenter();
      onViewChangeRef.current({
        bearing: m.getBearing(),
        lat: c.lat,
        lon: c.lng,
        pitch: m.getPitch(),
        zoom: m.getZoom(),
      });
    });

    // The container changes size when the sidebar collapses; MapLibre only
    // tracks window resizes on its own.
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(container.current);

    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
    // Intentional: build only once. Data arrives via the effects below.
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);

  // --- Camera requested via the URL hash ----------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !requestedView) return;
    m.jumpTo({
      bearing: requestedView.bearing,
      center: [requestedView.lon, requestedView.lat],
      pitch: requestedView.pitch,
      zoom: requestedView.zoom,
    });
  }, [requestedView, ready]);

  // --- Reserve space for the mobile sheet ---------------------------------
  useEffect(() => {
    map.current?.setPadding({
      bottom: insetBottom,
      left: insetLeft,
      right: 0,
      top: 0,
    });
  }, [insetLeft, insetBottom, ready]);

  // --- Ascent geometry: uploaded once ------------------------------------
  // 88 ascents, 66 000 points: re-tiling that on every filter change is what
  // made the filters feel slow. Which ascents show, and in which colour, is
  // decided below through a layer filter and feature state instead.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("routes") as GeoJSONSource | undefined)?.setData({
      features: allPasses.flatMap((p) =>
        p.ascents.flatMap((a, i) => {
          const geom = routes[`${p.slug}:${i}`];
          if (!geom) return [];
          return [
            {
              geometry: {
                coordinates: geom.map(([lat, lon]) => [lon, lat]),
                type: "LineString" as const,
              },
              properties: {
                id: `${p.slug}:${i}`,
                kind: "route",
                name: p.name,
                slug: p.slug,
                subtitle: `Auffahrt ab ${a.label}`,
              },
              type: "Feature" as const,
            },
          ];
        }),
      ),
      type: "FeatureCollection",
    });
  }, [allPasses, routes, ready]);

  // --- Which ascents show, and how -----------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const selPass = selection?.kind === "pass" ? selection.slug : null;
    m.setFilter("routes", [
      "in",
      ["get", "slug"],
      ["literal", passes.map((p) => p.slug)],
    ]);
    for (const p of passes)
      for (const [i] of p.ascents.entries())
        m.setFeatureState(
          { id: `${p.slug}:${i}`, source: "routes" },
          { selected: p.slug === selPass ? 1 : 0, status: p.status },
        );
  }, [passes, selection, ready]);

  // --- Write data into the sources ---------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    const selPass = selection?.kind === "pass" ? selection.slug : null;
    (m.getSource("passes") as GeoJSONSource | undefined)?.setData({
      features: passes.map((p) => ({
        geometry: { coordinates: [p.lon, p.lat], type: "Point" },
        properties: {
          fame: p.fame,
          favorite: p.favorite ? 1 : 0,
          kind: "pass",
          name: p.name,
          selected: p.slug === selPass ? 1 : 0,
          slug: p.slug,
          status: p.status,
          subtitle: `${p.elevation.toLocaleString("de-DE")} m`,
        },
        type: "Feature",
      })),
      type: "FeatureCollection",
    });

    (m.getSource("tours") as GeoJSONSource | undefined)?.setData({
      features: tours
        .filter((t) => t.visible && t.geometry?.length)
        .map((t) => ({
          geometry: {
            coordinates: t.geometry.map(([lat, lon]) => [lon, lat]),
            type: "LineString",
          },
          properties: {
            color: t.color,
            kind: "tour",
            name: t.name,
            selected:
              selection?.kind === "tour" && selection.slug === t.slug ? 1 : 0,
            slug: t.slug,
            subtitle: `ca. ${t.km} km · ${t.elevationGain.toLocaleString("de-DE")} hm`,
          },
          type: "Feature",
        })),
      type: "FeatureCollection",
    });

    (m.getSource("towns") as GeoJSONSource | undefined)?.setData({
      features: showTowns
        ? towns.map((t) => ({
            geometry: { coordinates: [t.lon, t.lat], type: "Point" },
            properties: {
              favorite: t.favorite ? 1 : 0,
              kind: "town",
              name: t.name,
              slug: t.slug,
              subtitle: "Rad-Ort",
            },
            type: "Feature",
          }))
        : [],
      type: "FeatureCollection",
    });
  }, [passes, tours, towns, showTowns, selection, ready]);

  // --- Elevation-profile cursor -------------------------------------------
  // One point, so setData is cheap enough to run on every pointer move.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("cursor") as GeoJSONSource | undefined)?.setData({
      features: profileCursor
        ? [
            {
              geometry: {
                coordinates: [profileCursor.lon, profileCursor.lat],
                type: "Point",
              },
              properties: {},
              type: "Feature",
            },
          ]
        : [],
      type: "FeatureCollection",
    });
  }, [profileCursor, ready]);

  // Click on the profile: close enough to count the hairpins.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !profileZoom) return;
    m.flyTo({
      center: [profileZoom.lon, profileZoom.lat],
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 900,
      zoom: Math.max(m.getZoom(), 13),
    });
  }, [profileZoom, ready]);

  // --- Fly to selection --------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !selection) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reduce ? 0 : 900;
    if (selection.kind === "pass") {
      const p = passes.find((x) => x.slug === selection.slug);
      if (p)
        m.flyTo({
          center: [p.lon, p.lat],
          duration,
          zoom: Math.max(m.getZoom(), 11),
        });
    } else if (selection.kind === "town") {
      const t = towns.find((x) => x.slug === selection.slug);
      if (t)
        m.flyTo({
          center: [t.lon, t.lat],
          duration,
          zoom: Math.max(m.getZoom(), 10.5),
        });
    } else {
      const t = tours.find((x) => x.slug === selection.slug);
      const line = t?.geometry?.length
        ? t.geometry
        : t?.waypoints.map((w) => [w.lat, w.lon] as [number, number]);
      if (line?.length) {
        const b = new LngLatBounds();
        for (const [lat, lon] of line) b.extend([lon, lat]);
        m.fitBounds(b, { duration, padding: 60 });
      }
    }
    // oxlint-disable-next-line react/exhaustive-deps
  }, [selection?.kind, selection?.slug, ready]);

  const toggle3d = (pressed: boolean) => {
    const m = map.current;
    if (!m) return;
    setIs3d(pressed);
    if (pressed) {
      m.setTerrain(TERRAIN);
      m.easeTo({ duration: 700, pitch: 60 });
    } else {
      m.setTerrain(null);
      m.easeTo({ bearing: 0, duration: 600, pitch: 0 });
    }
  };

  const switchBase = (id: string) => {
    setBase(id);
    const m = map.current;
    if (!m) return;
    m.removeLayer("base");
    m.addLayer({ id: "base", source: id, type: "raster" }, "hillshade");
  };

  const toggleOverlay = (id: string) => {
    const on = !overlays.includes(id);
    setOverlays(on ? [...overlays, id] : overlays.filter((o) => o !== id));
    map.current?.setLayoutProperty(
      id === "hillshade" ? "hillshade" : `ov-${id}`,
      "visibility",
      on ? "visible" : "none",
    );
  };

  /**
   * Fit the view to everything currently drawn. Pressed again while already
   * fitted (or when nothing is drawn) it returns to the whole-Alps overview.
   */
  const fitToVisible = () => {
    const m = map.current;
    if (!m) return;
    const b = new LngLatBounds();
    for (const p of passes) b.extend([p.lon, p.lat]);
    for (const t of tours) {
      if (!t.visible) continue;
      for (const [lat, lon] of t.geometry) b.extend([lon, lat]);
    }
    const target = b.isEmpty()
      ? undefined
      : m.cameraForBounds(b, { padding: 48 });
    const alreadyFitted =
      target?.zoom !== undefined &&
      Math.abs(m.getZoom() - target.zoom) < 0.05 &&
      m
        .getCenter()
        .distanceTo(LngLat.convert(target.center as [number, number])) < 2000;
    if (!target || alreadyFitted) {
      m.flyTo({
        bearing: 0,
        center: [DEFAULT_VIEW.lon, DEFAULT_VIEW.lat],
        duration: 800,
        pitch: 0,
        zoom: DEFAULT_VIEW.zoom,
      });
    } else {
      m.fitBounds(b, { duration: 800, padding: 48 });
    }
  };

  return (
    <div className="bg-muted relative size-full overflow-hidden">
      {/* Plain "absolute inset-0" loses against the unlayered maplibre-gl.css (`.maplibregl-map { position: relative }`). */}
      <div ref={container} className="size-full" />

      <div
        style={{ left: insetLeft + 12 }}
        className="absolute top-3 z-10 flex max-w-[calc(100%-4rem)] flex-wrap items-center gap-2 transition-[left] duration-200 motion-reduce:transition-none"
      >
        {children}
      </div>

      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button
                      size="icon-lg"
                      variant="outline"
                      className={MAP_CONTROL}
                      aria-label="Kartenebenen"
                    />
                  }
                />
              }
            >
              <Layers />
            </TooltipTrigger>
            <TooltipContent side="left">Kartenebenen</TooltipContent>
          </Tooltip>
          <PopoverContent align="end" className="w-60 gap-3">
            <FieldSet className="gap-2">
              <FieldLegend variant="label">Grundkarte</FieldLegend>
              <RadioGroup
                value={base}
                onValueChange={(v) => switchBase(String(v))}
                className="gap-1.5"
              >
                {baseLayers().map((b) => (
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
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                variant="outline"
                size="lg"
                pressed={is3d}
                onPressedChange={toggle3d}
                aria-label="3D-Gelände"
                className={cn("size-8 px-0", MAP_CONTROL, PRESSED)}
              />
            }
          >
            <Box />
          </TooltipTrigger>
          <TooltipContent side="left">3D-Gelände</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-lg"
                variant="outline"
                className={MAP_CONTROL}
                onClick={fitToVisible}
                aria-label="Ansicht einpassen"
              />
            }
          >
            <Focus />
          </TooltipTrigger>
          <TooltipContent side="left">
            Ansicht einpassen – erneut für die ganzen Alpen
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
