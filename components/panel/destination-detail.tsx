"use client";

import { useT } from "@/components/i18n";
import type { PanelActions } from "@/components/panel/actions";
import { DerivedVerdictBox, RoadRow } from "@/components/panel/base";
import { EntityLink, ExternalLinks } from "@/components/panel/nearby";
import { Section } from "@/components/panel/section";
import { StatusDot } from "@/components/status-badge";
import { TagLine } from "@/components/tags";
import type { DestinationModel } from "@/lib/detail-model";
import { fill } from "@/lib/i18n/fill";
import { lodgingHref, workshopsHref } from "@/lib/links";

/**
 * What a destination shows, from its model and nothing else: the verdict of
 * the half-month with the year under it, the area's own two sentences, then
 * what it holds – roads, loops, towns – and how one gets there. Every list
 * links to the entity's own panel; the "where to stay" answer is the towns
 * block with a lodging search per base, a plain map search and no affiliate
 * (docs/plans/12-destinations.md).
 */
export const DestinationDetail = ({
  model,
  actions,
}: {
  model: DestinationModel;
  actions: PanelActions;
}) => {
  const { t, fmt, fmtUnit } = useT();
  const { destination: d } = model;
  const pointing = { actions, hovered: model.hovered };
  return (
    <>
      <p className="mt-2 text-xs leading-relaxed">{d.character}</p>

      <DerivedVerdictBox
        verdict={model.verdict}
        sentences={model.sentences}
        period={model.period}
      />

      <Section
        id="area-passes"
        info={fill(t.panel.destination.roadsInfo, { km: fmt(d.radiusKm) })}
        title={t.panel.destination.roadsTitle}
      >
        {model.passes.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {t.panel.destination.roadsNone}
          </p>
        ) : (
          <ul className="-mx-1 flex flex-col">
            {model.passes.map(({ cell, pass, season }) => (
              <RoadRow
                key={pass.slug}
                pass={pass}
                status={cell.status}
                season={season}
                note={pass.classicAscent}
                period={model.period}
                pointing={pointing}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section id="area-tours" title={t.panel.destination.toursTitle}>
        {model.tours.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {t.panel.destination.toursNone}
          </p>
        ) : (
          <div className="flex flex-col items-start">
            {model.tours.map(({ cell, tour }) => (
              <EntityLink
                key={tour.slug}
                entity={{ kind: "tour", slug: tour.slug }}
                {...pointing}
              >
                <StatusDot status={cell.status} /> {tour.name}
                <span className="text-muted-foreground tabular-nums">
                  {fmtUnit(tour.km, "km")} ·{" "}
                  {fmtUnit(tour.elevationGain, t.vocab.unit.climb)}
                </span>
              </EntityLink>
            ))}
          </div>
        )}
      </Section>

      <Section
        id="area-towns"
        info={t.panel.destination.townsInfo}
        title={t.panel.destination.townsTitle}
      >
        {model.towns.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {t.panel.destination.townsNone}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {model.towns.map((town) => {
              const base = d.baseTowns.includes(town.slug);
              return (
                <li key={town.slug} className="flex flex-col gap-0.5">
                  <EntityLink
                    entity={{ kind: "town", slug: town.slug }}
                    {...pointing}
                  >
                    <span
                      className="bg-town size-2.5 shrink-0 rounded-full"
                      aria-hidden
                    />
                    {town.name}
                    {base && (
                      <span className="text-muted-foreground">
                        · {t.panel.destination.baseMark}
                      </span>
                    )}
                  </EntityLink>
                  <TagLine tags={town.tags} lead={town.country} />
                  {base && (
                    <ExternalLinks
                      links={[
                        [t.panel.destination.lodging, lodgingHref(town, t)],
                        [t.panel.town.workshops, workshopsHref(town, t)],
                      ]}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section id="area-travel" title={t.panel.destination.travelTitle}>
        <p className="text-xs leading-relaxed">{d.multiDay}</p>
        <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
          {d.access}
        </p>
        {d.note && (
          <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
            {d.note}
          </p>
        )}
      </Section>
    </>
  );
};
