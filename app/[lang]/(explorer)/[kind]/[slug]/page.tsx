import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Weather } from "@/components/panel/weather";
import { WeatherSkeleton } from "@/components/panel/weather-forecast";
import { WeatherSlot } from "@/components/panel/weather-slot";
import { getEntity, staticParams } from "@/lib/data";
import { LANGS, langOf, OG_LOCALE } from "@/lib/i18n";
import { hrefFor, selectionOf } from "@/lib/routes";
import { entityDescription, entityTitle } from "@/lib/share-text";

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

type Params = Promise<{ kind: string; lang: string; slug: string }>;

/** The entity a path names, or nothing – which the page turns into a 404. */
const entityOf = async (params: Params) => {
  const { kind, lang: raw, slug } = await params;
  const lang = langOf(raw);
  // The params arrive decoded; the path form is what `selectionOf` reads.
  const selection = selectionOf(`/${kind}/${encodeURIComponent(slug)}`);
  if (!selection) return null;
  const entity = getEntity(selection);
  return entity ? { entity, lang, selection } : null;
};

export const generateMetadata = async ({
  params,
}: {
  params: Params;
}): Promise<Metadata> => {
  const found = await entityOf(params);
  if (!found) return {};
  const { entity, lang, selection } = found;
  const title = entityTitle(entity);
  const description = entityDescription(entity);
  const url = hrefFor(selection, lang);
  return {
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LANGS.map((l) => [l, hrefFor(selection, l)])),
        "x-default": hrefFor(selection),
      },
    },
    description,
    openGraph: {
      description,
      locale: OG_LOCALE[lang],
      title,
      type: "website",
      url,
    },
    // The site name is appended by the title template in app/layout.tsx.
    title,
    twitter: { description, title },
  };
};

const EntityPage = async ({ params }: { params: Params }) => {
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
