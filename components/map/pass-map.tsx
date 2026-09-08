"use client";

import { useEffect, useRef, useState } from "react";
import {
  GeoJSONSource,
  LngLat,
  LngLatBounds,
  Map as MLMap,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layers, Maximize2, Mountain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { baseLayers, OVERLAYS } from "@/components/map/map-style";
import { DEFAULT_VIEW, readHash, useStored, type MapView, type Selection } from "@/lib/app-state";
import { cn, MAP_CONTROL, PRESSED } from "@/lib/utils";
import type { Pass, RouteGeometry, Status, Tour, Town } from "@/lib/types";

export interface MapPass extends Pass {
  status: Status;
  favorite: boolean;
}

interface Props {
  passes: MapPass[];
  tours: (Tour & { status: Status; visible: boolean; geometry: RouteGeometry })[];
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
  /** Pixels at the bottom covered by the mobile sheet; camera targets stay above it. */
  insetBottom?: number;
  /** Rendered over the map in the top-left corner. */
  children?: React.ReactNode;
}

const EMPTY = { type: "FeatureCollection", features: [] } as const;
const TERRAIN = { source: "dem", exaggeration: 1.25 } as const;

// MapLibre resolves its worker via import.meta.url, which Turbopack does not
// serve; scripts/copy-maplibre-worker.ts places a copy under public/maplibre.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

/**
 * Normalises any CSS colour (oklch, lab, color-mix …) to an rgb/rgba string.
 * Browsers hand back computed custom properties in `lab()` notation, which
 * MapLibre cannot parse; painting one pixel and reading it back yields sRGB.
 */
function toRgb(color: string, fallback: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallback;
  const sentinel = "#010203";
  ctx.fillStyle = sentinel;
  ctx.fillStyle = color;
  // An unparseable value leaves the previous fillStyle untouched.
  if (ctx.fillStyle === sentinel) return fallback;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${((a ?? 0) / 255).toFixed(3)})`;
}

/** Read colour values from the theme tokens – MapLibre cannot use CSS variables. */
function readColors(el: HTMLElement) {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) => {
    const raw = s.getPropertyValue(name).trim();
    return raw ? toRgb(raw, fallback) : fallback;
  };
  return {
    open: v("--status-open", "#2e8b57"),
    risky: v("--status-risky", "#d9932a"),
    closed: v("--status-closed", "#c43d3d"),
    town: v("--town", "#1f4e79"),
    accent: v("--accent", "#e8a33d"),
    ink: v("--foreground", "#1b2430"),
    paper: v("--card", "#ffffff"),
  };
}

/** Star and diamond as canvas icons so that no font glyphs are needed. */
function addIcons(map: MLMap, c: ReturnType<typeof readColors>) {
  const draw = (paint: (ctx: CanvasRenderingContext2D, s: number) => void, size = 48) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    paint(ctx, size);
    return ctx.getImageData(0, 0, size, size);
  };
  const star = (fill: string, stroke: string) =>
    draw((ctx, s) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
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
  (["open", "risky", "closed"] as const).forEach((k) => {
    add(`star-${k}-0`, star(c[k], c.paper));
    add(`star-${k}-1`, star(c[k], c.ink));
  });
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
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && !Number.isNaN(v))) as Partial<T>;

export function PassMap({
  passes,
  tours,
  towns,
  routes,
  showTowns,
  selection,
  onSelect,
  onViewChange,
  requestedView = null,
  insetBottom = 0,
  children,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [is3d, setIs3d] = useState(false);
  const [base, setBase] = useStored("alpenpaesse:base", "osm");
  const [overlays, setOverlays] = useStored<string[]>("alpenpaesse:overlays", ["hillshade"]);
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

    const style: StyleSpecification = {
      version: 8,
      glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
      sources: {
        dem: {
          type: "raster-dem",
          tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 15,
          attribution: "Terrain © Mapzen/AWS",
        },
        ...Object.fromEntries(
          bases.map((b) => [
            b.id,
            { type: "raster", tiles: b.tiles, tileSize: 256, maxzoom: b.maxzoom, attribution: b.attribution },
          ]),
        ),
        ...Object.fromEntries(
          OVERLAYS.map((o) => [
            `ov-${o.id}`,
            { type: "raster", tiles: [...o.tiles], tileSize: 256, maxzoom: o.maxzoom, attribution: o.attribution },
          ]),
        ),
        routes: { type: "geojson", data: EMPTY },
        tours: { type: "geojson", data: EMPTY },
        passes: { type: "geojson", data: EMPTY },
        towns: { type: "geojson", data: EMPTY },
      } as StyleSpecification["sources"],
      layers: [
        { id: "base", type: "raster", source: bases.some((b) => b.id === base) ? base : "osm" },
        {
          id: "hillshade",
          type: "hillshade",
          source: "dem",
          layout: { visibility: overlays.includes("hillshade") ? "visible" : "none" },
          paint: { "hillshade-exaggeration": 0.3 },
        },
        ...OVERLAYS.map((o) => ({
          id: `ov-${o.id}`,
          type: "raster" as const,
          source: `ov-${o.id}`,
          layout: { visibility: overlays.includes(o.id) ? ("visible" as const) : ("none" as const) },
          paint: { "raster-opacity": o.opacity },
        })),
        {
          id: "tours-casing",
          type: "line",
          source: "tours",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": colors.paper, "line-width": 6, "line-opacity": 0.55 },
        },
        {
          id: "tours",
          type: "line",
          source: "tours",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["case", ["==", ["get", "selected"], 1], 5, 3],
            "line-opacity": 0.85,
          },
        },
        {
          id: "routes",
          type: "line",
          source: "routes",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": statusColor,
            "line-width": ["case", ["==", ["get", "selected"], 1], 6, 3.5],
            "line-opacity": ["case", ["==", ["get", "selected"], 1], 1, 0.85],
          },
        },
        {
          id: "tours-label",
          type: "symbol",
          source: "tours",
          layout: {
            "symbol-placement": "line",
            "text-field": ["get", "name"],
            "text-font": ["Open Sans Semibold"],
            "text-size": 11,
            "symbol-spacing": 600,
          },
          paint: { "text-color": ["get", "color"], "text-halo-color": colors.paper, "text-halo-width": 1.5 },
        },
        {
          id: "towns",
          type: "symbol",
          source: "towns",
          layout: {
            "icon-image": ["case", ["==", ["get", "favorite"], 1], "star-town-0", "town"],
            "icon-size": ["case", ["==", ["get", "favorite"], 1], 0.62, 0.5],
            "icon-allow-overlap": true,
          },
        },
        {
          id: "towns-label",
          type: "symbol",
          source: "towns",
          minzoom: 8,
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Open Sans Italic"],
            "text-size": 11,
            "text-variable-anchor": ["left", "right", "top", "bottom"],
            "text-radial-offset": 0.8,
            "text-justify": "auto",
          },
          paint: { "text-color": colors.town, "text-halo-color": colors.paper, "text-halo-width": 1.5 },
        },
        {
          id: "passes",
          type: "circle",
          source: "passes",
          filter: ["!=", ["get", "favorite"], 1],
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              6,
              ["+", 2, ["*", 1.1, ["get", "fame"]]],
              12,
              ["+", 4, ["*", 1.8, ["get", "fame"]]],
            ],
            // "closed" is additionally encoded as a hollow circle so that the
            // three states do not rely on hue alone.
            "circle-color": ["case", ["==", ["get", "status"], "closed"], colors.paper, statusColor],
            "circle-opacity": [
              "case",
              [">=", ["get", "fame"], 4],
              0.95,
              ["==", ["get", "fame"], 3],
              0.8,
              0.62,
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
            "circle-pitch-alignment": "map",
          },
        },
        {
          id: "pass-stars",
          type: "symbol",
          source: "passes",
          filter: ["==", ["get", "favorite"], 1],
          layout: {
            "icon-image": ["concat", "star-", ["get", "status"], "-", ["to-string", ["get", "selected"]]],
            "icon-size": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 12, 0.9],
            "icon-allow-overlap": true,
          },
        },
        // Labels staggered by prominence; MapLibre resolves collisions
        ...([
          [5, 0],
          [4, 7],
          [3, 8],
          [2, 9.5],
          [1, 10.5],
        ] as const).map(([fame, minzoom]) => ({
          id: `pass-label-${fame}`,
          type: "symbol" as const,
          source: "passes",
          minzoom,
          filter:
            fame === 5
              ? (["any", ["==", ["get", "fame"], 5], ["==", ["get", "selected"], 1], ["==", ["get", "favorite"], 1]] as never)
              : ([
                  "all",
                  ["==", ["get", "fame"], fame],
                  ["!=", ["get", "selected"], 1],
                  ["!=", ["get", "favorite"], 1],
                ] as never),
          layout: {
            "text-field": ["get", "name"] as never,
            "text-font": ["Open Sans Semibold"],
            "text-size": fame >= 5 ? 13 : fame <= 2 ? 11 : 12.5,
            "text-variable-anchor": ["left", "right", "top", "bottom"] as never,
            "text-radial-offset": 1,
            "text-justify": "auto" as never,
            "symbol-sort-key": ["-", 6, ["get", "fame"]] as never,
          },
          paint: {
            "text-color": colors.ink,
            "text-halo-color": colors.paper,
            "text-halo-width": 1.6,
            "text-opacity": fame <= 2 ? 0.85 : 1,
          },
        })),
      ] as StyleSpecification["layers"],
    };

    // The hash is read here rather than taken from props: this effect runs
    // before the parent's hash initialisation, and the map is built only once.
    const view = { ...DEFAULT_VIEW, ...defined(readHash().view) };
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const m = new MLMap({
      container: container.current,
      style,
      center: [view.lon, view.lat],
      zoom: view.zoom,
      pitch: view.pitch,
      bearing: view.bearing,
      maxPitch: 75,
      attributionControl: { compact: true },
      locale: {
        "Map.Title": "Karte",
        "NavigationControl.ZoomIn": "Vergrößern",
        "NavigationControl.ZoomOut": "Verkleinern",
        "NavigationControl.ResetBearing": "Nach Norden ausrichten",
        "AttributionControl.ToggleAttribution": "Quellenangaben",
        "ScaleControl.Meters": "m",
        "ScaleControl.Kilometers": "km",
      },
    });
    map.current = m;
    m.addControl(new NavigationControl({ visualizePitch: true, showZoom: !coarse }), "bottom-right");
    m.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    m.on("load", () => {
      addIcons(m, colors);
      if (view.pitch > 1) {
        m.setTerrain(TERRAIN);
        setIs3d(true);
      }
      setReady(true);
    });

    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 10 });
    for (const layer of ["passes", "pass-stars", "routes", "tours", "towns"]) {
      m.on("mouseenter", layer, (e: MapLayerMouseEvent) => {
        m.getCanvas().style.cursor = "pointer";
        const p = e.features?.[0]?.properties as Record<string, string> | undefined;
        if (!p) return;
        popup
          .setLngLat(e.lngLat)
          .setHTML(`<b>${escapeHtml(p.name ?? "")}</b><br>${escapeHtml(p.subtitle ?? "")}`)
          .addTo(m);
      });
      m.on("mousemove", layer, (e: MapLayerMouseEvent) => popup.setLngLat(e.lngLat));
      m.on("mouseleave", layer, () => {
        m.getCanvas().style.cursor = "";
        popup.remove();
      });
      m.on("click", layer, (e: MapLayerMouseEvent) => {
        const p = e.features?.[0]?.properties as { kind: string; slug: string } | undefined;
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
        lat: c.lat,
        lon: c.lng,
        zoom: m.getZoom(),
        pitch: m.getPitch(),
        bearing: m.getBearing(),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Camera requested via the URL hash ----------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !requestedView) return;
    m.jumpTo({
      center: [requestedView.lon, requestedView.lat],
      zoom: requestedView.zoom,
      pitch: requestedView.pitch,
      bearing: requestedView.bearing,
    });
  }, [requestedView, ready]);

  // --- Reserve space for the mobile sheet ---------------------------------
  useEffect(() => {
    map.current?.setPadding({ top: 0, left: 0, right: 0, bottom: insetBottom });
  }, [insetBottom, ready]);

  // --- Write data into the sources ---------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    const selPass = selection?.kind === "pass" ? selection.slug : null;
    (m.getSource("passes") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: passes.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: {
          kind: "pass",
          slug: p.slug,
          name: p.name,
          subtitle: `${p.elevation.toLocaleString("de-DE")} m`,
          fame: p.fame,
          status: p.status,
          favorite: p.favorite ? 1 : 0,
          selected: p.slug === selPass ? 1 : 0,
        },
      })),
    });

    (m.getSource("routes") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: passes.flatMap((p) =>
        p.ascents.flatMap((a, i) => {
          const geom = routes[`${p.slug}:${i}`];
          if (!geom) return [];
          return [
            {
              type: "Feature" as const,
              geometry: { type: "LineString" as const, coordinates: geom.map(([lat, lon]) => [lon, lat]) },
              properties: {
                kind: "route",
                slug: p.slug,
                name: p.name,
                subtitle: `Auffahrt ab ${a.label}`,
                status: p.status,
                selected: p.slug === selPass ? 1 : 0,
              },
            },
          ];
        }),
      ),
    });

    (m.getSource("tours") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: tours
        .filter((t) => t.visible && t.geometry?.length)
        .map((t) => ({
          type: "Feature",
          geometry: { type: "LineString", coordinates: t.geometry.map(([lat, lon]) => [lon, lat]) },
          properties: {
            kind: "tour",
            slug: t.slug,
            name: t.name,
            subtitle: `ca. ${t.km} km · ${t.elevationGain.toLocaleString("de-DE")} hm`,
            color: t.color,
            selected: selection?.kind === "tour" && selection.slug === t.slug ? 1 : 0,
          },
        })),
    });

    (m.getSource("towns") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: showTowns
        ? towns.map((t) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [t.lon, t.lat] },
            properties: {
              kind: "town",
              slug: t.slug,
              name: t.name,
              subtitle: "Rad-Ort",
              favorite: t.favorite ? 1 : 0,
            },
          }))
        : [],
    });
  }, [passes, tours, towns, routes, showTowns, selection, ready]);

  // --- Fly to selection --------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !selection) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 0 : 900;
    if (selection.kind === "pass") {
      const p = passes.find((x) => x.slug === selection.slug);
      if (p) m.flyTo({ center: [p.lon, p.lat], zoom: Math.max(m.getZoom(), 11), duration });
    } else if (selection.kind === "town") {
      const t = towns.find((x) => x.slug === selection.slug);
      if (t) m.flyTo({ center: [t.lon, t.lat], zoom: Math.max(m.getZoom(), 10.5), duration });
    } else {
      const t = tours.find((x) => x.slug === selection.slug);
      const line = t?.geometry?.length ? t.geometry : t?.waypoints.map((w) => [w.lat, w.lon] as [number, number]);
      if (line?.length) {
        const b = new LngLatBounds();
        line.forEach(([lat, lon]) => b.extend([lon, lat]));
        m.fitBounds(b, { padding: 60, duration });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.kind, selection?.slug, ready]);

  const toggle3d = (pressed: boolean) => {
    const m = map.current;
    if (!m) return;
    setIs3d(pressed);
    if (pressed) {
      m.setTerrain(TERRAIN);
      m.easeTo({ pitch: 60, duration: 700 });
    } else {
      m.setTerrain(null);
      m.easeTo({ pitch: 0, bearing: 0, duration: 600 });
    }
  };

  const switchBase = (id: string) => {
    setBase(id);
    const m = map.current;
    if (!m) return;
    m.removeLayer("base");
    m.addLayer({ id: "base", type: "raster", source: id }, "hillshade");
  };

  const toggleOverlay = (id: string) => {
    const on = !overlays.includes(id);
    setOverlays(on ? [...overlays, id] : overlays.filter((o) => o !== id));
    map.current?.setLayoutProperty(id === "hillshade" ? "hillshade" : `ov-${id}`, "visibility", on ? "visible" : "none");
  };

  /**
   * Fit the view to everything currently drawn. Pressed again while already
   * fitted (or when nothing is drawn) it returns to the whole-Alps overview.
   */
  const fitToVisible = () => {
    const m = map.current;
    if (!m) return;
    const b = new LngLatBounds();
    passes.forEach((p) => b.extend([p.lon, p.lat]));
    tours.filter((t) => t.visible).forEach((t) => t.geometry.forEach(([lat, lon]) => b.extend([lon, lat])));
    const target = b.isEmpty() ? undefined : m.cameraForBounds(b, { padding: 48 });
    const alreadyFitted =
      target?.zoom !== undefined &&
      Math.abs(m.getZoom() - target.zoom) < 0.05 &&
      m.getCenter().distanceTo(LngLat.convert(target.center as [number, number])) < 2000;
    if (!target || alreadyFitted) {
      m.flyTo({ center: [DEFAULT_VIEW.lon, DEFAULT_VIEW.lat], zoom: DEFAULT_VIEW.zoom, pitch: 0, bearing: 0, duration: 800 });
    } else {
      m.fitBounds(b, { padding: 48, duration: 800 });
    }
  };

  const tool = cn("size-9 lg:size-8", MAP_CONTROL);

  return (
    <div className="relative size-full overflow-hidden bg-muted">
      {/* Plain "absolute inset-0" loses against the unlayered maplibre-gl.css (`.maplibregl-map { position: relative }`). */}
      <div ref={container} className="size-full" />

      <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%-4rem)] flex-wrap items-center gap-2">
        {children}
      </div>

      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={<Button size="icon-lg" variant="outline" className={tool} aria-label="Kartenebenen" />}
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
              <RadioGroup value={base} onValueChange={(v) => switchBase(String(v))} className="gap-1.5">
                {baseLayers().map((b) => (
                  <Field key={b.id} orientation="horizontal">
                    <RadioGroupItem value={b.id} id={`base-${b.id}`} />
                    <FieldLabel htmlFor={`base-${b.id}`} className="font-normal">
                      {b.name}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
            </FieldSet>
            <FieldSet className="gap-2">
              <FieldLegend variant="label">Overlays</FieldLegend>
              {[{ id: "hillshade", name: "Relief-Schummerung" }, ...OVERLAYS].map((o) => (
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
                pressed={is3d}
                onPressedChange={toggle3d}
                aria-label="3D-Gelände"
                className={cn(tool, PRESSED)}
              />
            }
          >
            <Mountain />
          </TooltipTrigger>
          <TooltipContent side="left">3D-Gelände</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={<Button size="icon-lg" variant="outline" className={tool} onClick={fitToVisible} aria-label="Ansicht einpassen" />}
          >
            <Maximize2 />
          </TooltipTrigger>
          <TooltipContent side="left">Ansicht einpassen – erneut für die ganzen Alpen</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
