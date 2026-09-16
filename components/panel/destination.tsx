"use client";

import { Section } from "@/components/panel/section";
import { Rating } from "@/components/rating";
import { SeasonStrip } from "@/components/season-strip";
import { StatusBadge, StatusDot } from "@/components/status-badge";
import type { Destination, ReachedPass } from "@/lib/destination";
import { destinationText, GRADE_ORDER } from "@/lib/destination";
import { REACH_BANDS, REACH_MAX_KM } from "@/lib/geo";
import { cellAt, periodLabel } from "@/lib/status";
import type { Grade } from "@/lib/status";
import type { Period } from "@/lib/types";
import { fmt, fmtUnit } from "@/lib/utils";

/** The strip's own ramp, so the bar and the 24 cells say the same thing. */
const GRADE_FILL: Record<Grade, string> = {
  best: "bg-grade-best",
  closed: "bg-muted-foreground/25",
  good: "bg-grade-good",
  limited: "bg-grade-limited",
};

/**
 * How the reachable passes fall across the four grades, as one bar. The same
 * stack the period scrubber draws behind its 24 half-months, for one
 * half-month and one base – so the two read as one picture and a visitor who
 * has understood the scrubber has already understood this.
 */
const GradeBar = ({ d }: { d: Destination }) => {
  if (d.total === 0) return null;
  return (
    <div
      className="bg-muted flex h-2.5 w-full overflow-hidden rounded-full"
      role="img"
      aria-label={destinationText(d)}
    >
      {GRADE_ORDER.map((g) => {
        const n = d.counts[g];
        if (n === 0) return null;
        return (
          <span
            key={g}
            className={GRADE_FILL[g]}
            style={{ width: `${(n / d.total) * 100}%` }}
          />
        );
      })}
    </div>
  );
};

/**
 * One reachable pass. Everything a base is judged on is in the row – the
 * status now, the beauty, the height and the whole year – because the
 * question this list answers is "is this a good place to stay", and a name
 * with a distance next to it cannot answer it. The distance is still there
 * and still exact; it has simply stopped being the only thing said.
 */
const PassRow = ({
  r,
  period,
  onSelect,
}: {
  r: ReachedPass;
  period: Period;
  onSelect: () => void;
}) => (
  <li>
    <button
      type="button"
      onClick={onSelect}
      className="hover:bg-muted/60 focus-visible:inset-ring-ring/50 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-sm px-1 py-1 text-left outline-none focus-visible:inset-ring-2"
    >
      <StatusDot status={r.status} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">
          {r.pass.name}
        </span>
        <span className="text-muted-foreground text-2xs flex items-center gap-1.5">
          <Rating value={r.pass.beauty} className="[&>span]:h-1.5" />
          {fmtUnit(r.pass.elevation, "m")}
        </span>
      </span>
      <span className="flex flex-col items-end gap-0.5">
        <span className="text-muted-foreground text-2xs tabular-nums">
          {fmtUnit(r.km, "km")}
        </span>
        <SeasonStrip cells={r.season} current={period} className="w-16" />
      </span>
    </button>
  </li>
);

/**
 * A destination, judged for the chosen half-month.
 *
 * The block leads with a verdict and its reason, exactly as the pass panel
 * does, and only then lists what the verdict was made of. The 24 cells are
 * the town's own – derived from the passes it reaches, never measured – and
 * the label says so, with every pass's own strip visible in the rows
 * underneath so the derivation can be checked by eye (Principle 3).
 *
 * The list is grouped by reach band rather than cut at a radius, and ordered
 * inside each band by a score that weights nearness smoothly (see
 * `lib/geo.ts`): the bands are what is read, the weight is what ranks.
 */
export const DestinationSection = ({
  d,
  period,
  onSelect,
  title = "Pässe von hier aus",
}: {
  d: Destination;
  period: Period;
  onSelect: (slug: string) => void;
  title?: string;
}) => {
  const cell = cellAt(d.year, period);
  return (
    <>
      <div className="bg-muted/40 border-border/70 mt-3 flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge cell={cell} period={period} />
          {d.year.best && (
            <span className="text-muted-foreground text-xs">
              beste Zeit {periodLabel(d.year.best[0])} –{" "}
              {periodLabel(d.year.best[1])}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {destinationText(d)}
        </p>
        <GradeBar d={d} />
        <SeasonStrip cells={d.year.cells} current={period} size="panel" />
        <p className="text-muted-foreground text-2xs">
          Abgeleitet aus den {d.total} Pässen im Umkreis – der Ort selbst hat
          keine eigene Klimareihe.
        </p>
      </div>

      <Section
        id="destination-passes"
        info={`Nach Zustand im gewählten Halbmonat, Schönheit und Nähe sortiert. Nähe zählt gleitend: ein Pass wird nicht bei einem runden Kilometerwert wertlos, sondern verliert mit der Entfernung an Gewicht. Jenseits von ${REACH_MAX_KM} km endet die Liste.`}
        title={title}
      >
        {d.total === 0 ? (
          <p className="text-muted-foreground text-xs">
            Kein Pass im Umkreis von {REACH_MAX_KM} km.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {d.bands.map((g) => (
              <div key={g.band}>
                <p className="text-muted-foreground text-2xs mb-0.5 flex items-baseline gap-1.5 font-semibold tracking-widest uppercase">
                  {g.label}
                  <span className="font-normal tracking-normal normal-case">
                    {fmt(g.passes.length)} Pässe · bis{" "}
                    {fmtUnit(
                      REACH_BANDS.find((b) => b.key === g.band)!.maxKm,
                      "km",
                    )}
                  </span>
                </p>
                <ul className="-mx-1 flex flex-col">
                  {g.passes.map((r) => (
                    <PassRow
                      key={r.pass.slug}
                      r={r}
                      period={period}
                      onSelect={() => onSelect(r.pass.slug)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
};
