"use client";

import type { Map as MLMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { useT } from "@/components/i18n";
import { StatusDot } from "@/components/status-badge";
import type { Selection } from "@/lib/app-state";
import { FAN, fanLayout } from "@/lib/fan";
import type { Fan, Px } from "@/lib/fan";
import { fill } from "@/lib/i18n/fill";
import type { Inset } from "@/lib/map-camera";
import type { SceneFan } from "@/lib/map-scene";
import { cn, fmtUnit } from "@/lib/utils";

/** A row on a coarse pointer: a name a finger can hit. */
const STEP_COARSE = 34;

interface Drawn {
  /** Which area it was laid out for: a layout of the last one is not drawn. */
  slug: string;
  fan: Fan;
  width: number;
  height: number;
}

/**
 * The fan, drawn: an area's roads named in two columns beside its outline,
 * each with a line to its dot (lib/fan.ts says where everything goes and
 * when). It is the roads' hover label: the name the pointer is on – on the
 * map or in the fan – also says its height. The map around it stays as it
 * is; a veil that dimmed it made every hover a change of the whole picture.
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
  /**
   * Which area's names the pointer is on, or `null` – what keeps the fan open
   * while the pointer travels there. Cleared whenever the fan goes, because
   * names taken away from under a still pointer never hear it leave.
   */
  onOver: (slug: string | null) => void;
}) => {
  const { lang, t } = useT();
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  // The scene is a new value on every render, the fan in it rarely another
  // one: the effect below starts over only when its area or roads change, and
  // reads the rest from here.
  const latest = useRef(fan);
  useEffect(() => {
    latest.current = fan;
  });
  const slug = fan?.slug ?? null;
  const roads = fan?.roads.map((r) => `${r.slug}:${r.status}`).join(",");
  // A fan that goes – or turns into another area's – lets go of the pointer
  // and of its layout: a layout is only good for the camera it was made under,
  // so one that opens again starts from its next frame, not from where it was.
  useEffect(
    () => () => {
      if (!slug) return;
      onOver(null);
      setDrawn(null);
    },
    [slug, onOver],
  );
  // The panels' share of the screen, as numbers: the prop is a new object on
  // every render, and the layout below must not start over for that.
  const { bottom, left, right, top } = inset;

  // The layout is a function of where the map draws the area, so it is worked
  // out again on every frame the camera moves – a flight to the area carries
  // the names along with it.
  useEffect(() => {
    const m = map.current;
    // `roads` is what the area's drawn roads were when this effect started.
    if (!ready || !m || !slug || !roads) return;
    let frame = 0;
    const layout = () => {
      frame = 0;
      const now = latest.current;
      if (now?.slug !== slug) return;
      const { clientHeight: height, clientWidth: width } = m.getContainer();
      const at = (lon: number, lat: number): Px => {
        const p = m.project([lon, lat]);
        return { x: p.x, y: p.y };
      };
      const hole = now.outline.map(([lon, lat]) => at(lon, lat));
      setDrawn({
        fan: fanLayout(
          now.roads.map((r) => ({ ...r, at: at(r.lon, r.lat) })),
          hole,
          {
            height,
            inset: { bottom, left, right, top },
            step: coarse ? STEP_COARSE : FAN.step,
            width,
          },
        ),
        height,
        slug,
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
  }, [map, ready, slug, roads, top, right, bottom, left, coarse]);

  if (!fan || drawn?.slug !== fan.slug) return null;
  const { width, height } = drawn;
  const heightOf = new Map(fan.roads.map((r) => [r.slug, r.elevation]));
  return (
    <div
      key={fan.slug}
      data-fan
      className="animate-in fade-in pointer-events-none absolute inset-0 z-[1] duration-150 motion-reduce:animate-none"
    >
      <svg
        className="absolute inset-0 size-full"
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden
      >
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
        onPointerEnter={() => onOver(fan.slug)}
        onPointerLeave={() => {
          onOver(null);
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
                "bg-card/95 border-border/70 pointer-events-auto flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs whitespace-nowrap shadow-sm",
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
              onBlur={() => onHover(null)}
              onClick={() => onSelect({ kind: "pass", slug: e.slug })}
            >
              <StatusDot status={e.status} hollow={e.status === "closed"} />
              {e.name}
              {e.slug === hoveredRoad && (
                <span className="text-muted-foreground font-normal tabular-nums">
                  {fmtUnit(heightOf.get(e.slug) ?? 0, "m", 0, lang)}
                </span>
              )}
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
