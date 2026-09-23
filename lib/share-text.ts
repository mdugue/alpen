import type { Messages } from "@/lib/i18n";
import { fill } from "@/lib/i18n/fill";
import { rangeOf } from "@/lib/regions";
import { seasonText } from "@/lib/status";
import type { Destination, Pass, Tour, Town } from "@/lib/types";
import { fmt, fmtUnit } from "@/lib/utils";

/**
 * The title and the description of an entity route – what a search result
 * and a link preview show (plan 02). Pure text over the data, so the page's
 * metadata, its share image and the sitemap read the same sentences. The
 * words come from `share.entity` in the message files, handed in by the
 * route that asks (`messagesOf` on the server, plan 08).
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
