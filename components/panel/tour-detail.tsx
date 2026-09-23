"use client";

import { useT } from "@/components/i18n";
import type { PanelActions } from "@/components/panel/actions";
import { EntityLink, Nearby } from "@/components/panel/nearby";
import { Section } from "@/components/panel/section";
import { VerdictBox } from "@/components/panel/verdict-box";
import { StatusDot } from "@/components/status-badge";
import type { TourModel } from "@/lib/detail-model";
import { fill } from "@/lib/i18n/fill";

/** What a tour shows, from its model and nothing else. */
export const TourDetail = ({
  model,
  actions,
}: {
  model: TourModel;
  actions: PanelActions;
}) => {
  const { t, fmt, fmtUnit } = useT();
  const { tour } = model;
  return (
    <>
      <p className="text-muted-foreground mt-0.5 text-xs">
        <span className="text-foreground text-2xl leading-none font-bold tabular-nums">
          {fmt(tour.km)}
        </span>
        <span className="ml-1">km · </span>
        <span className="text-foreground text-2xl leading-none font-bold tabular-nums">
          {fmt(tour.elevationGain)}
        </span>
        <span className="ml-1">
          {t.vocab.unit.climb} ·{" "}
          {fill(t.panel.tour.passCount, { n: fmt(tour.passes.length) })}
        </span>
      </p>

      <VerdictBox
        period={model.period}
        text={model.verdict.text}
        year={model.verdict.year}
      />

      <p className="mt-4 text-xs leading-relaxed">{tour.description}</p>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        {model.season}
      </p>

      <Section id="tour-passes" title={t.panel.tour.passesTitle}>
        <div className="flex flex-col items-start">
          {model.members.map(({ cell, pass }) => (
            <EntityLink
              key={pass.slug}
              entity={{ kind: "pass", slug: pass.slug }}
              hovered={model.hovered}
              actions={actions}
            >
              <StatusDot status={cell.status} /> {pass.name}
              <span className="text-muted-foreground tabular-nums">
                {fmtUnit(pass.elevation, "m")}
              </span>
            </EntityLink>
          ))}
        </div>
      </Section>

      <Nearby actions={actions} model={model} />
    </>
  );
};
