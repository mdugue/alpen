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
    BE: "Belgien",
    CH: "Schweiz",
    CZ: "Tschechien",
    DE: "Deutschland",
    ES: "Spanien",
    FR: "Frankreich",
    IT: "Italien",
    LI: "Liechtenstein",
    PL: "Polen",
    SI: "Slowenien",
    SK: "Slowakei",
  },
  /** The filter chips and their tokens in the bar over the map. */
  filter: {
    beauty: "Schönheit {option}",
    /** The fame floor the app opens on (`CLASSIC_FAME`). */
    classics: "Klassiker",
    /** A window of levels; one level alone is `difficultyOne`. */
    difficulty: "Schwierigkeit {lo}–{hi}",
    difficultyOne: "Schwierigkeit {level}",
    fame: "Bekanntheit {option}",
    favoritesOnly: "nur Gemerkte",
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
    Andalusien: {
      hint: "Die höchste Straße Spaniens über Granada, die Ragua und die Sternwarte von Calar Alto: lange Anstiege in der Sonne Andalusiens, im Frühjahr und Herbst.",
      inside: "in der Sierra Nevada und in Almería",
      label: "Sierra Nevada und Almería",
      outside: "außerhalb der Sierra Nevada und Almerías",
    },
    Apennin: {
      hint: "Blockhaus, Campo Imperatore und Terminillo: die großen Giro-Anstiege im Rückgrat Italiens, von der Toskana bis in die Abruzzen.",
      inside: "im Apennin",
      label: "Apennin",
      outside: "außerhalb des Apennins",
    },
    Ardennen: {
      hint: "Die Anstiege von Lüttich–Bastogne–Lüttich und der Mur de Huy: kurz, steil und berühmt, ein Wochenende von Köln, Aachen und Brüssel.",
      inside: "in den Ardennen",
      label: "Ardennen",
      outside: "außerhalb der Ardennen",
    },
    Bayerwald: {
      hint: "Die Arberstraßen über Bodenmais und Bayerisch Eisenstein, Dreisessel und Kleť: Waldberge an der tschechischen Grenze für ein Wochenende.",
      inside: "im Bayerischen Wald und im Böhmerwald",
      label: "Bayerischer Wald und Böhmerwald",
      outside: "außerhalb des Bayerischen Walds und des Böhmerwalds",
    },
    Erzgebirge: {
      hint: "Fichtelberg, Klínovec und die steilen Rampen der böhmischen Südseite: das Wochenende ab Dresden, Chemnitz oder Prag.",
      inside: "im Erzgebirge",
      label: "Erzgebirge",
      outside: "außerhalb des Erzgebirges",
    },
    Harz: {
      hint: "Der Brocken ohne Autos, Torfhaus und die steilen Rampen über Thale: der nördlichste Berg für ein Wochenende.",
      inside: "im Harz",
      label: "Harz",
      outside: "außerhalb des Harzes",
    },
    Jura: {
      hint: "Grand Colombier, Mont du Chat, Faucille, Chasseral: lange Saison, wenig Verkehr, zwei Stunden ab Basel.",
      inside: "im Jura",
      label: "Jura",
      outside: "außerhalb des Juras",
    },
    Kanaren: {
      hint: "Der Teide von Meereshöhe auf 2000 m, Masca, der Roque de los Muchachos: die längsten Anstiege Europas für den Winter.",
      inside: "auf den Kanaren",
      label: "Kanaren",
      outside: "außerhalb der Kanaren",
    },
    Korsika: {
      hint: "Bavella, Vergio und Vizzavona über Granit und Macchia: lange Anstiege vom Meer ins Gebirge, für Frühjahr und Herbst.",
      inside: "auf Korsika",
      label: "Korsika",
      outside: "außerhalb Korsikas",
    },
    Mallorca: {
      hint: "Sa Calobra, Puig Major und Coll de Sóller über dem Meer: die Antwort für Februar, März und November.",
      inside: "auf Mallorca",
      label: "Mallorca",
      outside: "außerhalb Mallorcas",
    },
    Nordspanien: {
      hint: "Angliru, Lagos de Covadonga und die Pässe des Kantabrischen Gebirges: steile Vuelta-Anstiege zwischen Meer und Picos de Europa.",
      inside: "in Asturien und Kantabrien",
      label: "Asturien und Kantabrien",
      outside: "außerhalb Asturiens und Kantabriens",
    },
    Pyrenäen: {
      hint: "Tourmalet, Aubisque, Peyresourde, Ariège und Andorra: die anderen Berge der Tour, mit der langen Saison der spanischen Seite.",
      inside: "in den Pyrenäen",
      label: "Pyrenäen",
      outside: "außerhalb der Pyrenäen",
    },
    Riesengebirge: {
      hint: "Die Bauden über Špindlerův Mlýn und Janské Lázně, der Okraj-Pass nach Polen und der Jeschken über Liberec: kurze, steile Anstiege, ein Wochenende von Dresden, Prag und Breslau.",
      inside: "im Riesengebirge",
      label: "Riesengebirge",
      outside: "außerhalb des Riesengebirges",
    },
    Schwarzwald: {
      hint: "Schauinsland, Kandel, Feldberg und die Schwarzwaldhochstraße: lange Anstiege direkt aus Freiburg, Karlsruhe oder Basel.",
      inside: "im Schwarzwald",
      label: "Schwarzwald",
      outside: "außerhalb des Schwarzwalds",
    },
    Sizilien: {
      hint: "Der Ätna von vier Seiten bis auf fast 2000 m, die Madonie und die Nebrodi über der Nordküste, Erice über Trapani: lange Anstiege im Süden Italiens, von März bis November.",
      inside: "auf Sizilien",
      label: "Sizilien",
      outside: "außerhalb Siziliens",
    },
    Tatra: {
      hint: "Štrbské Pleso unter der Hohen Tatra, Čertovica und Chopok in der Niederen Tatra, die Rampen um Zakopane: Bergstraßen in der Slowakei und in Polen, von Juni bis September.",
      inside: "in der Tatra",
      label: "Tatra",
      outside: "außerhalb der Tatra",
    },
    Thüringen: {
      hint: "Inselsberg und Oberhof am Rennsteig, Wasserkuppe und Kreuzberg in der Rhön: kurze Anstiege für ein Wochenende in der Mitte Deutschlands.",
      inside: "im Thüringer Wald und in der Rhön",
      label: "Thüringer Wald und Rhön",
      outside: "außerhalb des Thüringer Walds und der Rhön",
    },
    Vogesen: {
      hint: "Grand Ballon, Schlucht, Ballon d'Alsace und die Route des Crêtes: das Wochenende ab Freiburg, Basel oder Karlsruhe.",
      inside: "in den Vogesen",
      label: "Vogesen",
      outside: "außerhalb der Vogesen",
    },
    Zentralmassiv: {
      hint: "Die Vulkane der Auvergne mit dem Puy Mary und die Cevennen mit dem Aigoual: leer, grün, im Juni und September am schönsten.",
      inside: "im Zentralmassiv",
      label: "Zentralmassiv",
      outside: "außerhalb des Zentralmassivs",
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
    Abruzzen: "Abruzzen",
    Almería: "Almería",
    Ardennen: "Ardennen",
    Asturien: "Asturien",
    Bayerwald: "Bayerischer Wald",
    Böhmerwald: "Böhmerwald",
    Dolomiten: "Dolomiten",
    Erzgebirge: "Erzgebirge",
    "Gran Canaria": "Gran Canaria",
    Harz: "Harz",
    "Hohe Tatra": "Hohe Tatra",
    "Jeschken und Isergebirge": "Jeschken und Isergebirge",
    Jura: "Jura",
    Kantabrien: "Kantabrien",
    Korsika: "Korsika",
    "La Palma": "La Palma",
    Latium: "Latium",
    Mallorca: "Mallorca",
    Marken: "Marken",
    "Niedere Tatra": "Niedere Tatra",
    Nordsizilien: "Nordsizilien",
    Ostalpen: "Ostalpen",
    Podhale: "Podhale",
    Pyrenäen: "Pyrenäen",
    Rhön: "Rhön",
    Riesengebirge: "Riesengebirge",
    Schwarzwald: "Schwarzwald",
    "Sierra Nevada": "Sierra Nevada",
    Teneriffa: "Teneriffa",
    Thüringen: "Thüringer Wald",
    Toskana: "Toskana",
    Vogesen: "Vogesen",
    Westalpen: "Westalpen",
    Westsizilien: "Westsizilien",
    Zentralalpen: "Zentralalpen",
    Zentralmassiv: "Zentralmassiv",
    Ätna: "Ätna",
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
    forest: {
      hint: "Fast ganz im Wald: im Hochsommer schattig, dafür ohne Fernblick.",
      label: "Waldstraße",
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
    race: {
      hint: "Eine große Rundfahrt oder ein Klassiker ist hier gefahren – Tour, Giro, Vuelta, Deutschland Tour.",
      label: "Rennstrecke",
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
    climb: {
      hint: "Ein Anstieg auf eine Hochfläche oder einen Kamm, oben geht die Straße weiter: Albaufstiege, der Südabbruch des Erzgebirges.",
      label: "Steige",
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
  tourType: {
    edition: {
      hint: "Eine Veranstaltung, die ihre Strecke jedes Jahr ändert: hier die Strecke eines Jahres. Die Vorjahre blendet „Frühere Jahre“ ein.",
      label: "Jahresausgabe",
      plural: "Jahresausgaben",
    },
    event: {
      hint: "Die Strecke eines Radmarathons oder Granfondo: an einem Tag im Jahr mit Startnummer und gesperrten Straßen, an allen anderen frei zu fahren.",
      label: "Veranstaltung",
      plural: "Veranstaltungen",
    },
    loop: {
      hint: "Eine klassische Runde ohne Wertung, zu fahren, wann man will.",
      label: "Rundtour",
      plural: "Rundtouren",
    },
    permanent: {
      hint: "Eine Dauerstrecke mit Stempelkarte oder Wertung, beschildert oder nach dem Track des Veranstalters, die ganze Saison über zu fahren, mit Medaille fürs Ankommen.",
      label: "Dauerstrecke",
      plural: "Dauerstrecken",
    },
    stages: {
      hint: "Von A nach B über mehrere Tage, mit Nächten unterwegs statt im selben Hotel.",
      label: "Etappenroute",
      plural: "Etappenrouten",
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
  /** How a range is travelled to (`RANGE_TRIP`): the two rows of range chips. */
  trip: {
    holiday: "Urlaub",
    weekend: "Wochenende",
  },
  /** The unit words that are not international: the metres of climbing, and "about". */
  unit: {
    approx: "ca.",
    climb: "hm",
  },
} as const;
