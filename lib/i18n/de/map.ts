/** The words of the map: its controls, the corner line, the environment menu. */
export const map = {
  /** The compass, shown once the map is turned away from north. */
  alignNorth: "Nach Norden ausrichten",
  /** MapLibre's own ⓘ, through its `locale` option. */
  attribution: "Quellenangaben",
  /** The legend of the view menu's first group. */
  base: "Grundkarte",
  /** The one overlay: waymarked cycling routes. */
  cycleRoutes: "Radrouten",
  /** The hover line of a road the filters leave out, drawn as a grey shadow. */
  filteredOut: "nicht im Filter",
  /** The filter bar over the map (`FilterBar`): one token per criterion. */
  filters: {
    /** The "+" that adds a criterion. */
    add: "Filter hinzufügen",
    back: "Zurück zu den Filtern",
    /** The bar itself, for the screen reader. */
    bar: "Filter",
    /** One token's button: "Filter Klassiker ändern". */
    edit: "Filter „{label}“ ändern",
    /** The headings of the "+" menu. */
    group: {
      road: "Straße",
      season: "Im Zeitraum",
      tour: "Touren",
      where: "Wo",
    },
    /** Every criterion's short name, as the "+" menu lists it. */
    name: {
      beauty: "Schönheit",
      difficulty: "Schwierigkeit",
      elevation: "Höhe",
      fame: "Bekanntheit",
      favorites: "Nur Gemerkte",
      heat: "Wärme im Tal",
      onDate: "Termin im Zeitraum",
      pastEditions: "Frühere Jahre",
      ranges: "Gebirge",
      status: "Zustand",
      surfaces: "Belag",
      tags: "Merkmale",
      tourTypes: "Art der Tour",
      traffic: "Verkehr",
      types: "Art der Straße",
      wet: "Regentage",
    },
    /** On the fame token while a search looks past it (`fameFloor`). */
    searching: "Die Suche findet jede Straße, unabhängig von der Bekanntheit.",
    /** The way back to what the app opens on, shown only once it is left. */
    standard: "Standard",
    standardHint:
      "Zurück zum Standard: die Klassiker – Straßen ab Bekanntheit {n}, Touren mit mindestens einer davon. Die übrigen Straßen bleiben grau auf der Karte.",
  },
  fit: "Ansicht einpassen",
  fitHint: "Ansicht einpassen – erneut für die ganzen Alpen",
  hillshade: "Relief-Schummerung",
  /** The view menu's last group: the same place in the other language. */
  language: "Sprache",
  /** The locate button: its name, its tooltip, and what it says when it cannot. */
  locate: "Mein Standort",
  locateDenied:
    "Standort nicht freigegeben – das lässt sich in den Einstellungen des Browsers ändern",
  locateHint: "Mein Standort – mit den Straßen in der Nähe",
  locateUnavailable: "Standort gerade nicht ermittelbar",
  osmContributors: "© OpenStreetMap-Mitwirkende",
  overlays: "Overlays",
  satellite: "Satellit",
  terrain: "Gelände",
  threeD: "3D-Ansicht",
  /** MapLibre's canvas title (`Map.Title`). */
  title: "Karte",
  /** The generated vector base, listed first in the view menu. */
  vectorBase: "Karte (hell/dunkel automatisch)",
  view: "Ansicht",
  viewMenu: "Ansicht: Karte, Ebenen, 3D und Sprache",
} as const;
