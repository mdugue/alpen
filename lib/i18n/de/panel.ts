/**
 * The words of the detail panel: the kicker over the name, the control row,
 * the block titles with their source notes, the labels inside the blocks and
 * the sentences the panel composes itself. Nested by block; what a block
 * shows comes from the model (`lib/detail-model.ts`), what it *says around*
 * the model is here.
 */
export const panel = {
  /** The line over each ascent's profile, and what the profile block says. */
  ascents: {
    average: (pct: string) => `Ø ${pct} %`,
    info: "Geroutete Straße, 100 Höhenpunkte aus einem Geländemodell – zum Vergleichen gut, nicht metergenau.",
    infoTraverse:
      "Geroutete Straße, 100 Höhenpunkte aus einem Geländemodell – zum Vergleichen gut, nicht metergenau. Höhenmeter und steilster Kilometer stehen hier nicht: auf einer fast flachen Straße in einer Schlucht misst das Modell mehr Auf und Ab als die Straße hat.",
    noProfile: "Kein Höhenprofil vorhanden.",
    none: "Keine Auffahrt hinterlegt",
    spur: "Stichstraße: Die Straße endet oben, hinunter geht es dieselbe Auffahrt zurück.",
    steepestKm: (pct: string) => `steilster km ${pct} %`,
    title: "Auffahrten",
    titleTraverse: "Strecke",
  },
  /** The control row on the hero: back, share, save, close. */
  bar: {
    backToList: "Zurück zur Liste",
    close: "Details schließen",
    linkCopied: "Link kopiert",
    list: "Liste",
    save: (name: string) => `${name} merken`,
    share: (name: string) => `${name} teilen`,
    unsave: (name: string) => `${name} nicht mehr merken`,
  },
  /** A town judged as a base, and the inverse: the bases of one road. */
  base: {
    /** "VOR DER HAUSTÜR · 5 Pässe bis 18 km" – the count after the band's name. */
    bandCount: (n: string, noun: string, maxKm: string) =>
      `${n} ${noun} · bis ${maxKm}`,
    basesInfo: (km: number) =>
      `Orte, von denen aus diese Straße erreichbar ist – nach Nähe und danach sortiert, wie viele Pässe der Ort im gewählten Halbmonat sonst noch bietet. Jenseits von ${km} km endet die Liste.`,
    basesNone: (km: number) => `Kein Rad-Ort im Umkreis von ${km} km.`,
    basesTitle: "Orte als Standort",
    /** What the strip under the badge is derived from; the peak clause follows it. */
    derived: (total: string) =>
      `Abgeleitet aus den ${total} Pässen im Umkreis – der Ort selbst hat keine eigene Klimareihe. Der Streifen zeigt den Jahresverlauf im Verhältnis zur besten Zeit dieses Orts`,
    derivedPeak: (peak: string) => ` (dann sind ${peak} Pässe gut befahrbar)`,
    passes: "Pässe",
    passesInfo: (km: number) =>
      `Nach Zustand im gewählten Halbmonat, Schönheit und Nähe sortiert. Nähe zählt gleitend: ein Pass wird nicht bei einem runden Kilometerwert wertlos, sondern verliert mit der Entfernung an Gewicht. Jenseits von ${km} km endet die Liste.`,
    passesTitle: "Pässe von hier aus",
    townLine: (rideable: string, total: string) =>
      `${rideable} von ${total} Pässen gut`,
    townNone: "kein Pass im Umkreis",
    towns: "Orte",
  },
  /** The year chart of a pass's climate. */
  chart: {
    frost: "Frost",
    loading: "Klimadiagramm wird geladen",
    snow: "Schneefall",
    tmax: "Ø Tag",
    tmin: "Ø Nacht",
  },
  /** The climate block: three tiles and the chart under them. */
  climate: {
    dayNight: "Ø Tag / Nacht",
    frost: (days: string) => `Frost · ${days} von 15 Tagen`,
    info: "ERA5-Land 2015–2024, ein 10-km-Raster – auf Passhöhe eher zu mild.",
    noneText: "Für diesen Pass liegen noch keine Klimadaten vor.",
    noneTitle: "Keine Klimareihe",
    snow: (days: string) => `Schnee · ${days} von 15 Tagen`,
    title: "Jahresklima",
  },
  /** The area panel: what it holds and how one gets there. */
  destination: {
    baseMark: "Standort",
    derived: (total: string) =>
      `Abgeleitet aus den ${total} Straßen im Gebiet – ein Reiseziel hat keine eigene Klimareihe. Der Streifen zeigt den Jahresverlauf im Verhältnis zur besten Zeit dieses Gebiets`,
    derivedPeak: (peak: string) => ` (dann sind ${peak} Straßen gut befahrbar)`,
    lodging: "Unterkunft suchen",
    /** The map search behind "Unterkunft suchen". */
    lodgingQuery: (town: string) => `Hotels ${town}`,
    roadsInfo: (km: string) =>
      `Alle Straßen im Umkreis von ${km} km um die Gebietsmitte, plus die redaktionell dazugezählten, minus die ausgenommenen. Sortiert nach Zustand im gewählten Halbmonat, dann Schönheit.`,
    roadsNone: "Keine Straße im Gebiet.",
    roadsTitle: "Straßen im Gebiet",
    toursNone: "Keine Rundtour beginnt in diesem Gebiet.",
    toursTitle: "Rundtouren",
    townsInfo:
      "Die als Standort empfohlenen Orte zuerst, dann die übrigen im Gebiet. „Unterkunft suchen“ öffnet eine Kartensuche nach Hotels im Ort – ohne Buchungsanbieter, ohne Provision; „Werkstätten“ die OSM-Suche nach Fahrradwerkstätten.",
    townsNone: "Kein Rad-Ort im Gebiet.",
    townsTitle: "Orte als Standort",
    travelTitle: "Mehrtägig und Anreise",
  },
  /** The outbound link buttons. */
  external: {
    newTab: " (öffnet in neuem Tab)",
  },
  kicker: {
    destination: (country: string) => `Reiseziel · ${country}`,
    tour: "Rundtour",
    town: (country: string) => `Rad-Ort · ${country}`,
  },
  /** What else is around here, nearest first. */
  nearby: {
    passes: "Pässe",
    title: (km: number) => `Im Umkreis von ${km} km`,
    tours: "Touren",
    towns: "Orte",
  },
  /** The hero carousel and its credits. */
  photos: {
    label: "Bilder",
    loading: "Bilder werden geladen",
    next: "Nächstes Bild",
    notLoaded: "Keine Fotos geladen – die Bilddatei ist nicht angekommen.",
    previous: "Vorheriges Bild",
    unknownArtist: "unbekannt",
    viewOnCommons: (title: string) =>
      `${title} – auf Wikimedia Commons ansehen`,
  },
  /** The scrubbable elevation profile: its summary and its readout. */
  profile: {
    keyHint: (summary: string) =>
      `${summary}. Mit den Pfeiltasten am Profil entlang.`,
    loading: "Höhenprofil wird geladen",
    readout: (km: string, elevation: string, gradient: string) =>
      `km ${km} · ${elevation} m · ${gradient} %`,
    summary: (km: string, start: string, top: string, average: string) =>
      `Höhenprofil: ${km} km von ${start} auf ${top} m, im Mittel ${average} %`,
  },
  /** The editorial 1–5 scales of a road. */
  rating: {
    beauty: "Schönheit",
    difficulty: "Schwierigkeit",
    fame: "Bekanntheit",
    info: "Redaktionelle Einschätzung auf einer Skala von 1 bis 5, keine gemessenen Werte.",
    title: "Bewertung",
    traffic: "Verkehr",
    /** The word beside the traffic dots, by value 1–5; index 0 is unused. */
    trafficLevel: [
      "",
      "fast autofrei",
      "ruhig",
      "normal",
      "viel",
      "Durchgangsstraße",
    ],
  },
  /** The block heading's source note. */
  section: {
    sourceHint: (title: string) => `${title}: Hinweis zur Quelle`,
  },
  /** The loop panel. */
  tour: {
    passCount: (n: string) => `${n} Pässe`,
    passesTitle: "Pässe der Runde",
  },
  /** The town panel. */
  town: {
    bikeShops: "Radläden (Google)",
    /** The map search behind "Radläden". */
    bikeShopsQuery: (town: string) => `bike shop ${town}`,
    destinationLead: "Reiseziel:",
    workshops: "Werkstätten (OSM)",
    /** The OSM search behind "Werkstätten". */
    workshopsQuery: (town: string) => `Fahrradwerkstatt ${town}`,
  },
  /** The forecast block: two rows, the whole week behind a fold. */
  weather: {
    allDays: "Alle 7 Tage",
    /** The WMO weather code, as a word. */
    code: {
      drizzle: "Nieselregen",
      fog: "Nebel",
      overcast: "bedeckt",
      partlyCloudy: "leicht bewölkt",
      rain: "Regen",
      showers: "Regenschauer",
      snow: "Schneefall",
      snowShowers: "Schneeschauer",
      sunny: "sonnig",
      thunderstorm: "Gewitter",
    },
    columns: {
      day: "Tag",
      rain: "Regen",
      snow: "Schnee",
      tmax: "Tmax",
      tmin: "Tmin",
      weather: "Wetter",
      wind: "Wind",
    },
    info: "Vorhersage von Open-Meteo für die Passhöhe, sieben Tage.",
    loading: "Wetter wird geladen",
    /** The word after the centimetres in a dense row. */
    snow: "Schnee",
    title: "Aktuelles Wetter",
    today: "heute",
    tomorrow: "morgen",
    unavailableText: "Open-Meteo antwortet gerade nicht.",
    unavailableTitle: "Wetter nicht verfügbar",
  },
};
