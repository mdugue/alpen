import { SITE_NAME } from "@/lib/brand";

import { map } from "./de/map";
import { panel } from "./de/panel";
import { scales } from "./de/scales";
import { sidebar } from "./de/sidebar";
import { status } from "./de/status";
import { vocab } from "./de/vocab";
import type { Shape } from "./fill";
import type { Lang } from "./lang";

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
 * Every message is a plain string, and a value goes in by name – "Im
 * Umkreis von {km} km" – so a dictionary is data the server can hand the
 * client, and a translation may put the names in any order (`fill` in
 * `./fill.ts`). A sentence that differs by more than its values is two
 * messages, and the caller picks one.
 *
 * The glossary, so a new string lands on the same word as the old ones
 * (German → English): Pass → pass · Straße → road · Tour/Rundtour → loop ·
 * Ort → town · Reiseziel → destination · Halbmonat → half-month · beste
 * Zeit → best time · gut → good · eingeschränkt → limited · oft gesperrt →
 * often closed · gemerkt → favourite · Schönheit → beauty · Schwierigkeit →
 * difficulty · Verkehr → traffic · Bekanntheit → fame · Höhe → elevation ·
 * Belag → surface · Gebirge → range · Anstieg/Auffahrt → ascent ·
 * Höhenmeter (hm) → m+ (compact) / m of climbing (prose) · Rennrad → road
 * bike · Rad-Ort → cycling town · Öffnungsfenster → opening window ·
 * Wintersperre → winter closure · wetterabhängig → weather-dependent ·
 * abgeleitet → derived · Skalen & Quellen → scales & sources · vor der
 * Haustür → on the doorstep · Tagesrunde → day loop · Ausflug → day trip.
 */
export const de = {
  /** The way back from a page that is not the map: the legal pages. */
  backToMap: "Zurück zur Karte",
  /** The season band: the summary line, the legend, the slider and the two ways into the drawers. */
  band: {
    backToToday: "Zurück zu heute ({label})",
    daylight: "{hours} h Tageslicht",
    /** The second button under the band on a phone; the first is the list's kind. */
    filters: "Filter",
    legend: {
      bar: "Balkenhöhe = Ø Tagesmaximum der gezeigten Pässe",
      ribbon: "Band = Befahrbarkeit der meisten von ihnen",
      snow: "Hängebalken = Anteil Tage mit Schneefall",
    },
    /** What a screen reader hears for a column: "meist gut". */
    mostly: "meist {grade}",
    noPass: "kein Pass in dieser Auswahl",
    period: "Zeitraum",
    snow: "{pct} % Schnee",
    today: "heute: {label}",
    wet: "{pct} % nass",
    whatBarsMean: "Was die Balken bedeuten",
  },
  /** The half-month as the whole app says it: "Anfang Oktober", "Ende Mai". */
  calendar: {
    early: "Anfang {month}",
    late: "Ende {month}",
    months: [
      "Januar",
      "Februar",
      "März",
      "April",
      "Mai",
      "Juni",
      "Juli",
      "August",
      "September",
      "Oktober",
      "November",
      "Dezember",
    ],
  },
  /** The bookmark toggle, named after what it keeps – in a row and on the panel. */
  favorite: {
    save: "{name} merken",
    unsave: "{name} nicht mehr merken",
  },
  /** The header bar, and the shell's landmarks and drawers around it. */
  header: {
    /** The headline's four counts, joined with commas. */
    counts: {
      best: "{n} Pässe in bester Zeit",
      closed: "{n} oft gesperrt",
      good: "{n} gut",
      limited: "{n} eingeschränkt",
    },
    dataLine: "Klima 2015–2024 · Prognose 7 Tage",
    /** The detail panel's landmark and the detail drawer. */
    details: "Details",
    /** What the tap target on each drawer's swipe handle says. */
    drawer: {
      details: {
        collapse: "Details einklappen",
        expand: "Details ausklappen",
      },
      list: { collapse: "Liste einklappen", expand: "Liste ausklappen" },
    },
    hideSidebar: "Seitenleiste ausblenden",
    /** The list drawer. */
    list: "Liste",
    listAndFilters: "Liste und Filter",
    noPass: "kein Pass in dieser Auswahl.",
    scales: "Skalen & Quellen",
    skipToMap: "Zur Karte springen",
  },
  kinds: {
    destination: "Reiseziele",
    pass: "Straßen",
    tour: "Touren",
    town: "Orte",
  },
  /** The language these words are in; the number formats read it. */
  lang: "de",
  /**
   * What the two legal pages say around their text, which is German in both
   * languages: the note an English reader gets, the titles.
   */
  legal: {
    englishNote: null as string | null,
    imprint: "Impressum",
    privacy: "Datenschutzerklärung",
    seeAlso: "Siehe auch:",
  },
  map,
  /** A path that names nothing: an entity that is not (or no longer) in the data – what the panel says instead of opening empty. */
  notFound: {
    text: "Unter dieser Adresse gibt es keinen Pass, keine Tour, keinen Ort und kein Reiseziel – vielleicht wurde es umbenannt.",
    title: "Nicht gefunden",
  },
  panel,
  scales,
  share: {
    /** The site's share image, as a screen reader and a failed load read it. */
    alt: `${SITE_NAME} – welche Pässe, Touren und Rad-Orte sind wann mit dem Rennrad befahrbar?`,
    /** The three counts under the wordmark of the share image. */
    counts: "{passes} Pässe · {tours} Touren · {towns} Orte",
    /** An entity route's title and description (`lib/share-text.ts`); numbers arrive formatted. */
    entity: {
      /** An entity's share image, named by its title ("Col du Galibier · 2.642 m"). */
      alt: `{title} – markiert auf der ${SITE_NAME}-Karte`,
      destination: "Reiseziel",
      destinationDescription: "Reiseziel ({country}).",
      loop: "Rundtour",
      loopDescription:
        "Rundtour, ca. {km} km und {gain} hm über {passes} Pässe.",
      /** "Pass in den Alpen (FR)." – the type word, the range in a sentence, the country. */
      passDescription: "{type} {inside} ({country}).",
      town: "Rad-Ort",
      townDescription: "Rad-Ort ({country}).",
    },
    headline: "Welche Region lohnt sich wann?",
  },
  sidebar,
  /**
   * The site's own metadata: title, description, keywords, and the claim the
   * manifest carries. The name is `SITE_NAME` (`lib/brand.ts`) in every
   * language – a name is not translated.
   *
   * The description says what the app is – a planning aid for holidays, not a
   * navigation tool – because that is what people search for. It and the
   * claim name a range once its roads are in, not before: a description that
   * promises the Pyrenees over a map without one Pyrenean road is exactly
   * what Principle 3 forbids.
   */
  site: {
    /** Short form for the manifest, where space is tight. */
    claim:
      "Pässe, Rundtouren und Rad-Orte in den Alpen – nach Befahrbarkeit je Halbmonat.",
    description:
      "Wohin mit dem Rennrad, und wann? Alpenpässe, Auffahrten mit Höhenprofil, Rundtouren und Rad-Orte auf einer Karte – mit Befahrbarkeit je Halbmonat, Wetter und Klima.",
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
    tagline: "Rennradkarte",
    title: `${SITE_NAME} – Rennradkarte`,
  },
  status,
  vocab,
} as const;

/**
 * The words as the app reads them: every string a `Msg` that knows its
 * placeholders, and the language as a `Lang`.
 */
export type Messages = Omit<Shape<typeof de>, "lang"> & { readonly lang: Lang };
