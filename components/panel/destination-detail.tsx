"use client";

import { useT } from "@/components/i18n";
import type { PanelActions } from "@/components/panel/actions";
import { GradeBar } from "@/components/panel/destination";
import { ExternalLinks, LinkButton } from "@/components/panel/nearby";
import { Section } from "@/components/panel/section";
import { VerdictBox } from "@/components/panel/verdict-box";
import { Rating } from "@/components/rating";
import { SeasonStrip } from "@/components/season-strip";
import { StatusDot } from "@/components/status-badge";
import { TagLine } from "@/components/tags";
import type { DestinationModel } from "@/lib/detail-model";
import { isHovered } from "@/lib/route-key";
import { bestText } from "@/lib/status";

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
  const { t, lang, fmt, fmtUnit } = useT();
  const { destination: d, verdict } = model;
  return (
    <>
      <p className="mt-2 text-xs leading-relaxed">{d.character}</p>

      <VerdictBox
        bar={
          <GradeBar
            counts={verdict.counts}
            total={verdict.total}
            text={model.text}
          />
        }
        best={bestText(verdict.year, lang)}
        period={model.period}
        text={model.text}
        year={verdict.year}
      >
        <p className="text-muted-foreground text-2xs">
          {t.panel.destination.derived(fmt(verdict.total))}
          {verdict.peak > 0 &&
            t.panel.destination.derivedPeak(fmt(verdict.peak))}
          .
        </p>
      </VerdictBox>

      <Section
        id="area-passes"
        info={t.panel.destination.roadsInfo(fmt(d.radiusKm))}
        title={t.panel.destination.roadsTitle}
      >
        {model.passes.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {t.panel.destination.roadsNone}
          </p>
        ) : (
          <ul className="-mx-1 flex flex-col">
            {model.passes.map(({ cell, pass, season }) => (
              <li key={pass.slug}>
                <button
                  type="button"
                  onClick={() =>
                    actions.onSelect({ kind: "pass", slug: pass.slug })
                  }
                  onPointerEnter={() =>
                    actions.onHover({ kind: "pass", slug: pass.slug })
                  }
                  onPointerLeave={() => actions.onHover(null)}
                  onFocus={() =>
                    actions.onHover({ kind: "pass", slug: pass.slug })
                  }
                  onBlur={() => actions.onHover(null)}
                  className={`focus-visible:inset-ring-ring/50 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-sm px-1 py-1 text-left outline-none focus-visible:inset-ring-2 ${isHovered(model.hovered, "pass", pass.slug) ? "bg-accent/15" : "hover:bg-muted/60"}`}
                >
                  <StatusDot status={cell.status} />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">
                      {pass.name}
                    </span>
                    <span className="text-muted-foreground text-2xs flex items-center gap-1.5">
                      <Rating value={pass.beauty} className="[&>span]:h-1.5" />
                      {fmtUnit(pass.elevation, "m")}
                      <span className="truncate">· {pass.classicAscent}</span>
                    </span>
                  </span>
                  <SeasonStrip
                    cells={season}
                    current={model.period}
                    className="w-16"
                  />
                </button>
              </li>
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
              <LinkButton
                key={tour.slug}
                hovered={isHovered(model.hovered, "tour", tour.slug)}
                onHover={(over) =>
                  actions.onHover(
                    over ? { kind: "tour", slug: tour.slug } : null,
                  )
                }
                onClick={() =>
                  actions.onSelect({ kind: "tour", slug: tour.slug })
                }
              >
                <StatusDot status={cell.status} /> {tour.name}
                <span className="text-muted-foreground tabular-nums">
                  {fmtUnit(tour.km, "km")} · {fmtUnit(tour.elevationGain, "hm")}
                </span>
              </LinkButton>
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
                  <LinkButton
                    hovered={isHovered(model.hovered, "town", town.slug)}
                    onHover={(over) =>
                      actions.onHover(
                        over ? { kind: "town", slug: town.slug } : null,
                      )
                    }
                    onClick={() =>
                      actions.onSelect({ kind: "town", slug: town.slug })
                    }
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
                  </LinkButton>
                  <TagLine tags={town.tags} lead={town.country} />
                  {base && (
                    <ExternalLinks
                      links={[
                        [
                          t.panel.destination.lodging,
                          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.panel.destination.lodgingQuery(town.name))}`,
                        ],
                        [
                          t.panel.town.workshops,
                          `https://www.openstreetmap.org/search?query=${encodeURIComponent(t.panel.town.workshopsQuery(town.name))}`,
                        ],
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
