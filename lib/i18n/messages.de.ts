import { map } from "./de/map";
import { panel } from "./de/panel";
import { scales } from "./de/scales";
import { sidebar } from "./de/sidebar";
import { status } from "./de/status";
import { vocab } from "./de/vocab";

/**
 * Every word the interface says, in German – the source of truth. The
 * English file satisfies this file's type, so a key that exists in one and
 * not the other is a type error, never a blank on screen (plan 08).
 *
 * What belongs here: the chrome – tabs, buttons, labels, the headings of
 * the panel blocks, the sentences the code composes. What does not: the
 * curated prose (that is `data/i18n/<lang>/*.json`, merged in `lib/data.ts`)
 * and proper names.
 *
 * Interpolations are plain functions, so a sentence can change its shape
 * between languages instead of pasting numbers into a fixed frame.
 */
export const de = {
  header: {
    dataLine: "Klima 2015–2024 · Prognose 7 Tage",
    hideSidebar: "Seitenleiste ausblenden",
    listAndFilters: "Liste und Filter",
    noPass: "kein Pass in dieser Auswahl.",
    scales: "Skalen & Quellen",
    skipToMap: "Zur Karte springen",
    switchTo: "English version",
  },
  kinds: {
    destination: "Reiseziele",
    pass: "Straßen",
    tour: "Touren",
    town: "Orte",
  },
  legal: {
    englishNote: null as string | null,
  },
  map,
  panel,
  scales,
  share: {
    /** The three counts under the wordmark of the share image. */
    counts: (passes: string, tours: string, towns: string) =>
      `${passes} Pässe · ${tours} Touren · ${towns} Orte`,
    headline: "Welche Region lohnt sich wann?",
  },
  sidebar,
  status,
  vocab,
};

export type Messages = typeof de;
