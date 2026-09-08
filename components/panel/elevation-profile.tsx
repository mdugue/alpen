import type { ElevationProfile as Profile } from "@/lib/types";
import { fmt } from "@/lib/utils";

/** Gradient classes; fixed colours on purpose so profiles compare across passes. */
const GRADIENT_COLORS = [
  { color: "oklch(0.75 0.09 150)", label: "< 3 %", max: 3 },
  { color: "oklch(0.82 0.12 95)", label: "3–6 %", max: 6 },
  { color: "oklch(0.72 0.15 60)", label: "6–9 %", max: 9 },
  { color: "oklch(0.6 0.18 30)", label: "9–12 %", max: 12 },
  { color: "oklch(0.45 0.16 350)", label: "> 12 %", max: Infinity },
];
const colorFor = (g: number) => GRADIENT_COLORS.find((c) => g < c.max)!.color;

/** Elevation profile with gradient colours; segment values via title on hover. */
export const ElevationProfile = ({ profile }: { profile: Profile }) => {
  const W = 360;
  const H = 96;
  const ml = 32;
  const mb = 14;
  const lo = Math.floor((Math.min(...profile.ele) - 40) / 100) * 100;
  const hi = Math.ceil((profile.top + 40) / 100) * 100;
  const x = (d: number) => ml + (d / profile.km) * (W - ml - 4);
  const y = (e: number) => H - mb - ((e - lo) / (hi - lo)) * (H - mb - 6);
  const step = hi - lo > 1200 ? 500 : hi - lo > 600 ? 250 : 100;
  const gridlines = Array.from(
    { length: Math.floor((hi - lo) / step) + 1 },
    (_, i) => lo + i * step,
  );
  const points = profile.ele.map(
    (e, i) => `${x(profile.dist[i]!).toFixed(1)},${y(e).toFixed(1)}`,
  );

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Höhenprofil: ${fmt(profile.km, 1)} km von ${fmt(profile.start)} auf ${fmt(profile.top)} m, im Mittel ${fmt(profile.avgGradient, 1)} %`}
      >
        {gridlines.map((e) => (
          <g key={e}>
            <line
              x1={ml}
              x2={W - 4}
              y1={y(e)}
              y2={y(e)}
              className="stroke-border"
              strokeWidth={0.6}
            />
            <text
              x={ml - 3}
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
          const dd = (profile.dist[i]! - profile.dist[i - 1]!) * 10 || 1;
          const gradient = (e - profile.ele[i - 1]!) / dd;
          return (
            <polygon
              key={i}
              points={`${x(profile.dist[i - 1]!)},${H - mb} ${points[i - 1]} ${points[i]} ${x(profile.dist[i]!)},${H - mb}`}
              fill={colorFor(gradient)}
              opacity={0.9}
            >
              <title>{`km ${fmt(profile.dist[i]!, 1)} · ${fmt(e)} m · ${fmt(gradient, 1)} %`}</title>
            </polygon>
          );
        })}
        <polyline
          points={points.join(" ")}
          fill="none"
          className="stroke-foreground"
          strokeWidth={1}
        />
        <text x={ml} y={H - 3} fontSize={9} className="fill-muted-foreground">
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
};
