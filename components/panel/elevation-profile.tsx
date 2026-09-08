"use client";

import { useState } from "react";

import { stepGradient } from "@/lib/profile";
import type { ElevationProfile as Profile, RouteGeometry } from "@/lib/types";
import { fmt } from "@/lib/utils";

/** Gradient classes; fixed colours on purpose so profiles compare across passes. */
const GRADIENT_COLORS = [
  { max: 3, label: "< 3 %", color: "oklch(0.75 0.09 150)" },
  { max: 6, label: "3–6 %", color: "oklch(0.82 0.12 95)" },
  { max: 9, label: "6–9 %", color: "oklch(0.72 0.15 60)" },
  { max: 12, label: "9–12 %", color: "oklch(0.6 0.18 30)" },
  { max: Infinity, label: "> 12 %", color: "oklch(0.45 0.16 350)" },
];
const colorFor = (g: number) => GRADIENT_COLORS.find((c) => g < c.max)!.color;

const W = 360;
const H = 96;
const ML = 32;
const MB = 14;

interface Props {
  profile: Profile;
  /**
   * The road points the profile was sampled at (`profileCoords`), so the
   * cursor can be shown on the map. Without them the profile still scrubs,
   * it just has nowhere to point.
   */
  coords?: RouteGeometry;
  /** Sample under the cursor, `null` once it leaves. */
  onCursor?: (point: { lat: number; lon: number } | null) => void;
  /** Click or Enter on a sample: take the map there. */
  onZoomTo?: (point: { lat: number; lon: number }) => void;
}

/**
 * Elevation profile with gradient colours, scrubbable with pointer, touch and
 * keyboard. The values used to sit in `<title>` tooltips, which touch users
 * never saw and which never reached the map; the cursor shows them in the
 * figure and reports the road point so the map can mark it.
 */
export function ElevationProfile({
  profile,
  coords,
  onCursor,
  onZoomTo,
}: Props) {
  const [cursor, setCursor] = useState<number | null>(null);

  const lo = Math.floor((Math.min(...profile.ele) - 40) / 100) * 100;
  const hi = Math.ceil((profile.top + 40) / 100) * 100;
  const x = (d: number) => ML + (d / profile.km) * (W - ML - 4);
  const y = (e: number) => H - MB - ((e - lo) / (hi - lo)) * (H - MB - 6);
  const step = hi - lo > 1200 ? 500 : hi - lo > 600 ? 250 : 100;
  const gridlines = Array.from(
    { length: Math.floor((hi - lo) / step) + 1 },
    (_, i) => lo + i * step,
  );
  const points = profile.ele.map(
    (e, i) => `${x(profile.dist[i]!).toFixed(1)},${y(e).toFixed(1)}`,
  );

  const last = profile.ele.length - 1;
  const pointAt = (i: number) => {
    const c = coords?.[i];
    return c ? { lat: c[0], lon: c[1] } : null;
  };
  /** Single place that moves the cursor, so the map never lags behind the figure. */
  const move = (i: number | null) => {
    setCursor(i);
    onCursor?.(i === null ? null : pointAt(i));
  };
  const sampleAtClientX = (svg: SVGSVGElement, clientX: number) => {
    const rect = svg.getBoundingClientRect();
    const km =
      ((((clientX - rect.left) / rect.width) * W - ML) / (W - ML - 4)) *
      profile.km;
    let best = 0;
    for (let i = 1; i <= last; i++)
      if (Math.abs(profile.dist[i]! - km) < Math.abs(profile.dist[best]! - km))
        best = i;
    return best;
  };

  const readout = (i: number) =>
    `km ${fmt(profile.dist[i]!, 1)} · ${fmt(profile.ele[i]!)} m · ${fmt(stepGradient(profile, i), 1)} %`;
  const summary = `Höhenprofil: ${fmt(profile.km, 1)} km von ${fmt(profile.start)} auf ${fmt(profile.top)} m, im Mittel ${fmt(profile.avgGradient, 1)} %`;

  const onKeyDown = (e: React.KeyboardEvent) => {
    const at = cursor ?? 0;
    const go = (i: number) => {
      e.preventDefault();
      move(Math.min(last, Math.max(0, i)));
    };
    if (e.key === "ArrowRight" || e.key === "ArrowUp") go(at + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") go(at - 1);
    else if (e.key === "PageUp") go(at + 10);
    else if (e.key === "PageDown") go(at - 10);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(last);
    else if (e.key === "Enter" || e.key === " ") {
      const p = pointAt(at);
      if (!p) return;
      e.preventDefault();
      onZoomTo?.(p);
    }
  };

  return (
    <figure>
      <div
        role="slider"
        tabIndex={0}
        aria-label={summary}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={cursor ?? 0}
        aria-valuetext={
          cursor === null
            ? `${summary}. Mit den Pfeiltasten am Profil entlang.`
            : readout(cursor)
        }
        onKeyDown={onKeyDown}
        onBlur={() => move(null)}
        className="focus-visible:ring-ring rounded-sm outline-none focus-visible:ring-2"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-pan-y"
          aria-hidden
          onPointerDown={(e) => {
            // Touch and pen scrub only while held, so a tap does not leave a
            // stale cursor behind; the mouse tracks on hover as usual.
            if (e.pointerType !== "mouse")
              e.currentTarget.setPointerCapture(e.pointerId);
            move(sampleAtClientX(e.currentTarget, e.clientX));
          }}
          onPointerMove={(e) => {
            if (
              e.pointerType === "mouse" ||
              e.currentTarget.hasPointerCapture(e.pointerId)
            )
              move(sampleAtClientX(e.currentTarget, e.clientX));
          }}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              move(null);
            }
          }}
          onPointerCancel={() => move(null)}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") move(null);
          }}
          onClick={(e) => {
            const p = pointAt(sampleAtClientX(e.currentTarget, e.clientX));
            if (p) onZoomTo?.(p);
          }}
        >
          {gridlines.map((e) => (
            <g key={e}>
              <line
                x1={ML}
                x2={W - 4}
                y1={y(e)}
                y2={y(e)}
                className="stroke-border"
                strokeWidth={0.6}
              />
              <text
                x={ML - 3}
                y={y(e) + 3}
                fontSize={9}
                textAnchor="end"
                className="fill-muted-foreground"
              >
                {fmt(e)}
              </text>
            </g>
          ))}
          {profile.ele.slice(1).map((e, idx) => {
            const i = idx + 1;
            return (
              <polygon
                key={i}
                points={`${x(profile.dist[i - 1]!)},${H - MB} ${points[i - 1]} ${points[i]} ${x(profile.dist[i]!)},${H - MB}`}
                fill={colorFor(stepGradient(profile, i))}
                opacity={0.9}
              />
            );
          })}
          <polyline
            points={points.join(" ")}
            fill="none"
            className="stroke-foreground"
            strokeWidth={1}
          />
          {cursor !== null && (
            <Cursor
              cx={x(profile.dist[cursor]!)}
              cy={y(profile.ele[cursor]!)}
              text={readout(cursor)}
            />
          )}
          <text x={ML} y={H - 3} fontSize={9} className="fill-muted-foreground">
            0 km
          </text>
          <text
            x={W - 4}
            y={H - 3}
            fontSize={9}
            textAnchor="end"
            className="fill-muted-foreground"
          >
            {fmt(profile.km, 1)} km
          </text>
        </svg>
      </div>
      <figcaption className="text-muted-foreground flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px]">
        {GRADIENT_COLORS.map((c) => (
          <span key={c.label} className="inline-flex items-center gap-1">
            <span
              className="inline-block size-2 rounded-[2px]"
              style={{ background: c.color }}
              aria-hidden
            />
            {c.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Hairline, dot and readout at the scrubbed sample; the readout flips at the right edge. */
function Cursor({ cx, cy, text }: { cx: number; cy: number; text: string }) {
  const flip = cx > W * 0.58;
  return (
    <g>
      <line
        x1={cx}
        x2={cx}
        y1={4}
        y2={H - MB}
        className="stroke-foreground"
        strokeWidth={0.8}
        strokeDasharray="2 2"
      />
      <circle
        cx={cx}
        cy={cy}
        r={3}
        className="fill-card stroke-foreground"
        strokeWidth={1.5}
      />
      <text
        x={flip ? cx - 5 : cx + 5}
        y={10}
        fontSize={9.5}
        textAnchor={flip ? "end" : "start"}
        className="fill-foreground font-medium tabular-nums"
        paintOrder="stroke"
        strokeWidth={3}
        strokeLinejoin="round"
        style={{ stroke: "var(--card)" }}
      >
        {text}
      </text>
    </g>
  );
}
