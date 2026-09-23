/**
 * The words of the sidebar: search, the lists, their toolbars, the filter
 * panel, the compare sheet, the empty state and the three small pieces every
 * list row is built from (the status label, the rating bars, the season
 * strip). Nested by component; the functions take numbers already formatted.
 */
export const sidebar = {
  clearSearch: "Suche leeren",
  /** The compare sheet and the bar above the destination list it opens from. */
  compare: {
    baseTowns: "Standort: ",
    description:
      "Alles hier ist aus den Straßen der Gebiete abgeleitet – die Zahl gut befahrbarer Straßen im gewählten Halbmonat, der Jahresverlauf und die Orte als Standort.",
    loops: "Runden",
    none: "Kein Reiseziel gewählt – in der Liste bis zu drei zum Vergleich einschalten.",
    open: "Vergleichen",
    pick: "Bis zu {max} Reiseziele zum Vergleich wählen",
    picked: "{n} von {max} zum Vergleich",
    remove: "{name} aus dem Vergleich nehmen",
    roads: "Straßen",
    title: "Reiseziele im Vergleich",
    toggle: "{name} vergleichen",
    towns: "Orte",
  },
  /** The empty state of a list, with the way out inside it. */
  empty: {
    filtersMatchNothing: "Die gesetzten Filter passen zu keinem Eintrag.",
    noDestinations: "Keine Reiseziele gefunden",
    noPasses: "Keine Straßen gefunden",
    noTours: "Keine Touren gefunden",
    /** The query in quotes, with the filters named when they narrow it too. */
    queryMatchesNothing: '„{query}" passt zu keinem Eintrag.',
    /** The same, when filters are set beside the search. */
    queryMatchesNothingFiltered:
      '„{query}" passt zu keinem Eintrag – zusammen mit den gesetzten Filtern.',
    resetAll: "Alle Filter zurücksetzen",
    without: "Ohne „{label}“: {n}",
  },
  /** The filter panel, its trigger and the applied-filter row. */
  filters: {
    active: "Aktive Filter",
    all: "Alle",
    beauty: "Schönheit, 5 ist am schönsten",
    /** The count line: "12 von 262 Straßen, 3 Touren" – the numbers are styled, so they arrive as parts. */
    countRoads: "von {total} Straßen",
    countTours: "Touren",
    difficulty: "Schwierigkeit",
    elevation: "Höhe des Scheitelpunkts",
    fame: "Bekanntheit, 5 ist ein Klassiker",
    favoritesOnly: "Nur Gemerkte",
    heat: "Wärme im Tal (abgeleitet)",
    more: "Weitere Filter",
    /** The dead end: the number follows, styled, then a full stop. */
    noRoadsWithout: "Keine Straßen. Ohne „{label}“ wären es ",
    open: "Filter",
    range: "Gebirge",
    remove: 'Filter „{label}" entfernen',
    reset: "Zurücksetzen",
    roadType: "Art der Straße",
    /** What a chip would leave, for the screen reader: "3, 12 Straßen". */
    roadsLeft: "{label}, {n} Straßen",
    status: "Zustand im gewählten Zeitraum",
    surface: "Belag",
    tags: "Merkmale",
    tagsHint: "Alle ausgewählten müssen zutreffen.",
    traffic: "Verkehr, 1 ist am ruhigsten",
    wet: "Regentage im Halbmonat",
  },
  /** The footer: the legal links and the one call to action. */
  footer: {
    imprint: "Impressum",
    privacy: "Datenschutz",
    supportSr: " – auf Ko-fi, öffnet in neuem Tab",
    supportTitle: "Auf Ko-fi unterstützen",
  },
  footerNote: "Status ist eine Heuristik, Skalen sind redaktionell.",
  /** The lists, their toolbars and the map switches. */
  lists: {
    /** The areas' switch; it carries the towns listed under them too. */
    destinationsOnMap: "Reiseziele auf der Karte",
    onMap: "auf der Karte",
    /** The last group of the areas' list: the towns no listed area holds. */
    otherTowns: "Weitere Orte",
    passes: "{n} Pässe",
    showDestinations: "Reiseziele und ihre Orte auf der Karte anzeigen",
    showPasses: "Pässe und Straßen auf der Karte anzeigen",
    showTour: "{name} auf der Karte anzeigen",
    showTours: "Touren auf der Karte anzeigen",
    sort: "Sortieren",
    sortBy: "Sortieren nach: {label}",
  },
  /** The five bars of an editorial scale, for the screen reader. */
  rating: "{value} von 5",
  search: "Suchen",
  searchPlaceholder: "Reiseziel, Pass, Tour oder Ort …",
  /** One cell of the season strip: "Anfang Juli: gut". */
  strip: {
    cell: "{period}: {grade}",
  },
  support: "Kaffee spendieren",
  whatTheListShows: "Was die Liste zeigt",
} as const;
