"use client";

import type { PanelActions } from "@/components/panel/actions";
import { LinkButton, Nearby } from "@/components/panel/nearby";
import { Section } from "@/components/panel/section";
import { VerdictBox } from "@/components/panel/verdict-box";
import { StatusDot } from "@/components/status-badge";
import type { TourModel } from "@/lib/detail-model";
import { isHovered } from "@/lib/route-key";
import { fmt, fmtUnit } from "@/lib/utils";

/** What a tour shows, from its model and nothing else. */
export const TourDetail = ({
  model,
  actions,
}: {
  model: TourModel;
  actions: PanelActions;
}) => {
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
        <span className="ml-1">hm · {tour.passes.length} Pässe</span>
      </p>

      <VerdictBox
        period={model.period}
        text={model.verdict.text}
        year={model.verdict.year}
      />

      <p className="mt-4 text-xs leading-relaxed">{tour.description}</p>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        {tour.season}
      </p>

      <Section id="tour-passes" title="Pässe der Runde">
        <div className="flex flex-col items-start">
          {model.members.map(({ cell, pass }) => (
            <LinkButton
              key={pass.slug}
              hovered={isHovered(model.hovered, "pass", pass.slug)}
              onHover={(over) =>
                actions.onHover(over ? { kind: "pass", slug: pass.slug } : null)
              }
              onClick={() =>
                actions.onSelect({ kind: "pass", slug: pass.slug })
              }
            >
              <StatusDot status={cell.status} /> {pass.name}
              <span className="text-muted-foreground tabular-nums">
                {fmtUnit(pass.elevation, "m")}
              </span>
            </LinkButton>
          ))}
        </div>
      </Section>

      <Nearby actions={actions} model={model} />
    </>
  );
};
