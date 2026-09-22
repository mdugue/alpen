import { SITE_DESCRIPTION, SITE_TAGLINE, SITE_TITLE } from "@/lib/brand";

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
  /** The season band: the summary line, the legend, the slider and the two ways into the drawers. */
  band: {
    backToToday: (label: string) => `Zurück zu heute (${label})`,
    daylight: (hours: string) => `${hours} h Tageslicht`,
    /** The second button under the band on a phone; the first is the list's kind. */
    filters: "Filter",
    legend: {
      bar: "Balkenhöhe = Ø Tagesmaximum der gezeigten Pässe",
      ribbon: "Band = Befahrbarkeit der meisten von ihnen",
      snow: "Hängebalken = Anteil Tage mit Schneefall",
    },
    /** What a screen reader hears for a column: "meist gut". */
    mostly: (grade: string) => `meist ${grade}`,
    noPass: "kein Pass in dieser Auswahl",
    period: "Zeitraum",
    snow: (pct: string) => `${pct} % Schnee`,
    today: (label: string) => `heute: ${label}`,
    wet: (pct: string) => `${pct} % nass`,
    whatBarsMean: "Was die Balken bedeuten",
  },
  /** The header bar, and the shell's landmarks and drawers around it. */
  header: {
    /** The swipe handle of a drawer: "Liste einklappen". */
    collapse: (label: string) => `${label} einklappen`,
    /** The headline's four counts, joined with commas. */
    counts: {
      best: (n: string) => `${n} Pässe in bester Zeit`,
      closed: (n: string) => `${n} oft gesperrt`,
      good: (n: string) => `${n} gut`,
      limited: (n: string) => `${n} eingeschränkt`,
    },
    dataLine: "Klima 2015–2024 · Prognose 7 Tage",
    /** The detail panel's landmark and the detail drawer. */
    details: "Details",
    expand: (label: string) => `${label} ausklappen`,
    hideSidebar: "Seitenleiste ausblenden",
    /** The first-visit hint speaks to the reader it is for: an English browser on the German page. */
    hint: "This map is also available in English.",
    hintDismiss: "Dismiss",
    hintOpen: "English version",
    /** The list drawer. */
    list: "Liste",
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
    /** An entity route's title and description (`lib/share-text.ts`); numbers arrive formatted. */
    entity: {
      destination: "Reiseziel",
      destinationDescription: (country: string) => `Reiseziel (${country}).`,
      loop: "Rundtour",
      loopDescription: (km: string, gain: string, passes: string) =>
        `Rundtour, ca. ${km} km und ${gain} hm über ${passes} Pässe.`,
      /** "Pass in den Alpen (FR)." – the type word, the range in a sentence, the country. */
      passDescription: (type: string, inside: string, country: string) =>
        `${type} ${inside} (${country}).`,
      town: "Rad-Ort",
      townDescription: (country: string) => `Rad-Ort (${country}).`,
    },
    headline: "Welche Region lohnt sich wann?",
  },
  sidebar,
  /**
   * The site's own metadata: title, description and keywords. German is the
   * source in `lib/brand.ts`, so the manifest, the icons and the sitemap read
   * the same words; the English file writes its own.
   */
  site: {
    description: SITE_DESCRIPTION,
    keywords: [
      "Alpenpässe",
      "Rennrad",
      "Rennradurlaub",
      "Radurlaub Alpen",
      "Passhöhen",
      "Rundtouren",
      "Höhenprofil",
      "Passöffnung",
      "Wann sind die Alpenpässe offen",
      "Radreiseziele",
    ] as string[],
    tagline: SITE_TAGLINE,
    title: SITE_TITLE,
  },
  status,
  vocab,
};

export type Messages = typeof de;
