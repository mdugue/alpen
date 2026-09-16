"use client";

import { Section } from "@/components/panel/section";
import { Rating } from "@/components/rating";
import { SeasonStrip } from "@/components/season-strip";
import { StatusBadge, StatusDot } from "@/components/status-badge";
import type { Selection } from "@/lib/app-state";
import type {
  Bases,
  Destination,
  ReachedPass,
  ReachedTown,
} from "@/lib/destination";
import { destinationText, GRADE_ORDER } from "@/lib/destination";
import { REACH_BANDS, REACH_MAX_KM } from "@/lib/geo";
import { cellAt, periodLabel } from "@/lib/status";
import type { Grade } from "@/lib/status";
import type { Period } from "@/lib/types";
import { cn, fmt, fmtUnit } from "@/lib/utils";

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
const ROW =
  "focus-visible:inset-ring-ring/50 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-sm px-1 py-1 text-left outline-none focus-visible:inset-ring-2";

/** The row is a pointer target like any list row: it lights its mark on the map. */
const hoverProps = (on: () => void, off: () => void) => ({
  onBlur: off,
  onFocus: on,
  onPointerEnter: on,
  onPointerLeave: off,
});

const PassRow = ({
  r,
  period,
  hovered,
  onHover,
  onSelect,
}: {
  r: ReachedPass;
  period: Period;
  hovered: boolean;
  onHover: (over: boolean) => void;
  onSelect: () => void;
}) => (
  <li>
    <button
      type="button"
      onClick={onSelect}
      {...hoverProps(
        () => onHover(true),
        () => onHover(false),
      )}
      className={cn(ROW, hovered ? "bg-accent/15" : "hover:bg-muted/60")}
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
 * One town as a candidate base. The count is the whole point of the row: the
 * nearest village is not automatically the best place to sleep, and "12 von
 * 33 Pässen gut" is what tells the two apart.
 */
const TownRow = ({
  r,
  hovered,
  onHover,
  onSelect,
}: {
  r: ReachedTown;
  hovered: boolean;
  onHover: (over: boolean) => void;
  onSelect: () => void;
}) => (
  <li>
    <button
      type="button"
      onClick={onSelect}
      {...hoverProps(
        () => onHover(true),
        () => onHover(false),
      )}
      className={cn(ROW, hovered ? "bg-accent/15" : "hover:bg-muted/60")}
    >
      <span className="bg-town size-2.5 shrink-0 rounded-full" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">
          {r.town.name}
        </span>
        <span className="text-muted-foreground text-2xs">
          {r.town.country} ·{" "}
          {r.total === 0
            ? "kein Pass im Umkreis"
            : `${fmt(r.rideable)} von ${fmt(r.total)} Pässen gut`}
        </span>
      </span>
      <span className="text-muted-foreground text-2xs tabular-nums">
        {fmtUnit(r.km, "km")}
      </span>
    </button>
  </li>
);

/** "VOR DER HAUSTÜR · 5 Pässe bis 18 km" – the same header for both lists. */
const BandHeader = ({
  label,
  n,
  maxKm,
  noun,
}: {
  label: string;
  n: number;
  maxKm: number;
  noun: string;
}) => (
  <p className="text-muted-foreground text-2xs mb-0.5 flex items-baseline gap-1.5 font-semibold tracking-widest uppercase">
    {label}
    <span className="font-normal tracking-normal normal-case">
      {fmt(n)} {noun} · bis {fmtUnit(maxKm, "km")}
    </span>
  </p>
);

const bandMax = (band: string) =>
  REACH_BANDS.find((b) => b.key === band)!.maxKm;

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
  hovered,
  onHover,
  onSelect,
  title = "Pässe von hier aus",
}: {
  d: Destination;
  period: Period;
  /** The entity the pointer is over anywhere on screen; one highlight for all of them. */
  hovered: Selection | null;
  onHover: (sel: Selection | null) => void;
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
        {/* What the 24 cells are graded against, said out loud. They are
            relative to this base's own best half-month, so the strip shows
            when to come rather than how big the place is; the magnitude is
            the sentence and the bar above (`gradeOf` in lib/destination.ts). */}
        <p className="text-muted-foreground text-2xs">
          Abgeleitet aus den {d.total} Pässen im Umkreis – der Ort selbst hat
          keine eigene Klimareihe. Der Streifen zeigt den Jahresverlauf im
          Verhältnis zur besten Zeit dieses Orts
          {d.peak > 0 && <> (dann sind {fmt(d.peak)} Pässe gut befahrbar)</>}.
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
                <BandHeader
                  label={g.label}
                  n={g.passes.length}
                  maxKm={bandMax(g.band)}
                  noun="Pässe"
                />
                <ul className="-mx-1 flex flex-col">
                  {g.passes.map((r) => (
                    <PassRow
                      key={r.pass.slug}
                      r={r}
                      period={period}
                      hovered={
                        hovered?.kind === "pass" && hovered.slug === r.pass.slug
                      }
                      onHover={(over) =>
                        onHover(
                          over ? { kind: "pass", slug: r.pass.slug } : null,
                        )
                      }
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

/**
 * The inverse block: which towns this road could be ridden from.
 *
 * It is the same picture as `DestinationSection` read the other way round, so
 * it uses the same bands, the same nearness weight and the same row shape –
 * a planner who has understood one has understood the other. What it does not
 * have is a verdict of its own: a road's season is the road's, and the towns
 * around it do not change it. So this is a list and not a judgement, and the
 * judgement each town would carry is one tap away in its own panel.
 */
export const BasesSection = ({
  bases,
  hovered,
  onHover,
  onSelect,
}: {
  bases: Bases;
  hovered: Selection | null;
  onHover: (sel: Selection | null) => void;
  onSelect: (slug: string) => void;
}) => (
  <Section
    id="bases"
    info={`Orte, von denen aus diese Straße erreichbar ist – nach Nähe und danach sortiert, wie viele Pässe der Ort im gewählten Halbmonat sonst noch bietet. Jenseits von ${REACH_MAX_KM} km endet die Liste.`}
    title="Orte als Standort"
  >
    {bases.total === 0 ? (
      <p className="text-muted-foreground text-xs">
        Kein Rad-Ort im Umkreis von {REACH_MAX_KM} km.
      </p>
    ) : (
      <div className="flex flex-col gap-3">
        {bases.bands.map((g) => (
          <div key={g.band}>
            <BandHeader
              label={g.label}
              n={g.towns.length}
              maxKm={bandMax(g.band)}
              noun="Orte"
            />
            <ul className="-mx-1 flex flex-col">
              {g.towns.map((r) => (
                <TownRow
                  key={r.town.slug}
                  r={r}
                  hovered={
                    hovered?.kind === "town" && hovered.slug === r.town.slug
                  }
                  onHover={(over) =>
                    onHover(over ? { kind: "town", slug: r.town.slug } : null)
                  }
                  onSelect={() => onSelect(r.town.slug)}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    )}
  </Section>
);
