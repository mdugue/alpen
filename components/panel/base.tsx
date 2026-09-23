"use client";

import { useT } from "@/components/i18n";
import { pointerProps } from "@/components/panel/actions";
import type { PanelActions } from "@/components/panel/actions";
import { Section } from "@/components/panel/section";
import { VerdictBox } from "@/components/panel/verdict-box";
import { Rating } from "@/components/rating";
import { SeasonStrip } from "@/components/season-strip";
import { StatusDot } from "@/components/status-badge";
import type { Selection } from "@/lib/app-state";
import type { Bases, BaseVerdict, DerivedVerdict } from "@/lib/destination";
import type { DerivedText } from "@/lib/detail-model";
import { REACH_MAX_KM } from "@/lib/geo";
import type { ReachBand } from "@/lib/geo";
import { fill } from "@/lib/i18n/fill";
import type { Band, GradeCount, ReachedTown } from "@/lib/reach";
import { isHovered } from "@/lib/route-key";
import { GRADE_ORDER } from "@/lib/status";
import type { Grade, YearCell } from "@/lib/status";
import type { Pass, Period, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The strip's own ramp, so the bar and the 24 cells say the same thing. */
const GRADE_FILL: Record<Grade, string> = {
  best: "bg-grade-best",
  closed: "bg-muted-foreground/25",
  good: "bg-grade-good",
  limited: "bg-grade-limited",
};

/**
 * How the counted passes fall across the four grades, as one bar. The same
 * stack the period scrubber draws behind its 24 half-months, for one
 * half-month and one base or area – so the two read as one picture and a
 * visitor who has understood the scrubber has already understood this.
 */
export const GradeBar = ({
  counts,
  total,
  text,
}: {
  counts: GradeCount;
  total: number;
  /** What the bar says to a screen reader: the sentence beside it. */
  text: string;
}) => {
  if (total === 0) return null;
  return (
    <div
      className="bg-muted flex h-2.5 w-full overflow-hidden rounded-full"
      role="img"
      aria-label={text}
    >
      {GRADE_ORDER.map((g) => {
        const n = counts[g];
        if (n === 0) return null;
        return (
          <span
            key={g}
            className={GRADE_FILL[g]}
            style={{ width: `${(n / total) * 100}%` }}
          />
        );
      })}
    </div>
  );
};

const ROW =
  "focus-visible:inset-ring-ring/50 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-sm px-1 py-1 text-left outline-none focus-visible:inset-ring-2";

/** What a row of the panel's lists needs to light its mark and open it. */
interface Pointing {
  /** What the pointer is over anywhere on screen; one highlight for all of them. */
  hovered: Selection | null;
  actions: PanelActions;
}

/** A row's button: the pointer wiring and the hover tint. */
const rowButton = (entity: Selection, { hovered, actions }: Pointing) => ({
  ...pointerProps(entity, actions),
  className: cn(
    ROW,
    isHovered(hovered, entity.kind, entity.slug)
      ? "bg-accent/15"
      : "hover:bg-muted/60",
  ),
});

/**
 * One road of a list – what a base reaches, what an area holds. Everything a
 * place is judged on is in the row – the status now, the beauty, the height
 * and the whole year – because the question these lists answer is "is this a
 * good place to stay", and a name with a distance next to it cannot answer
 * it. The distance, where there is one, is still there and still exact; it
 * has simply stopped being the only thing said.
 */
export const RoadRow = ({
  pass,
  status,
  season,
  period,
  km,
  note,
  pointing,
}: {
  pass: Pass;
  status: Status;
  season: YearCell[];
  period: Period;
  /** How far the road is from the base; an area's own roads have none. */
  km?: number;
  /** A word after the height: the classic ascent, in an area's list. */
  note?: string;
  pointing: Pointing;
}) => {
  const { fmtUnit } = useT();
  return (
    <li>
      <button
        type="button"
        {...rowButton({ kind: "pass", slug: pass.slug }, pointing)}
      >
        <StatusDot status={status} />
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium">
            {pass.name}
          </span>
          <span className="text-muted-foreground text-2xs flex items-center gap-1.5">
            <Rating value={pass.beauty} className="[&>span]:h-1.5" />
            {fmtUnit(pass.elevation, "m")}
            {note && <span className="truncate">· {note}</span>}
          </span>
        </span>
        <span className="flex flex-col items-end gap-0.5">
          {km !== undefined && (
            <span className="text-muted-foreground text-2xs tabular-nums">
              {fmtUnit(km, "km")}
            </span>
          )}
          <SeasonStrip cells={season} current={period} className="w-16" />
        </span>
      </button>
    </li>
  );
};

/**
 * One town as a candidate base. The count is the whole point of the row: the
 * nearest village is not automatically the best place to sleep, and "12 von
 * 33 Pässen gut" is what tells the two apart.
 */
const TownRow = ({ r, pointing }: { r: ReachedTown; pointing: Pointing }) => {
  const { t, fmt, fmtUnit } = useT();
  return (
    <li>
      <button
        type="button"
        {...rowButton({ kind: "town", slug: r.town.slug }, pointing)}
      >
        <span className="bg-town size-2.5 shrink-0 rounded-full" aria-hidden />
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium">
            {r.town.name}
          </span>
          <span className="text-muted-foreground text-2xs">
            {r.town.country} ·{" "}
            {r.total === 0
              ? t.panel.base.townNone
              : fill(t.panel.base.townLine, {
                  rideable: fmt(r.rideable),
                  total: fmt(r.total),
                })}
          </span>
        </span>
        <span className="text-muted-foreground text-2xs tabular-nums">
          {fmtUnit(r.km, "km")}
        </span>
      </button>
    </li>
  );
};

/** "VOR DER HAUSTÜR · 5 Pässe bis 18 km" – the same header for both lists. */
const BandHeader = ({
  band,
  n,
  maxKm,
  noun,
}: {
  band: ReachBand;
  n: number;
  maxKm: number;
  noun: string;
}) => {
  const { t, fmt, fmtUnit } = useT();
  return (
    <p className="text-muted-foreground text-2xs mb-0.5 flex items-baseline gap-1.5 font-semibold tracking-widest uppercase">
      {t.vocab.band[band].label}
      <span className="font-normal tracking-normal normal-case">
        {fill(t.panel.base.bandCount, {
          maxKm: fmtUnit(maxKm, "km"),
          n: fmt(n),
          noun,
        })}
      </span>
    </p>
  );
};

/**
 * The banded list both blocks draw – a function, the way `group` is one in
 * `nearby.tsx`, because the two are the same picture read in opposite
 * directions and while they stood side by side as two copies they drifted a
 * class at a time. What differs is the noun in the header and what one row is.
 */
const bandList = <T,>(
  bands: Band<T>[],
  noun: string,
  row: (item: T) => React.ReactNode,
) => (
  <div className="flex flex-col gap-3">
    {bands.map((g) => (
      <div key={g.band}>
        <BandHeader
          band={g.band}
          maxKm={g.maxKm}
          n={g.items.length}
          noun={noun}
        />
        <ul className="-mx-1 flex flex-col">{g.items.map(row)}</ul>
      </div>
    ))}
  </div>
);

/**
 * The verdict of a derived year – a base's or an area's – with the grade bar
 * and the line that says what it was derived from. The 24 cells are the
 * place's own – derived from the roads, never measured – and the label says
 * so, with every road's own strip visible in the rows underneath so the
 * derivation can be checked by eye (Principle 3).
 */
export const DerivedVerdictBox = ({
  verdict,
  sentences,
  period,
}: {
  verdict: DerivedVerdict;
  sentences: DerivedText;
  period: Period;
}) => (
  <VerdictBox
    bar={
      <GradeBar
        counts={verdict.counts}
        total={verdict.total}
        text={sentences.text}
      />
    }
    best={sentences.best}
    period={period}
    text={sentences.text}
    year={verdict.year}
  >
    <p className="text-muted-foreground text-2xs">{sentences.derived}</p>
  </VerdictBox>
);

/**
 * A base, judged for the chosen half-month.
 *
 * The block leads with a verdict and its reason, exactly as the pass panel
 * does, and only then lists what the verdict was made of.
 *
 * The list is grouped by reach band rather than cut at a radius, and ordered
 * inside each band by a score that weights nearness smoothly (see
 * `lib/geo.ts`): the bands are what is read, the weight is what ranks.
 */
export const BaseSection = ({
  base,
  sentences,
  period,
  pointing,
}: {
  base: BaseVerdict;
  sentences: DerivedText;
  period: Period;
  pointing: Pointing;
}) => {
  const { t } = useT();
  return (
    <>
      <DerivedVerdictBox verdict={base} sentences={sentences} period={period} />

      <Section
        id="base-passes"
        info={fill(t.panel.base.passesInfo, { km: REACH_MAX_KM })}
        title={t.panel.base.passesTitle}
      >
        {base.total === 0 ? (
          <p className="text-muted-foreground text-xs">
            {fill(t.vocab.reach.noneWithin, { km: REACH_MAX_KM })}
          </p>
        ) : (
          bandList(base.bands, t.panel.base.passes, (r) => (
            <RoadRow
              key={r.pass.slug}
              pass={r.pass}
              status={r.status}
              season={r.season}
              km={r.km}
              period={period}
              pointing={pointing}
            />
          ))
        )}
      </Section>
    </>
  );
};

/**
 * The inverse block: which towns this road could be ridden from.
 *
 * It is the same picture as `BaseSection` read the other way round, so
 * it uses the same bands, the same nearness weight and the same row shape –
 * a planner who has understood one has understood the other. What it does not
 * have is a verdict of its own: a road's season is the road's, and the towns
 * around it do not change it. So this is a list and not a judgement, and the
 * judgement each town would carry is one tap away in its own panel.
 */
export const BasesSection = ({
  bases,
  pointing,
}: {
  bases: Bases;
  pointing: Pointing;
}) => {
  const { t } = useT();
  return (
    <Section
      id="bases"
      info={fill(t.panel.base.basesInfo, { km: REACH_MAX_KM })}
      title={t.panel.base.basesTitle}
    >
      {bases.total === 0 ? (
        <p className="text-muted-foreground text-xs">
          {fill(t.panel.base.basesNone, { km: REACH_MAX_KM })}
        </p>
      ) : (
        bandList(bases.bands, t.panel.base.towns, (r) => (
          <TownRow key={r.town.slug} r={r} pointing={pointing} />
        ))
      )}
    </Section>
  );
};
