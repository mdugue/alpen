/** The words of the map: its controls, the corner line, the environment menu. */
export const map = {
  /** The compass, shown once the map is turned away from north. */
  alignNorth: "Nach Norden ausrichten",
  /** The second chip of the switch on the map (`ClassicsSwitch`): every road. */
  allRoads: "Alle",
  /** MapLibre's own ⓘ, through its `locale` option. */
  attribution: "Quellenangaben",
  /** The legend of the view menu's first group. */
  base: "Grundkarte",
  /** The switch on the map between the classics and every road (`ClassicsSwitch`). */
  classics: "Klassiker",
  classicsGroup: "Welche Straßen und Touren gezeigt werden",
  classicsHint:
    "Die Klassiker – Straßen ab Bekanntheit {n}, Touren mit mindestens einer davon. Die übrigen Straßen bleiben als graue Punkte auf der Karte.",
  classicsSearching: "Die Suche findet alle Straßen, auch ohne „Alle“.",
  /** The one overlay: waymarked cycling routes. */
  cycleRoutes: "Radrouten",
  /** The hover line of a road the filters leave out, drawn as a grey shadow. */
  filteredOut: "nicht im Filter",
  fit: "Ansicht einpassen",
  fitHint: "Ansicht einpassen – erneut für die ganzen Alpen",
  hillshade: "Relief-Schummerung",
  /** The view menu's last group: the same place in the other language. */
  language: "Sprache",
  /** The corner line while the overview is thinned by fame (`prominenceWord`). */
  levelLine: "Bei dieser Zoomstufe: {word}",
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
