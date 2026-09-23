import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Weather } from "@/components/panel/weather";
import { WeatherSkeleton } from "@/components/panel/weather-forecast";
import { WeatherSlot } from "@/components/panel/weather-slot";
import { entityAt, staticParams } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/server";
import { alternatesOf, hrefFor } from "@/lib/routes";
import { entityDescription, entityTitle, openGraphOf } from "@/lib/share-text";

/**
 * One prerendered route per entity (plan 02): `/pass/x`, `/tour/x`, `/ort/x`,
 * `/ziel/x`. The explorer around it is the layout's; what this page adds is
 * the entity's own title, description and share image – so a shared link
 * unfurls to the pass rather than to the site – and, for a pass, the
 * forecast streamed into the panel's weather block.
 *
 * The slug list is the data, so an unknown path is a 404 – `notFound()` below,
 * because Cache Components allow no `dynamicParams = false` – never an
 * empty panel.
 */
export const generateStaticParams = () => staticParams();

type Props = PageProps<"/[lang]/[kind]/[slug]">;

/** The entity a path names, in the page's language, or nothing – which the page turns into a 404. */
const entityOf = async (params: Props["params"]) => {
  const [{ kind, slug }, w] = await Promise.all([params, getDictionary()]);
  const found = entityAt(kind, slug, w.lang);
  return found && { ...found, w };
};

export const generateMetadata = async ({
  params,
}: Props): Promise<Metadata> => {
  const found = await entityOf(params);
  if (!found) return {};
  const { entity, selection, w } = found;
  const { lang } = w;
  const title = entityTitle(entity, w);
  const description = entityDescription(entity, w);
  return {
    alternates: alternatesOf(lang, (l) => hrefFor(selection, l)),
    description,
    openGraph: openGraphOf(lang, {
      description,
      title,
      url: hrefFor(selection, lang),
    }),
    // The site name is appended by the title template in app/[lang]/layout.tsx.
    title,
  };
};

const EntityPage = async ({ params }: Props) => {
  const found = await entityOf(params);
  if (!found) notFound();
  const { entity, selection } = found;
  if (entity.kind !== "pass") return null;
  return (
    <WeatherSlot slug={selection.slug}>
      <Suspense fallback={<WeatherSkeleton />}>
        <Weather pass={entity.pass} />
      </Suspense>
    </WeatherSlot>
  );
};

export default EntityPage;
