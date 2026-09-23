"use client";

import { ExternalLink } from "lucide-react";

import { useT } from "@/components/i18n";
import { pointerProps } from "@/components/panel/actions";
import type { PanelActions } from "@/components/panel/actions";
import { Section } from "@/components/panel/section";
import { StatusDot } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { EntityKind, Selection } from "@/lib/app-state";
import type { ReachingModel } from "@/lib/detail-model";
import { REACH_MAX_KM } from "@/lib/geo";
import { fill } from "@/lib/i18n/fill";
import { byDistance } from "@/lib/reach";
import { isHovered } from "@/lib/route-key";
import { cn } from "@/lib/utils";

/** A named entity inside the panel, as a link to its own panel (`pointerProps`). */
export const EntityLink = ({
  entity,
  hovered,
  actions,
  children,
}: {
  entity: Selection;
  /** What the pointer is over anywhere on screen (`DetailModel.hovered`). */
  hovered: Selection | null;
  actions: PanelActions;
  children: React.ReactNode;
}) => (
  <Button
    variant="link"
    size="sm"
    className={cn(
      "h-auto gap-1 rounded-sm px-0 py-0.5",
      isHovered(hovered, entity.kind, entity.slug) && "bg-accent/20 -mx-1 px-1",
    )}
    {...pointerProps(entity, actions)}
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

  /** What every named entity in this block links with. */
  const link = (kind: EntityKind, slug: string) => ({
    actions,
    entity: { kind, slug },
    hovered,
  });

  return (
    <Section
      id="nearby"
      title={fill(t.panel.nearby.title, { km: REACH_MAX_KM })}
    >
      <div className="flex flex-col gap-1">
        {passes.length > 0 &&
          group(
            t.panel.nearby.passes,
            passes.map((r) => (
              <EntityLink key={r.pass.slug} {...link("pass", r.pass.slug)}>
                <StatusDot status={r.status} /> {r.pass.name}
                <span className="text-muted-foreground">
                  {fmtUnit(r.km, "km")}
                </span>
              </EntityLink>
            )),
          )}
        {tours.length > 0 &&
          group(
            t.panel.nearby.tours,
            tours.map((r) => (
              <EntityLink key={r.tour.slug} {...link("tour", r.tour.slug)}>
                <span
                  className="inline-block h-1 w-3 rounded"
                  style={{ background: r.tour.color }}
                />{" "}
                {r.tour.name}
              </EntityLink>
            )),
          )}
        {towns.length > 0 &&
          group(
            t.panel.nearby.towns,
            towns.map((r) => (
              <EntityLink key={r.town.slug} {...link("town", r.town.slug)}>
                <span
                  className="bg-town inline-block size-2 rounded-full"
                  aria-hidden
                />{" "}
                {r.town.name}
                <span className="text-muted-foreground">
                  {fmtUnit(r.km, "km")}
                </span>
              </EntityLink>
            )),
          )}
      </div>
    </Section>
  );
};
