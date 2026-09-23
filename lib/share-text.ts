import { SITE_NAME } from "@/lib/brand";
import { LANGS, ogLocaleOf } from "@/lib/i18n";
import type { Lang, Messages } from "@/lib/i18n";
import { fill } from "@/lib/i18n/fill";
import { rangeOf } from "@/lib/regions";
import { seasonText } from "@/lib/status";
import type { Destination, Pass, Tour, Town } from "@/lib/types";
import { firstSentence, fmt, fmtUnit } from "@/lib/utils";

/**
 * The title and the description of an entity route – what a search result
 * and a link preview show (plan 02). Pure text over the data, so the page's
 * metadata, its share image and the sitemap read the same sentences. The
 * words come from `share.entity` in the message files, handed in by the
 * route that asks (`messagesOf` on the server, plan 08).
 */

/**
 * The Open Graph block of one page. Next.js replaces a parent's `openGraph`
 * rather than merging into it, so every page that sets one says all of it:
 * the site's name, its own locale and the other languages', its own URL. The
 * image comes from the route's `opengraph-image`, which Next adds by itself;
 * X reads the same tags where it finds no `twitter:` ones of its own.
 */
export const openGraphOf = (
  lang: Lang,
  page: { title: string; description?: string; url: string },
) => ({
  ...page,
  alternateLocale: LANGS.filter((l) => l !== lang).map(ogLocaleOf),
  locale: ogLocaleOf(lang),
  siteName: SITE_NAME,
  type: "website" as const,
});

/** An entity as the routes see it: its kind and the record behind it. */
export type Entity =
  | { kind: "pass"; pass: Pass }
  | { kind: "tour"; tour: Tour }
  | { kind: "town"; town: Town }
  | { kind: "destination"; destination: Destination };

/** "Col du Galibier · 2.642 m", "Sellaronda · Rundtour", "Bormio · Rad-Ort", "Oisans · Reiseziel". */
export const entityTitle = (e: Entity, w: Messages): string => {
  const t = w.share.entity;
  switch (e.kind) {
    case "pass": {
      return `${e.pass.name} · ${fmtUnit(e.pass.elevation, "m", 0, w.lang)}`;
    }
    case "tour": {
      return `${e.tour.name} · ${t.loop}`;
    }
    case "town": {
      return `${e.town.name} · ${t.town}`;
    }
    case "destination": {
      return `${e.destination.name} · ${t.destination}`;
    }
    default: {
      return e satisfies never;
    }
  }
};

/** The season sentence and the first sentence of the note; a loop its description. */
export const entityDescription = (e: Entity, w: Messages): string => {
  const t = w.share.entity;
  switch (e.kind) {
    case "pass": {
      const where = fill(t.passDescription, {
        country: e.pass.country,
        inside: w.vocab.range[rangeOf(e.pass.region)].inside,
        type: w.vocab.roadType[e.pass.type].label,
      });
      return `${where} ${seasonText(e.pass, w)} ${firstSentence(e.pass.note)}`;
    }
    case "tour": {
      const what = fill(t.loopDescription, {
        gain: fmt(e.tour.elevationGain, 0, w.lang),
        km: fmt(e.tour.km, 0, w.lang),
        passes: fmt(e.tour.passes.length, 0, w.lang),
      });
      return `${what} ${firstSentence(e.tour.description)}`;
    }
    case "town": {
      return `${fill(t.townDescription, { country: e.town.country })} ${firstSentence(e.town.why)}`;
    }
    case "destination": {
      return `${fill(t.destinationDescription, { country: e.destination.country })} ${firstSentence(e.destination.character)} ${firstSentence(e.destination.multiDay)}`;
    }
    default: {
      return e satisfies never;
    }
  }
};
