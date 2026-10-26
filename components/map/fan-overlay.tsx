"use client";

import type { Map as MLMap } from "maplibre-gl";
import { useEffect, useState } from "react";
import type { RefObject } from "react";

import { useT } from "@/components/i18n";
import { StatusDot } from "@/components/status-badge";
import type { Selection } from "@/lib/app-state";
import { FAN, fanLayout } from "@/lib/fan";
import type { Fan, Px } from "@/lib/fan";
import { fill } from "@/lib/i18n/fill";
import type { Inset } from "@/lib/map-camera";
import type { SceneFan } from "@/lib/map-scene";
import { cn } from "@/lib/utils";

/** A row on a coarse pointer: a name a finger can hit. */
const STEP_COARSE = 34;

interface Drawn {
  /** Which area it was laid out for: a layout of the last one is not drawn. */
  slug: string;
  fan: Fan;
  /** The outline on the screen, for the veil's hole. */
  hole: Px[];
  width: number;
  height: number;
}

/**
 * The fan, drawn: an area's roads named in two columns beside its outline,
 * each with a line to its dot, and the rest of the map veiled a little so the
 * area stands out (lib/fan.ts says where everything goes and when).
 *
 * It sits over the map rather than in it. The names are buttons – pointing at
 * one rings its road, pressing it opens the road – and the columns follow the
 * camera frame by frame, which a MapLibre symbol layer placed in map
 * coordinates could do neither of. The overlay itself lets the pointer
 * through; only the names take it.
 */
export const FanOverlay = ({
  map,
  ready,
  fan,
  inset,
  coarse,
  hoveredRoad,
  onHover,
  onSelect,
  onOver,
}: {
  map: RefObject<MLMap | null>;
  ready: boolean;
  fan: SceneFan | null;
  inset: Inset;
  coarse: boolean;
  /** The road the pointer is on, wherever it is: its line is drawn heavier. */
  hoveredRoad: string | null;
  onHover: (sel: Selection | null) => void;
  onSelect: (sel: Selection) => void;
  /** Whether the pointer is on the names – what keeps the fan open while it travels there. */
  onOver: (over: boolean) => void;
}) => {
  const { t } = useT();
  const [drawn, setDrawn] = useState<Drawn | null>(null);

  // The layout is a function of where the map draws the area, so it is worked
  // out again on every frame the camera moves – a flight to the area carries
  // the names along with it.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !fan) return;
    let frame = 0;
    const layout = () => {
      frame = 0;
      const { clientHeight: height, clientWidth: width } = m.getContainer();
      const at = (lon: number, lat: number): Px => {
        const p = m.project([lon, lat]);
        return { x: p.x, y: p.y };
      };
      const hole = fan.outline.map(([lon, lat]) => at(lon, lat));
      setDrawn({
        fan: fanLayout(
          fan.roads.map((r) => ({ ...r, at: at(r.lon, r.lat) })),
          hole,
          { height, inset, step: coarse ? STEP_COARSE : FAN.step, width },
        ),
        height,
        hole,
        slug: fan.slug,
        width,
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(layout);
    };
    schedule();
    m.on("move", schedule);
    m.on("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      m.off("move", schedule);
      m.off("resize", schedule);
    };
  }, [map, ready, fan, inset, coarse]);

  if (!fan || drawn?.slug !== fan.slug) return null;
  const { width, height, hole } = drawn;
  const veil = `M0 0H${width}V${height}H0Z M${hole.map((p) => `${p.x} ${p.y}`).join("L")}Z`;
  return (
    <div
      key={fan.slug}
      className="animate-in fade-in pointer-events-none absolute inset-0 z-[1] duration-200 motion-reduce:animate-none"
    >
      <svg
        className="absolute inset-0 size-full"
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden
      >
        <path d={veil} fillRule="evenodd" className="fill-background/45" />
        {drawn.fan.entries.map((e) => (
          <g
            key={e.slug}
            className={cn(
              "stroke-foreground transition-[stroke-opacity,stroke-width] duration-100",
              e.slug === hoveredRoad
                ? "[stroke-width:2] [stroke-opacity:0.9]"
                : "[stroke-width:1] [stroke-opacity:0.4]",
            )}
          >
            <line x1={e.at.x} y1={e.at.y} x2={e.label.x} y2={e.label.y} />
            <circle
              cx={e.at.x}
              cy={e.at.y}
              r={2}
              className="fill-foreground stroke-none"
            />
          </g>
        ))}
      </svg>
      <ul
        aria-label={fill(t.map.fan.region, { name: fan.name })}
        onPointerEnter={() => onOver(true)}
        onPointerLeave={() => {
          onOver(false);
          onHover(null);
        }}
      >
        {drawn.fan.entries.map((e) => (
          <li
            key={e.slug}
            className="absolute -translate-y-1/2"
            style={
              e.side === "left"
                ? { right: width - e.label.x, top: e.label.y }
                : { left: e.label.x, top: e.label.y }
            }
          >
            <button
              type="button"
              className={cn(
                "bg-card/90 border-border/70 pointer-events-auto flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs whitespace-nowrap shadow-sm backdrop-blur-sm",
                "hover:border-foreground/40 focus-visible:ring-ring outline-none focus-visible:ring-2",
                "pointer-coarse:h-8 pointer-coarse:px-3",
                e.side === "left" && "flex-row-reverse",
                e.status === "open"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground",
                e.slug === hoveredRoad && "border-foreground/50",
              )}
              onPointerEnter={() => onHover({ kind: "pass", slug: e.slug })}
              onFocus={() => onHover({ kind: "pass", slug: e.slug })}
              onClick={() => onSelect({ kind: "pass", slug: e.slug })}
            >
              <StatusDot status={e.status} hollow={e.status === "closed"} />
              {e.name}
            </button>
          </li>
        ))}
      </ul>
      {drawn.fan.moreAt && (
        <p
          className="text-muted-foreground absolute -translate-y-1/2 px-2 text-xs whitespace-nowrap"
          style={
            drawn.fan.moreAt.side === "left"
              ? { right: width - drawn.fan.moreAt.x, top: drawn.fan.moreAt.y }
              : { left: drawn.fan.moreAt.x, top: drawn.fan.moreAt.y }
          }
        >
          {fill(t.map.fan.more, { n: drawn.fan.more })}
        </p>
      )}
    </div>
  );
};
