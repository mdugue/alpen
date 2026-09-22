"use client";

import type { PanelActions } from "@/components/panel/actions";
import { DestinationSection } from "@/components/panel/destination";
import { ExternalLinks, Nearby } from "@/components/panel/nearby";
import { TagBadges } from "@/components/tags";
import type { TownModel } from "@/lib/detail-model";

/**
 * What a town shows, from its model and nothing else.
 *
 * The tag labels say in two words why the town is in the list at all – a
 * planner scanning bases wants "Radsport-Mekka" or "Ruhig" before the prose.
 * What each label means, and that it is an editorial judgement rather than a
 * count, is explained once in the scales dialog.
 */
export const TownDetail = ({
  model,
  actions,
}: {
  model: TownModel;
  actions: PanelActions;
}) => {
  const { town } = model;
  return (
    <>
      <div className="mt-2">
        <TagBadges tags={town.tags} />
      </div>
      <p className="mt-2 text-xs">{town.why}</p>
      <DestinationSection
        d={model.destination}
        period={model.period}
        hovered={model.hovered}
        onHover={actions.onHover}
        onSelect={(slug) => actions.onSelect({ kind: "pass", slug })}
      />
      <Nearby
        reach={model.reach}
        hovered={model.hovered}
        onHover={actions.onHover}
        onSelect={actions.onSelect}
      />
      <ExternalLinks
        links={[
          [
            "Werkstätten (OSM)",
            `https://www.openstreetmap.org/search?query=${encodeURIComponent(`Fahrradwerkstatt ${town.name}`)}`,
          ],
          [
            "Radläden (Google)",
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`bike shop ${town.name}`)}`,
          ],
        ]}
      />
    </>
  );
};
