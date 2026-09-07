import { MONTHS, periodIndex, periodLabel, PERIODS } from "@/lib/status";
import type { ClimateYear, Period } from "@/lib/types";

/**
 * Balken: Anteil der Tage mit Frost bzw. Schneefall je Halbmonat (linke Achse,
 * Prozent). Linien: mittlerer Tageshöchst- und Tiefstwert (rechte Achse, °C).
 */
export function ClimateChart({ climate, period }: { climate: ClimateYear; period: Period }) {
  const W = 360;
  const H = 124;
  const ml = 26;
  const mr = 26;
  const mt = 8;
  const mb = 16;
  const bw = (W - ml - mr) / 24;
  const current = periodIndex(period);
  const buckets = climate.filter((b) => b !== null);
  if (!buckets.length) return null;

  const y = (pct: number) => mt + (1 - pct / 100) * (H - mt - mb);
  const tlo = Math.floor((Math.min(...buckets.map((b) => b!.tmin)) - 2) / 5) * 5;
  const thi = Math.ceil((Math.max(...buckets.map((b) => b!.tmax)) + 2) / 5) * 5;
  const yt = (t: number) => mt + (1 - (t - tlo) / (thi - tlo)) * (H - mt - mb);
  const line = (key: "tmax" | "tmin") =>
    climate
      .map((b, i) => (b ? `${(ml + i * bw + bw / 2).toFixed(1)},${yt(b[key]).toFixed(1)}` : null))
      .filter(Boolean)
      .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Klima je Halbmonat">
      {[0, 25, 50, 75, 100].map((p) => (
        <g key={p}>
          <line x1={ml} x2={W - mr} y1={y(p)} y2={y(p)} className="stroke-border" strokeWidth={0.6} />
          <text x={ml - 3} y={y(p) + 3} fontSize={8} textAnchor="end" className="fill-muted-foreground">
            {p}%
          </text>
        </g>
      ))}
      {Array.from({ length: Math.floor((thi - tlo) / 5) + 1 }, (_, i) => tlo + i * 5).map((t) => (
        <text key={t} x={W - mr + 3} y={yt(t) + 3} fontSize={8} className="fill-status-risky">
          {t}°
        </text>
      ))}
      <line
        x1={ml}
        x2={W - mr}
        y1={yt(0)}
        y2={yt(0)}
        className="stroke-status-risky"
        strokeWidth={0.7}
        strokeDasharray="3 3"
      />
      {climate.map((b, i) => {
        if (!b) return null;
        const x0 = ml + i * bw;
        const label = periodLabel(PERIODS[i]!);
        return (
          <g key={i}>
            <rect
              x={x0 + 1}
              y={y(b.frostPct)}
              width={bw - 2}
              height={y(0) - y(b.frostPct)}
              className={i === current ? "fill-primary/40" : "fill-muted-foreground/20"}
            >
              <title>{`${label}: Frost an ${b.frostPct} % der Tage`}</title>
            </rect>
            <rect
              x={x0 + 1}
              y={y(b.snowPct)}
              width={bw - 2}
              height={y(0) - y(b.snowPct)}
              className={i === current ? "fill-status-closed" : "fill-muted-foreground/50"}
            >
              <title>{`${label}: Schneefall an ${b.snowPct} % der Tage`}</title>
            </rect>
            {i % 2 === 0 && (
              <text x={x0 + bw} y={H - 4} fontSize={7.5} textAnchor="middle" className="fill-muted-foreground">
                {MONTHS[i / 2]!.slice(0, 3)}
              </text>
            )}
          </g>
        );
      })}
      <polyline points={line("tmax")} fill="none" className="stroke-status-risky" strokeWidth={1.4} />
      <polyline
        points={line("tmin")}
        fill="none"
        className="stroke-status-risky"
        strokeWidth={1.4}
        strokeDasharray="4 2"
      />
      <rect
        x={ml + current * bw}
        y={mt}
        width={bw}
        height={H - mt - mb}
        fill="none"
        className="stroke-foreground"
        strokeWidth={1}
      />
    </svg>
  );
}
