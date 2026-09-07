import type { ElevationProfile as Profile } from "@/lib/types";

const GRADIENT_COLORS = [
  { max: 3, color: "oklch(0.75 0.09 150)" },
  { max: 6, color: "oklch(0.82 0.12 95)" },
  { max: 9, color: "oklch(0.72 0.15 60)" },
  { max: 12, color: "oklch(0.6 0.18 30)" },
  { max: Infinity, color: "oklch(0.42 0.15 350)" },
];
const colorFor = (g: number) => GRADIENT_COLORS.find((c) => g < c.max)!.color;

/** Höhenprofil mit Steigungsfarben; Werte per Titel beim Überfahren. */
export function ElevationProfile({ profile }: { profile: Profile }) {
  const W = 360;
  const H = 96;
  const ml = 32;
  const mb = 14;
  const lo = Math.floor((Math.min(...profile.ele) - 40) / 100) * 100;
  const hi = Math.ceil((profile.top + 40) / 100) * 100;
  const x = (d: number) => ml + (d / profile.km) * (W - ml - 4);
  const y = (e: number) => H - mb - ((e - lo) / (hi - lo)) * (H - mb - 6);
  const step = hi - lo > 1200 ? 500 : hi - lo > 600 ? 250 : 100;
  const gridlines = Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const points = profile.ele.map((e, i) => `${x(profile.dist[i]!).toFixed(1)},${y(e).toFixed(1)}`);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Höhenprofil">
      {gridlines.map((e) => (
        <g key={e}>
          <line x1={ml} x2={W - 4} y1={y(e)} y2={y(e)} className="stroke-border" strokeWidth={0.6} />
          <text x={ml - 3} y={y(e) + 3} fontSize={8} textAnchor="end" className="fill-muted-foreground">
            {e}
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
            <title>{`km ${profile.dist[i]!.toFixed(1)} · ${e} m · ${gradient.toFixed(1)} %`}</title>
          </polygon>
        );
      })}
      <polyline points={points.join(" ")} fill="none" className="stroke-foreground" strokeWidth={1} />
      <text x={ml} y={H - 3} fontSize={8} className="fill-muted-foreground">0 km</text>
      <text x={W - 4} y={H - 3} fontSize={8} textAnchor="end" className="fill-muted-foreground">
        {profile.km} km
      </text>
      <text x={W - 4} y={9} fontSize={8} textAnchor="end" className="fill-muted-foreground">
        {"<3 · 3–6 · 6–9 · 9–12 · >12 %"}
      </text>
    </svg>
  );
}
