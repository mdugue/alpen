"use client";

import { Fragment } from "react";

import { GradeLegend } from "@/components/grade-legend";
import { useT } from "@/components/i18n";
import { SeasonBandLegend } from "@/components/season-band";
import { TagIcon } from "@/components/tags";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RIDEABLE_BEST_SHARE,
  RIDEABLE_GOOD_SHARE,
  RISKY_WEIGHT,
} from "@/lib/destination";
import { REACH_BANDS, REACH_MAX_KM } from "@/lib/geo";
import { vocabOf } from "@/lib/i18n";
import { ROAD_TAGS, ROAD_TYPES, SURFACES, TOWN_TAGS } from "@/lib/regions";
import type { RangeName, TagName } from "@/lib/regions";
import { ladderText, lapseText, VALLEY_TMAX_ERROR } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * The three marks a paragraph of the dialog may carry (`lib/i18n/de/scales.ts`):
 * `**bold**`, `_italic_` and `` `code` ``. A message is a string, so the
 * emphasis travels inside it and the two languages can place it differently;
 * this turns the marks back into elements. Nothing else is markup.
 */
const rich = (text: string) => {
  const parts: { at: number; part: string }[] = [];
  let at = 0;
  for (const part of text.split(/(?<mark>\*\*.+?\*\*|`.+?`|_.+?_)/u)) {
    if (part) parts.push({ at, part });
    at += part.length;
  }
  // Keyed by where each part starts in the text: unique, and stable for as
  // long as the text is.
  return parts.map(({ at: key, part }) => {
    if (part.startsWith("**")) return <b key={key}>{part.slice(2, -2)}</b>;
    if (part.startsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith("_")) return <i key={key}>{part.slice(1, -1)}</i>;
    return <Fragment key={key}>{part}</Fragment>;
  });
};

const Section = ({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-2">
    <h3 className="text-base font-semibold">{heading}</h3>
    {children}
  </section>
);

const P = ({ children }: { children: string }) => (
  <p className="text-muted-foreground">{rich(children)}</p>
);

/** A term and its explanation, in the two-column list every section uses. */
const Terms = ({
  items,
  className,
}: {
  items: { key: string; term: React.ReactNode; text: string }[];
  className?: string;
}) => (
  <dl className={cn("grid grid-cols-[auto_1fr] gap-x-4 gap-y-2", className)}>
    {items.map(({ key, term, text }) => (
      <div key={key} className="contents">
        <dt className="font-semibold">{term}</dt>
        <dd className="text-muted-foreground">{text}</dd>
      </div>
    ))}
  </dl>
);

/** A label with its tag icon in front, for the town and road features. */
const Tagged = ({ tag, label }: { tag: TagName; label: string }) => (
  <span className="flex items-center gap-1.5">
    <TagIcon tag={tag} className="size-4" />
    {label}
  </span>
);

export const ScalesDialog = ({
  open,
  onOpenChange,
  ranges,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /**
   * The ranges the data holds a road for. The section that explains them
   * shows only once there are two: a dialog that names the Vosges' roads
   * while the map cannot show one would promise what the data does not
   * hold (Principle 3) – the same reason the brand line waits.
   */
  ranges: readonly RangeName[];
}) => {
  const { t, lang, fmt } = useT();
  const s = t.scales;
  const v = vocabOf(lang);
  /** A share as a percentage in the page's locale: 0.8 -> "80 %". */
  const pct = (x: number) => `${fmt(x * 100)} %`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.header.scales}</DialogTitle>
          <DialogDescription>{s.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 text-sm">
          <Section heading={s.ratings.heading}>
            <P>{s.ratings.intro}</P>
            <Terms
              items={s.ratings.items.map(([term, text]) => ({
                key: term,
                term,
                text,
              }))}
            />
          </Section>
          <Section heading={s.towns.heading}>
            <P>{s.towns.intro}</P>
            <Terms
              items={TOWN_TAGS.map((tag) => ({
                key: tag,
                term: <Tagged tag={tag} label={v.townTag[tag].label} />,
                text: v.townTag[tag].hint,
              }))}
            />
          </Section>
          {ranges.length > 1 && (
            <Section heading={s.ranges.heading}>
              <P>{s.ranges.intro}</P>
              <Terms
                items={ranges.map((range) => ({
                  key: range,
                  term: v.range[range].label,
                  text: v.range[range].hint,
                }))}
              />
            </Section>
          )}
          <Section heading={s.types.heading}>
            <P>{s.types.intro}</P>
            <Terms
              items={[
                ...ROAD_TYPES.map((type) => ({
                  key: type,
                  term: v.roadType[type].label,
                  text: v.roadType[type].hint,
                })),
                ...ROAD_TAGS.map((tag) => ({
                  key: tag,
                  term: <Tagged tag={tag} label={v.roadTag[tag].label} />,
                  text: v.roadTag[tag].hint,
                })),
              ]}
            />
          </Section>
          <Section heading={s.surface.heading}>
            <P>{s.surface.intro}</P>
            <Terms
              className="gap-x-3 gap-y-1"
              items={SURFACES.map((x) => ({
                key: x,
                term: v.surface[x].label,
                text: v.surface[x].hint,
              }))}
            />
          </Section>
          <Section heading={s.status.heading}>
            <P>{s.status.intro}</P>
            {/* Generated from SIGNALS and the reason ladder in lib/status.ts, so
                a changed threshold reaches the paragraph that explains it. */}
            <P>{s.status.ladder(ladderText(lang))}</P>
            <P>{s.status.derived(lapseText(lang), fmt(VALLEY_TMAX_ERROR))}</P>
            <P>{s.status.strip}</P>
            {/* The same legend the season bar shows, from GRADE_ORDER. */}
            <GradeLegend className="text-muted-foreground text-xs" />
          </Section>
          <Section heading={s.band.heading}>
            <P>{s.band.intro}</P>
            <SeasonBandLegend className="text-muted-foreground text-xs" />
          </Section>
          <Section heading={s.townsAsBase.heading}>
            <P>{s.townsAsBase.intro}</P>
            <P>
              {s.townsAsBase.bands(
                REACH_BANDS.map((b) =>
                  s.townsAsBase.bandItem(v.band[b.key].label, fmt(b.maxKm)),
                ).join(", "),
                fmt(REACH_MAX_KM),
              )}
            </P>
            <P>
              {s.townsAsBase.stripMeasures(
                pct(RIDEABLE_BEST_SHARE),
                pct(RIDEABLE_GOOD_SHARE),
              )}
            </P>
          </Section>
          <Section heading={s.destinations.heading}>
            <P>{s.destinations.intro}</P>
            <P>{s.destinations.order(fmt(RISKY_WEIGHT * 100))}</P>
          </Section>
          <Section heading={s.symbols.heading}>
            <P>{s.symbols.text}</P>
          </Section>
          <Section heading={s.data.heading}>
            <P>{s.data.text}</P>
          </Section>
          <Section heading={s.notes.heading}>
            <P>{s.notes.text}</P>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
