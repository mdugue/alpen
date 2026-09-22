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
  fit: "Ansicht einpassen",
  fitHint: "Ansicht einpassen – erneut für die ganzen Alpen",
  hillshade: "Relief-Schummerung",
  /** The corner line while the overview is thinned by fame (`prominenceWord`). */
  levelLine: (word: string) => `Bei dieser Zoomstufe: ${word}`,
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
  viewMenu: "Ansicht: Karte, Ebenen und 3D",
};
