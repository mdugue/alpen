"use client";

import { useT } from "@/components/i18n";
import type { PanelActions } from "@/components/panel/actions";
import { DestinationSection } from "@/components/panel/destination";
import { ExternalLinks, LinkButton, Nearby } from "@/components/panel/nearby";
import { TagBadges } from "@/components/tags";
import type { TownModel } from "@/lib/detail-model";
import { isHovered } from "@/lib/route-key";

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
            <LinkButton
              key={area.slug}
              hovered={isHovered(model.hovered, "destination", area.slug)}
              onHover={(over) =>
                actions.onHover(
                  over ? { kind: "destination", slug: area.slug } : null,
                )
              }
              onClick={() =>
                actions.onSelect({ kind: "destination", slug: area.slug })
              }
            >
              {area.name}
            </LinkButton>
          ))}
        </p>
      )}
      <DestinationSection
        d={model.destination}
        period={model.period}
        hovered={model.hovered}
        onHover={actions.onHover}
        onSelect={(slug) => actions.onSelect({ kind: "pass", slug })}
      />
      <Nearby actions={actions} model={model} />
      <ExternalLinks
        links={[
          [
            t.panel.town.workshops,
            `https://www.openstreetmap.org/search?query=${encodeURIComponent(t.panel.town.workshopsQuery(town.name))}`,
          ],
          [
            t.panel.town.bikeShops,
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.panel.town.bikeShopsQuery(town.name))}`,
          ],
        ]}
      />
    </>
  );
};
