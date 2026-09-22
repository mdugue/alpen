"use client";

import { ExternalLink } from "lucide-react";

import { useT } from "@/components/i18n";
import type { PanelActions } from "@/components/panel/actions";
import { Section } from "@/components/panel/section";
import { StatusDot } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { EntityKind } from "@/lib/app-state";
import type { ReachingModel } from "@/lib/detail-model";
import { REACH_MAX_KM } from "@/lib/geo";
import { byDistance } from "@/lib/reach";
import { isHovered } from "@/lib/route-key";
import { cn } from "@/lib/utils";

/**
 * A named entity inside the panel. It is a link to a mark on the map, so it
 * behaves like one: pointing at it lights the mark, exactly as pointing at a
 * sidebar row does. Focus counts as pointing, so the keyboard gets it too.
 */
export const LinkButton = ({
  children,
  onClick,
  hovered,
  onHover,
}: {
  children: React.ReactNode;
  onClick: () => void;
  hovered?: boolean;
  onHover?: (over: boolean) => void;
}) => (
  <Button
    variant="link"
    size="sm"
    className={cn(
      "h-auto gap-1 rounded-sm px-0 py-0.5",
      hovered && "bg-accent/20 -mx-1 px-1",
    )}
    onClick={onClick}
    onPointerEnter={onHover && (() => onHover(true))}
    onPointerLeave={onHover && (() => onHover(false))}
    onFocus={onHover && (() => onHover(true))}
    onBlur={onHover && (() => onHover(false))}
  >
    {children}
  </Button>
);

export const ExternalLinks = ({ links }: { links: [string, string][] }) => {
  const { t } = useT();
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {links.map(([label, href]) => (
        <Button
          key={label}
          variant="outline"
          size="sm"
          render={<a href={href} target="_blank" rel="noopener noreferrer" />}
          nativeButton={false}
        >
          {label}
          <ExternalLink data-icon="inline-end" />
          <span className="sr-only">{t.panel.external.newTab}</span>
        </Button>
      ))}
    </div>
  );
};

/** One labelled row of the nearby list. */
const group = (label: string, items: React.ReactNode) => (
  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
    <span className="text-muted-foreground text-xs">{label}</span>
    {items}
  </div>
);

/**
 * What else is around here – the plain answer, deliberately not the ranked
 * one. The blocks above it judge: they group by band and order by a score
 * that weighs the season, the beauty and the nearness. This block does none
 * of that; it reads the same measurement the other way round, nearest first,
 * and names what is there.
 *
 * Which of the three lists reach it is decided in the model (`claimed` in
 * `lib/reach.ts`), so nothing here has to know what a sibling block drew –
 * which is what the two `skip*` flags used to be for.
 */
export const Nearby = ({
  model,
  actions,
}: {
  /** Read for its `reach` and its `hovered`; an area has no point to measure from. */
  model: ReachingModel;
  actions: PanelActions;
}) => {
  const { t, fmtUnit } = useT();
  const { hovered, reach } = model;
  const passes = byDistance(reach.passes);
  const tours = byDistance(reach.tours);
  const towns = byDistance(reach.towns);
  if (passes.length + tours.length + towns.length === 0) return null;

  /** The hover wiring every named entity in this block shares. */
  const link = (kind: EntityKind, slug: string) => ({
    hovered: isHovered(hovered, kind, slug),
    onClick: () => actions.onSelect({ kind, slug }),
    onHover: (over: boolean) => actions.onHover(over ? { kind, slug } : null),
  });

  return (
    <Section id="nearby" title={t.panel.nearby.title(REACH_MAX_KM)}>
      <div className="flex flex-col gap-1">
        {passes.length > 0 &&
          group(
            t.panel.nearby.passes,
            passes.map((r) => (
              <LinkButton key={r.pass.slug} {...link("pass", r.pass.slug)}>
                <StatusDot status={r.status} /> {r.pass.name}
                <span className="text-muted-foreground">
                  {fmtUnit(r.km, "km")}
                </span>
              </LinkButton>
            )),
          )}
        {tours.length > 0 &&
          group(
            t.panel.nearby.tours,
            tours.map((r) => (
              <LinkButton key={r.tour.slug} {...link("tour", r.tour.slug)}>
                <span
                  className="inline-block h-1 w-3 rounded"
                  style={{ background: r.tour.color }}
                />{" "}
                {r.tour.name}
              </LinkButton>
            )),
          )}
        {towns.length > 0 &&
          group(
            t.panel.nearby.towns,
            towns.map((r) => (
              <LinkButton key={r.town.slug} {...link("town", r.town.slug)}>
                <span
                  className="bg-town inline-block size-2 rounded-full"
                  aria-hidden
                />{" "}
                {r.town.name}
                <span className="text-muted-foreground">
                  {fmtUnit(r.km, "km")}
                </span>
              </LinkButton>
            )),
          )}
      </div>
    </Section>
  );
};
