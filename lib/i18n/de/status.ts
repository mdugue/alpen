/**
 * The words of the rideability heuristic (`lib/status.ts`): the three labels,
 * the four grades, the reasons in their three lengths, and every generated
 * sentence. The functions take numbers already formatted and half-months
 * already named, so this file needs nothing but words – the heuristic does
 * the arithmetic and hands the parts over.
 */
export const status = {
  /** "a, b und c" / "a, b oder c" – the conjunctions the lists are built with. */
  and: "und",
  best: "beste Zeit {from} – {to}",
  /** What one cell says where it knows its half-month. */
  cell: {
    closedBarrier:
      "Die Straße ist in dieser Zeit meist gesperrt, in der Regel wegen der Wintersperre.",
    closedCover:
      "Die ungeteerte Straße liegt in dieser Zeit meist unter Schnee – niemand räumt sie.",
    goodShort:
      "Nichts spricht gegen die Fahrt. Nur ist es ein kürzerer Abschnitt als die beste Zeit.",
    goodSnowy:
      "Nichts spricht gegen die Fahrt. Jedoch schneit es gelegentlich.",
    limited: "Fahrbar, aber mit einem Haken: {phrase}.",
  },
  climate:
    "{period} auf {elevation}; Niederschlag an {wetPct} % der Tage. {valley} Tag {hours} h, Sonne {sunrise}–{sunset}.",
  grade: {
    best: "beste Zeit",
    closed: "oft gesperrt",
    good: "gut",
    limited: "eingeschränkt",
  },
  /** One plain sentence per grade, for the legend. */
  gradeHint: {
    best: "Die verlässlichsten Wochen des Jahres für diesen Pass: Nichts spricht gegen die Fahrt, und Schnee ist selten.",
    closed:
      "Die Straße ist in dieser Zeit meist gesperrt – wegen der Wintersperre, oder auf einer ungeteerten Straße wegen der Schneedecke.",
    good: "Nichts spricht gegen die Fahrt. Nur ist es entweder ein kürzerer Abschnitt als die beste Zeit, oder es schneit gelegentlich.",
    /** Given the list of every limiting reason, "a, b oder c". */
    limited: "Fahrbar, aber mit einem Haken: {reasons}.",
  },
  /** The unit words a signal is printed with. */
  hours: "Stunden",
  /** The three-valued status: "how good is it to ride there", not "is it open". */
  label: {
    closed: "oft gesperrt",
    open: "gut",
    risky: "eingeschränkt",
  },
  /** The "Vier Stufen, eine Leiter" paragraph, from the signals in ladder order. */
  ladder:
    "Jedes Signal kann eine Zelle nur senken, nie heben: {signals} machen aus „gut“ ein „eingeschränkt“ – und das erste Signal in dieser Reihenfolge ist das Wort dazu. „Beste Zeit“ ist der längste Abschnitt ohne Vorbehalt und mit {bestSignal}. „Oft gesperrt“ kommt aus dem Öffnungsfenster – und auf ungeteerter Straße aus der Schneedecke ab {coverClosed} % der Tage: eine gesperrte oder zugeschneite Straße und ein heißes Tal sind nicht dieselbe Art von Aussage.",
  lapse: "{rate} °C je 100 m",
  or: "oder",
  /** The reason as its sentence under the badge; every number carries its source. */
  reason: {
    altitude:
      "{period} ist auf {elevation} m Grenzbereich: Schnee und Eis sind möglich, auch wenn die Straße offen ist.",
    coldDescent:
      "Am Gipfel im Schnitt höchstens {tmax} °C (ERA5-Land 2015–2024) – mit Fahrtwind ist die Abfahrt eine um den Gefrierpunkt.",
    frost:
      "Frost in {pct} % der Nächte (≈ {days} von 15, ERA5-Land 2015–2024) – nasse Straßen können überfrieren, die Abfahrt wird kalt.",
    heat: "Im Tal um {tmax} °C am Nachmittag (aus dem Gipfelwert abgeleitet, ± {error} °C) – ab dem späten Vormittag nur noch oben angenehm.",
    outsideSeason: "Außerhalb der typischen Saison.",
    outsideWindow: "Außerhalb des typischen Öffnungsfensters ({window}).",
    shortDay:
      "Nur {hours} Stunden Tageslicht, Sonnenuntergang gegen {sunset} – für eine lange Runde wird es knapp.",
    snow: "Schneefall an {pct} % der Tage (≈ {days} von 15, ERA5-Land 2015–2024) – meist bleibt die Straße befahrbar, planbar ist der Zeitraum aber nicht.",
    snowCover:
      "Schneedecke an {pct} % der Tage (≈ {days} von 15, ERA5-Land 2015–2024) – eine ungeteerte Straße räumt niemand, sie ist offen, sobald der Schnee weg ist.",
    wet: "Regen an {pct} % der Tage (≈ {days} von 15, ERA5-Land 2015–2024) – Staulage; ein trockenes Fenster ist Glückssache.",
    windowEdge:
      "Am Rand des Öffnungsfensters ({window}) – Öffnung und Sperrung verschieben sich je nach Winter um Wochen.",
  },
  /** The caveat as a standalone phrase, for "Fahrbar, aber mit einem Haken: …". */
  reasonPhrase: {
    altitude: "Höhenlage, Schnee und Eis sind möglich",
    "cold-descent": "eine kalte Abfahrt",
    frost: "Frost in den Nächten",
    heat: "Hitze im Tal",
    "outside-window": "Wintersperre",
    "short-day": "kurze Tage",
    snow: "Schneefall",
    "snow-cover": "Altschnee auf der ungeteerten Straße",
    wet: "viel Regen",
    "window-edge":
      "der Rand des Öffnungsfensters, Öffnung und Sperrung verschieben sich je nach Winter",
  },
  /** The caveat as a bare noun phrase, for the list in the legend. */
  reasonShort: {
    altitude: "die Höhenlage",
    "cold-descent": "eine kalte Abfahrt",
    frost: "Frost",
    heat: "Hitze im Tal",
    "outside-window": "Wintersperre",
    "short-day": "kurze Tage",
    snow: "Schnee",
    "snow-cover": "Altschnee",
    wet: "viel Regen",
    "window-edge": "der Rand des Öffnungsfensters",
  },
  /** The one word the badge and the strip carry for a limited cell. */
  reasonWord: {
    altitude: "Höhe",
    "cold-descent": "kalte Abfahrt",
    frost: "Frost",
    heat: "Hitze",
    "outside-window": "gesperrt",
    "short-day": "kurze Tage",
    snow: "Schnee",
    "snow-cover": "zugeschneit",
    wet: "nass",
    "window-edge": "Randzeit",
  },
  season: {
    allYear:
      "Ganzjährig befahrbar (Winterräumung); Schnee und Kälte je nach Höhe.",
    /** The short form for a loop row without a window of its own. */
    likePasses: "wie ihre Pässe",
    maintained: " (bewirtschaftete Mautstraße, wird geräumt)",
    tourOwn: "Typisch {window}.",
    tourPasses: "Fahrbar, solange die Pässe der Runde offen sind.",
    typical: "Typisch offen {window}{maintained}.",
  },
  /** The clause of each threshold in the scales dialog, given the value with its unit. */
  signal: {
    best: "weniger als {value} Schneefalltagen",
    "cold-descent": "ein Gipfel-Tagesmaximum unter {value}",
    frost: "Frost in {value} der Nächte",
    heat: "Hitze im Tal ab {value}",
    "short-day": "Tage unter {value} Licht",
    snow: "Schneefall ab {value} der Tage",
    "snow-cover": "auf ungeteerter Straße eine Schneedecke an {value} der Tage",
    wet: "Regen an {value} der Tage",
  },
  /** One sentence for the 24 cells of a strip, for screen readers. */
  summary: {
    allYear: "ganzjährig",
    closedAllYear: "Saison: ganzjährig oft gesperrt.",
    limitedOnly: "Saison: eingeschränkt {span}, sonst oft gesperrt.",
    parts: "Saison: {parts}.",
  },
  /** The sentence under a tour's badge. */
  tour: {
    closedBy: "{word}: {names}.",
    limitedBy: "{word} durch {names}.",
    outsideWindow: "{word}: außerhalb des typischen Fensters {window}.",
    windowEdge: "{word}: am Rand des typischen Fensters {window}.",
  },
  valley: {
    derived: "Im Tal ({valley}) um {tmax} °C, abgeleitet (± {error} °C).",
    none: "Talwert nicht ableitbar, kein Anstiegsprofil.",
  },
  /** "Anfang Juni bis Ende Oktober" – the window as the row and the panel say it. */
  window: "{from} bis {to}",
} as const;
