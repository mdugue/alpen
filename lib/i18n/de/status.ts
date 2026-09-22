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
  best: (from: string, to: string) => `beste Zeit ${from} – ${to}`,
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
    limited: (phrase: string) => `Fahrbar, aber mit einem Haken: ${phrase}.`,
  },
  climate: (
    period: string,
    elevation: string,
    wetPct: string,
    valley: string,
    hours: string,
    sunrise: string,
    sunset: string,
  ) =>
    `${period} auf ${elevation}; Niederschlag an ${wetPct} % der Tage. ${valley} Tag ${hours} h, Sonne ${sunrise}–${sunset}.`,
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
    limited: (reasons: string) => `Fahrbar, aber mit einem Haken: ${reasons}.`,
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
  ladder: (signals: string, bestSignal: string, coverClosed: string) =>
    `Jedes Signal kann eine Zelle nur senken, nie heben: ${signals} machen aus „gut“ ein „eingeschränkt“ – und das erste Signal in dieser Reihenfolge ist das Wort dazu. „Beste Zeit“ ist der längste Abschnitt ohne Vorbehalt und mit ${bestSignal}. „Oft gesperrt“ kommt aus dem Öffnungsfenster – und auf ungeteerter Straße aus der Schneedecke ab ${coverClosed} % der Tage: eine gesperrte oder zugeschneite Straße und ein heißes Tal sind nicht dieselbe Art von Aussage.`,
  lapse: (rate: string) => `${rate} °C je 100 m`,
  or: "oder",
  /** The reason as its sentence under the badge; every number carries its source. */
  reason: {
    altitude: (period: string, elevation: string) =>
      `${period} ist auf ${elevation} m Grenzbereich: Schnee und Eis sind möglich, auch wenn die Straße offen ist.`,
    coldDescent: (tmax: string) =>
      `Am Gipfel im Schnitt höchstens ${tmax} °C (ERA5-Land 2015–2024) – mit Fahrtwind ist die Abfahrt eine um den Gefrierpunkt.`,
    frost: (pct: number, days: number) =>
      `Frost in ${pct} % der Nächte (≈ ${days} von 15, ERA5-Land 2015–2024) – nasse Straßen können überfrieren, die Abfahrt wird kalt.`,
    heat: (tmax: string, error: number) =>
      `Im Tal um ${tmax} °C am Nachmittag (aus dem Gipfelwert abgeleitet, ± ${error} °C) – ab dem späten Vormittag nur noch oben angenehm.`,
    outsideSeason: "Außerhalb der typischen Saison.",
    outsideWindow: (window: string) =>
      `Außerhalb des typischen Öffnungsfensters (${window}).`,
    shortDay: (hours: string, sunset: string) =>
      `Nur ${hours} Stunden Tageslicht, Sonnenuntergang gegen ${sunset} – für eine lange Runde wird es knapp.`,
    snow: (pct: number, days: number) =>
      `Schneefall an ${pct} % der Tage (≈ ${days} von 15, ERA5-Land 2015–2024) – meist bleibt die Straße befahrbar, planbar ist der Zeitraum aber nicht.`,
    snowCover: (pct: number, days: number) =>
      `Schneedecke an ${pct} % der Tage (≈ ${days} von 15, ERA5-Land 2015–2024) – eine ungeteerte Straße räumt niemand, sie ist offen, sobald der Schnee weg ist.`,
    wet: (pct: number, days: number) =>
      `Regen an ${pct} % der Tage (≈ ${days} von 15, ERA5-Land 2015–2024) – Staulage; ein trockenes Fenster ist Glückssache.`,
    windowEdge: (window: string | null) =>
      `Am Rand des Öffnungsfensters${window ? ` (${window})` : ""} – Öffnung und Sperrung verschieben sich je nach Winter um Wochen.`,
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
    tourOwn: (window: string) => `Typisch ${window}.`,
    tourPasses: "Fahrbar, solange die Pässe der Runde offen sind.",
    typical: (window: string, maintained: string) =>
      `Typisch offen ${window}${maintained}.`,
  },
  /** The clause of each threshold in the scales dialog, given the value with its unit. */
  signal: {
    best: (value: string) => `weniger als ${value} Schneefalltagen`,
    "cold-descent": (value: string) => `ein Gipfel-Tagesmaximum unter ${value}`,
    frost: (value: string) => `Frost in ${value} der Nächte`,
    heat: (value: string) => `Hitze im Tal ab ${value}`,
    "short-day": (value: string) => `Tage unter ${value} Licht`,
    snow: (value: string) => `Schneefall ab ${value} der Tage`,
    "snow-cover": (value: string) =>
      `auf ungeteerter Straße eine Schneedecke an ${value} der Tage`,
    wet: (value: string) => `Regen an ${value} der Tage`,
  },
  /** One sentence for the 24 cells of a strip, for screen readers. */
  summary: {
    allYear: "ganzjährig",
    closedAllYear: "Saison: ganzjährig oft gesperrt.",
    limitedOnly: (span: string) =>
      `Saison: eingeschränkt ${span}, sonst oft gesperrt.`,
    parts: (parts: string) => `Saison: ${parts}.`,
  },
  /** The sentence under a tour's badge. */
  tour: {
    closedBy: (word: string, names: string) => `${word}: ${names}.`,
    limitedBy: (word: string, names: string) => `${word} durch ${names}.`,
    outsideWindow: (word: string, window: string) =>
      `${word}: außerhalb des typischen Fensters ${window}.`,
    windowEdge: (word: string, window: string) =>
      `${word}: am Rand des typischen Fensters ${window}.`,
  },
  valley: {
    derived: (valley: string, tmax: string, error: number) =>
      `Im Tal (${valley}) um ${tmax} °C, abgeleitet (± ${error} °C).`,
    none: "Talwert nicht ableitbar, kein Anstiegsprofil.",
  },
  /** "Anfang Juni bis Ende Oktober" – the window as the row and the panel say it. */
  window: (from: string, to: string) => `${from} bis ${to}`,
};
