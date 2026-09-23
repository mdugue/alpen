"use client";

import { useT } from "@/components/i18n";
import type { PanelActions } from "@/components/panel/actions";
import { BaseSection } from "@/components/panel/base";
import { EntityLink, ExternalLinks, Nearby } from "@/components/panel/nearby";
import { TagBadges } from "@/components/tags";
import type { TownModel } from "@/lib/detail-model";
import { bikeShopsHref, workshopsHref } from "@/lib/links";

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
  const { t } = useT();
  const { town } = model;
  return (
    <>
      <div className="mt-2">
        <TagBadges tags={town.tags} />
      </div>
      <p className="mt-2 text-xs">{town.why}</p>
      {/* The areas this town lies in – the way back up from a base to the
          holiday it belongs to; the ones that name it as a base come first. */}
      {model.areas.length > 0 && (
        <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs">
          {t.panel.town.destinationLead}
          {model.areas.map((area) => (
            <EntityLink
              key={area.slug}
              entity={{ kind: "destination", slug: area.slug }}
              hovered={model.hovered}
              actions={actions}
            >
              {area.name}
            </EntityLink>
          ))}
        </p>
      )}
      <BaseSection
        base={model.base}
        sentences={model.sentences}
        period={model.period}
        pointing={{ actions, hovered: model.hovered }}
      />
      <Nearby actions={actions} model={model} />
      <ExternalLinks
        links={[
          [t.panel.town.workshops, workshopsHref(town, t)],
          [t.panel.town.bikeShops, bikeShopsHref(town, t)],
        ]}
      />
    </>
  );
};
