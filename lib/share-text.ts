import { DEFAULT_LANG, messagesOf, vocabOf } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { rangeOf } from "@/lib/regions";
import { seasonText } from "@/lib/status";
import type { Destination, Pass, Tour, Town } from "@/lib/types";
import { fmt, fmtUnit } from "@/lib/utils";

/**
 * The title and the description of an entity route – what a search result
 * and a link preview show (plan 02). Pure text over the data, so the page's
 * metadata, its share image and the sitemap read the same sentences. The
 * words come from `share.entity` in the message files; the language is an
 * argument, German by default, because this runs on the server for a
 * route's metadata where there is no provider to read it from (plan 08).
 */

/** An entity as the routes see it: its kind and the record behind it. */
export type Entity =
  | { kind: "pass"; pass: Pass }
  | { kind: "tour"; tour: Tour }
  | { kind: "town"; town: Town }
  | { kind: "destination"; destination: Destination };

/** The first sentence of a note, for a description that must stay short. */
const firstSentence = (text: string): string => {
  const m = /^.*?[.!?](?=\s|$)/su.exec(text.trim());
  return m ? m[0] : text.trim();
};

export const entityName = (e: Entity): string => {
  switch (e.kind) {
    case "pass": {
      return e.pass.name;
    }
    case "tour": {
      return e.tour.name;
    }
    case "town": {
      return e.town.name;
    }
    case "destination": {
      return e.destination.name;
    }
    default: {
      return e satisfies never;
    }
  }
};

/** "Col du Galibier · 2.642 m", "Sellaronda · Rundtour", "Bormio · Rad-Ort", "Oisans · Reiseziel". */
export const entityTitle = (e: Entity, lang: Lang = DEFAULT_LANG): string => {
  const t = messagesOf(lang).share.entity;
  switch (e.kind) {
    case "pass": {
      return `${e.pass.name} · ${fmtUnit(e.pass.elevation, "m", 0, lang)}`;
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
export const entityDescription = (
  e: Entity,
  lang: Lang = DEFAULT_LANG,
): string => {
  const t = messagesOf(lang).share.entity;
  const v = vocabOf(lang);
  switch (e.kind) {
    case "pass": {
      const where = t.passDescription(
        v.roadType[e.pass.type].label,
        v.range[rangeOf(e.pass.region)].inside,
        e.pass.country,
      );
      return `${where} ${seasonText(e.pass, lang)} ${firstSentence(e.pass.note)}`;
    }
    case "tour": {
      const what = t.loopDescription(
        fmt(e.tour.km, 0, lang),
        fmt(e.tour.elevationGain, 0, lang),
        fmt(e.tour.passes.length, 0, lang),
      );
      return `${what} ${firstSentence(e.tour.description)}`;
    }
    case "town": {
      return `${t.townDescription(e.town.country)} ${firstSentence(e.town.why)}`;
    }
    case "destination": {
      return `${t.destinationDescription(e.destination.country)} ${firstSentence(e.destination.character)} ${firstSentence(e.destination.multiDay)}`;
    }
    default: {
      return e satisfies never;
    }
  }
};
