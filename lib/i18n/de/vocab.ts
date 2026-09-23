/**
 * The vocabulary: what a range, a region, a country, a tag, a road type, a
 * surface, a reach band, a sort and a filter option is called. The keys are
 * the data's own (`lib/regions.ts`, `REACH_BANDS` in `lib/geo.ts`), which
 * hold no words; the words are here, German first, and the search, the
 * schema's messages and the scripts read them from this file too.
 */
export const vocab = {
  /** The reach bands: "vor der Haustür", a day's loop, a day out. */
  band: {
    day: {
      hint: "In einer Tagesrunde ab dem Ort machbar.",
      label: "Tagesrunde",
    },
    door: {
      hint: "Aus dem Ort heraus, ohne Auto.",
      label: "vor der Haustür",
    },
    trip: {
      hint: "Lohnt den Transfer – ein Ausflugstag.",
      label: "Ausflug",
    },
  },
  /** German names for the country codes, so "frankreich" and "fr" both search. */
  country: {
    AD: "Andorra",
    AT: "Österreich",
    CH: "Schweiz",
    DE: "Deutschland",
    ES: "Spanien",
    FR: "Frankreich",
    IT: "Italien",
    SI: "Slowenien",
  },
  /** The chips of the filter panel and their applied form. */
  filter: {
    beauty: "Schönheit {option}",
    /** A window of levels; one level alone is `difficultyOne`. */
    difficulty: "Schwierigkeit {lo}–{hi}",
    difficultyOne: "Schwierigkeit {level}",
    fame: "Bekanntheit {option}",
    favoritesOnly: "nur Gemerkte",
    /** The status chips read as alternatives: "gut oder eingeschränkt". */
    statusOr: " oder ",
    traffic: "Verkehr {option}",
    valley: "Tal {option}",
    wetDays: "Regentage {option}",
  },
  /** The label of one threshold chip; `n` arrives formatted. */
  option: {
    any: "egal",
    elevationFrom: "ab {m} m",
    from: "ab {n}",
    only: "nur {n}",
    under: "unter {n} °C",
    upTo: "bis {n}",
    wetDays: "bis {n} von 15",
  },
  /** The legend line while the overview is thinned by fame. */
  prominence: {
    famous: "berühmte Pässe",
    known: "bekannte Pässe",
  },
  /**
   * A range as a label, a hint, and in a sentence: German declines the
   * article, and the Jura is singular where the other three are plural – "in
   * den Alpen" but "im Jura" – so the phrases are written per range.
   */
  range: {
    Alpen: {
      hint: "Von den Seealpen bis nach Slowenien – Westalpen, Zentralalpen, Ostalpen und Dolomiten.",
      inside: "in den Alpen",
      label: "Alpen",
      outside: "außerhalb der Alpen",
    },
    Jura: {
      hint: "Grand Colombier, Mont du Chat, Faucille, Chasseral: lange Saison, wenig Verkehr, zwei Stunden ab Basel.",
      inside: "im Jura",
      label: "Jura",
      outside: "außerhalb des Juras",
    },
    Pyrenäen: {
      hint: "Tourmalet, Aubisque, Peyresourde, Ariège und Andorra: die anderen Berge der Tour, mit der langen Saison der spanischen Seite.",
      inside: "in den Pyrenäen",
      label: "Pyrenäen",
      outside: "außerhalb der Pyrenäen",
    },
    Vogesen: {
      hint: "Grand Ballon, Schlucht, Ballon d'Alsace und die Route des Crêtes: das Wochenende ab Freiburg, Basel oder Karlsruhe.",
      inside: "in den Vogesen",
      label: "Vogesen",
      outside: "außerhalb der Vogesen",
    },
  },
  /** What a base or an area says about the roads around it. */
  reach: {
    areaLine: "{rideable} von {total} Straßen gut",
    areaNone: "keine Straße im Gebiet",
    count: {
      best: "{n} zur besten Zeit",
      closed: "{n} oft gesperrt",
      good: "{n} gut",
      limited: "{n} eingeschränkt",
    },
    noneRideable:
      "Keiner der {total} Pässe im Umkreis ist in diesem Halbmonat gut befahrbar.",
    noneWithin: "Kein Pass im Umkreis von {km} km.",
    ofTotal: "Von {total} Pässen im Umkreis: {parts}.",
  },
  /**
   * The regions are German words in the data and read as they are here; the
   * English file names them.
   */
  region: {
    Dolomiten: "Dolomiten",
    Jura: "Jura",
    Ostalpen: "Ostalpen",
    Pyrenäen: "Pyrenäen",
    Vogesen: "Vogesen",
    Westalpen: "Westalpen",
    Zentralalpen: "Zentralalpen",
  },
  roadTag: {
    carfree: {
      hint: "Für Autos gesperrt, mindestens an festen Tagen – wann, steht in der Notiz.",
      label: "Autofrei",
    },
    cobbles: {
      hint: "Ein Stück ist gepflastert – Tremola, Vršič –, das ändert die Reifenwahl, nicht das Rad.",
      label: "Pflaster",
    },
    glacier: {
      hint: "Endet an einem Gletscher oder führt an ihm entlang.",
      label: "Gletscherstraße",
    },
    gorge: {
      hint: "Ein nennenswertes Stück führt durch eine Schlucht oder einen Canyon.",
      label: "Schlucht",
    },
    hairpins: {
      hint: "Das Kehrenbauwerk ist selbst ein Denkmal – Tremola, Lacets de Montvernier, San Boldo.",
      label: "Kehrenbauwerk",
    },
    panorama: {
      hint: "Für die Aussicht gebaut, und Name oder Streckenführung sagen das auch.",
      label: "Panoramastraße",
    },
    reservoir: {
      hint: "Die Straße gibt es wegen einer Staumauer; sie endet am See oder führt an ihm entlang.",
      label: "Stausee",
    },
    toll: {
      hint: "Mautstraße; ob Räder zahlen, steht in der Notiz. Unabhängig davon, ob sie geräumt wird.",
      label: "Maut",
    },
    tunnels: {
      hint: "Unbeleuchtete Tunnel oder Galerien, mit denen zu rechnen ist.",
      label: "Tunnel & Galerien",
    },
  },
  roadType: {
    balcony: {
      hint: "In eine Wand gehauen, ohne Gipfel, auf den die Fahrt zuläuft: Combe Laval, Gorges de la Bourne.",
      label: "Balkonstraße",
    },
    pass: {
      hint: "Ein Übergang: auf der einen Seite hinauf, auf der anderen hinunter.",
      label: "Pass",
    },
    plateau: {
      hint: "Bleibt oben, statt einmal überzuqueren: Höhenstraße, Hochebene.",
      label: "Höhenstraße",
    },
    spur: {
      hint: "Ein Anstieg zu einem Punkt, an dem die Straße endet – hinunter geht es dieselbe Auffahrt zurück.",
      label: "Stichstraße",
    },
    valley: {
      hint: "Ein ruhiges Sackgassental mit wenig Steigung.",
      label: "Talstraße",
    },
  },
  sort: {
    beauty: "Schönheit",
    difficulty: "Schwierigkeit",
    elevation: "Höhe",
    fame: "Bekanntheit",
    name: "Name",
    status: "Status",
    traffic: "Verkehr",
  },
  surface: {
    asphalt: {
      hint: "Durchgehend asphaltiert – die Straße, die ein Rennrad fährt.",
      label: "Asphalt",
    },
    gravel: {
      hint: "Ungeteert – Schotter, Militärstraße, Almweg: Gravel- oder Mountainbike, und offen, sobald der Schnee weg ist.",
      label: "Schotter",
    },
    mixed: {
      hint: "Asphalt mit einem Schotterstück, das kein Rennrad fährt – die Notiz sagt, wo.",
      label: "Gemischt",
    },
  },
  townTag: {
    events: {
      hint: "Start oder Zentrum eines großen Radmarathons.",
      label: "Marathon-Ort",
    },
    hotels: {
      hint: "Unterkünfte mit Radkeller, Waschplatz und Tourenservice.",
      label: "Bike-Hotels",
    },
    hub: {
      hint: "Fester Begriff im Rennradkalender: im Sommer voller Rennräder, Servicepoints, Trainingsziel.",
      label: "Radsport-Mekka",
    },
    passes: {
      hint: "Mehrere klassische Anstiege beginnen ohne Anfahrt vor der Haustür.",
      label: "Pässe vor der Tür",
    },
    quiet: {
      hint: "Wenig Durchgangsverkehr: Nebental statt Transitachse.",
      label: "Ruhig",
    },
    scenic: {
      hint: "Lage und Landschaft sind selbst ein Grund, hierher zu fahren.",
      label: "Besonders schön",
    },
    season: {
      hint: "Tief und mild gelegen – fährt sich früh im Jahr und noch spät im Herbst.",
      label: "Lange Saison",
    },
    train: {
      hint: "Ohne Auto erreichbar: Bahnhof im Ort oder im Tal darunter.",
      label: "Bahnanschluss",
    },
    workshops: {
      hint: "Rennradläden mit Werkstatt und Leihrädern am Ort.",
      label: "Werkstätten & Verleih",
    },
  },
  /** The unit words that are not international: the metres of climbing, and "about". */
  unit: {
    approx: "ca.",
    climb: "hm",
  },
} as const;
