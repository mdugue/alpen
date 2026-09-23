/**
 * The scales dialog: the headings and the prose that explain the 1–5 scales
 * and the ladder. Long paragraphs, so a sentence may carry `**bold**`,
 * `_italic_` and `` `code` `` – the dialog renders the three marks
 * (`rich` in components/scales-dialog.tsx); nothing else is markup. The
 * functions take numbers already formatted.
 */
export const scales = {
  band: {
    heading: "Saisonband",
    intro:
      "Das Band am unteren Rand ist der Zeitregler und zeigt zugleich, was die Pässe der aktuellen Auswahl über das Jahr machen: drei Größen je Halbmonat, gemittelt über genau diese Pässe – Gipfel unterschiedlicher Höhe, also eine Eigenschaft der Auswahl und keine Aussage über „die Alpen“. Auf schmalen Bildschirmen steht die Legende nur hier.",
  },
  data: {
    heading: "Daten",
    text: "**Höhenprofil:** Open-Meteo Elevation (Copernicus DEM 90 m) entlang der gerouteten Straße. **Wetter:** Open-Meteo-Vorhersage auf Passhöhe, serverseitig zwischengespeichert. **Klima:** Open-Meteo-Archiv (ERA5-Land 2015–2024) je Halbmonat; 10-km-Raster, auf Passhöhe tendenziell zu mild. **Routen:** OpenRouteService (Rennrad-Profil) oder OSRM. **3D:** Mapzen/AWS Terrain Tiles. Karten © OpenStreetMap-Mitwirkende.",
  },
  description:
    "Wie die 1–5-Bewertungen und der Status je Zeitraum zustande kommen – und woher die Daten stammen.",
  destinations: {
    heading: "Reiseziele",
    intro:
      "Ein Reiseziel ist ein redaktionell gezogener Kreis: eine Mitte, ein Radius, dazu einzelne Straßen, die dazugezählt oder ausgenommen sind, und die Orte, die als Standort taugen. Was im Kreis liegt, ist die Mitgliedschaft – sie wird beim Bauen der Seite bestimmt, nicht von Hand gepflegt. Die Karte zeichnet nicht den Kreis, sondern den Umriss dessen, was dazugehört: die Gipfel, die Enden ihrer Auffahrten und die Orte. Alle Zahlen eines Reiseziels sind wie beim Ort **abgeleitet**: „7 von 9 Straßen gut“ zählt die Straßen im Gebiet nach ihrem Status im gewählten Halbmonat, der Streifen misst jeden Halbmonat an der besten Zeit dieses Gebiets.",
    /** `riskyPct` is the weight of a limited road, as a whole number. */
    order:
      "**Die Reihenfolge der Liste** ist eine Punktzahl, die nirgends gezeigt wird: die Schönheit jeder offenen Straße voll, die jeder eingeschränkten mit {riskyPct} %, eine gesperrte zählt nichts. Redaktionell wie alles hier – sie ordnet, sie misst nicht.",
  },
  notes: {
    heading: "Hinweise",
    /** The link to the knowledge base's page on the scales and the status. */
    more: "Ausführlich steht das unter {link}.",
    moreLink: "Wissen: Skalen und Status",
    text: "Höhen und Auffahrtsdaten sind gerundete Richtwerte. Schönheit, Bekanntheit, Schwierigkeit und Verkehr sind redaktionelle 1–5-Einschätzungen, Art und Merkmale der Straßen sowie die Merkmale der Orte sind redaktionelle Labels. Der Status je Zeitraum ist eine Heuristik und ersetzt keine amtliche Sperrauskunft. Die App dient der groben Routenplanung, nicht der Navigation.",
  },
  ranges: {
    heading: "Gebirge und Regionen",
    intro:
      "Jede Straße liegt in einer Region, und jede Region in einem Gebirge. Das Gebirge ist ein Filter und zugleich ein Ausschnitt: Wer eines wählt, sieht seine Straßen in der Liste und auf der Karte. Ein Ort gehört zum Gebirge der nächsten Straße in seiner Reichweite.",
  },
  ratings: {
    heading: "Woher kommen die 1–5-Bewertungen?",
    intro:
      "Redaktionelle Einschätzungen aus dem allgemeinen Ruf der Pässe (Radsport-Literatur, Grand-Tour-Historie, quaeldich.de, climbbybike, Cyclingcols). Keine gemessenen Werte, keine Nutzerbewertungen – zur groben Einordnung, nicht zum Punktevergleich.",
    /** The four scales, term and explanation, in the order the dialog lists them. */
    items: [
      [
        "Bekanntheit",
        "5 = Mythos (Galibier, Stelvio, Ventoux, Alpe d'Huez, Glockner), 4 = regelmäßig in Giro/Tour/Marathons, 3 = in der Szene bekannt, 2 = Geheimtipp, 1 = kaum bekannt.",
      ],
      [
        "Schönheit",
        "Landschaft, Panorama, Straßenführung, Ruhe. 5 = Hochgebirgskulisse mit spektakulärer Straße (Bonette, Iseran, Gavia, Giau), 3 = solide, 1–2 = Waldstraße oder Skiort-Anfahrt.",
      ],
      [
        "Schwierigkeit",
        "Länge × Steigung, Höhe, Rampen. 5 = über 1 000 hm mit Rampen über 10 % oder sehr lang und hoch, 3 = normaler Alpenpass, 1–2 = kurz oder flach.",
      ],
      [
        "Verkehr",
        "1 = fast autofrei oder Sackgasse, 3 = normaler Passverkehr, 5 = Durchgangsstraße (Simplon, Lautaret, Julier). Sommerwochenenden und Motorräder verschlechtern das.",
      ],
    ] as [string, string][],
  },
  status: {
    /** `lapse` is `lapseText`, `error` the valley value's margin in °C. */
    derived:
      "**Abgeleitet, nicht gemessen:** Die Klimareihe gilt für die Passhöhe. Der Talwert wird mit {lapse} bis zum tiefsten Anstiegsbeginn heruntergerechnet und liegt gut ± {error} °C daneben; für Pässe ohne Anstiegsprofil gibt es ihn nicht. Das Tageslicht ist reine Astronomie. Im Detail steht unter dem Status der Grund in einem Satz, mit Zahl und Herkunft.",
    heading: "Status je Zeitraum",
    intro:
      "Heuristik aus typischem Öffnungsfenster (halbmonatsgenau), Passhöhe, Jahreszeit, der Klimareihe des Passes (ERA5-Land 2015–2024) und dem Tageslicht. Sie beantwortet „wie gut ist es, dort in diesem Halbmonat zu fahren“, nicht nur „kommt man drüber“. Für Rundtouren gilt der schlechteste Wert ihrer Pässe. Ersetzt keine amtliche Sperrauskunft.",
    /** The paragraph generated from the signals (`ladderText`), under its lead. */
    ladder: "**Vier Stufen, eine Leiter.** {text}",
    strip:
      "Der Streifen aus 24 Zellen zeigt das ganze Jahr auf einen Blick – umrandet ist der gewählte Halbmonat, hohl mit rotem Rand die Sperrung. Im Detail erklärt jede Zelle sich beim Überfahren selbst.",
  },
  surface: {
    heading: "Belag",
    intro:
      "Jede Straße sagt, worauf sie gefahren wird. Die vier Skalen gelten innerhalb der Disziplin: Bekanntheit ist Bekanntheit unter Gravelfahrern, Schwierigkeit rechnet den Belag mit (6 % Schotter fahren sich wie 9 % Asphalt), Verkehr bleibt eine Skala – die Via del Sale trägt an Mauttagen Motorräder. Eine ungeteerte Straße räumt niemand: was sie schließt, ist die Schneedecke, nicht eine Schranke – die Leiter unten sagt, ab wann.",
  },
  symbols: {
    heading: "Kartensymbole",
    text: "**Kreis:** Pass – Farbe zeigt den Status, hohler Kreis = oft gesperrt, Größe = Bekanntheit. **Stern:** gemerkt. **Linie:** Rundtour (eigene Farbe) oder Auffahrt (Statusfarbe). **Raute:** Rad-Ort.",
  },
  towns: {
    heading: "Warum ein Ort in der Liste steht",
    intro:
      "Jeder Rad-Ort trägt bis zu vier Merkmale. In der Liste stehen sie als Symbole, im Detail und auf der Karte mit Text. Auch sie sind redaktionell: Sie sagen, was vor Ort auffällt, und sind keine gezählten Werkstätten oder Hotels.",
  },
  townsAsBase: {
    /** One reach band with its limit: „vor der Tür" bis 15 km. */
    bandItem: '„{label}" bis {km} km',
    /** `list` joins the `bandItem`s, `maxKm` is where the list ends. */
    bands:
      "**Drei Entfernungen statt eines Radius.** {list}. Jenseits von {maxKm} km endet die Liste. Innerhalb davon zählt Nähe gleitend: ein Pass wird nicht bei einem runden Kilometerwert wertlos, sondern verliert mit der Entfernung an Gewicht. Die Reihenfolge entsteht daraus zusammen mit Zustand, Schönheit und Bekanntheit – ein schöner Pass etwas weiter weg steht deshalb vor einem unscheinbaren vor der Haustür.",
    heading: "Orte als Standort",
    intro:
      "Ein Ort hat keine eigene Klimareihe und keine eigene Saison. Was er hat, sind die Pässe, die er erreicht – und die sind schon bewertet. Alles, was das Ortsdetail zeigt, ist daraus **abgeleitet** und sagt das auch: die Zahl gut befahrbarer Pässe, der Balken darunter und der Streifen aus 24 Zellen.",
    /** The two shares arrive as percentages, "80 %" and "50 %". */
    stripMeasures:
      "**Der Streifen zeigt die Saison, nicht die Größe.** Er misst jeden Halbmonat an der besten Zeit _dieses_ Orts: ab {best} davon „beste Zeit“, ab {good} „gut“, darunter „eingeschränkt“, ohne einen befahrbaren Pass „gesperrt“. Sonst hätte ein großer Ort von Juni bis Oktober durchgehend die höchste Stufe und ein kleiner nie – der Streifen würde die Größe des Orts zeigen statt seines Jahres. Wie viel es überhaupt ist, steht daneben in Worten. Die beiden Anteile sind redaktionell wie alle Zahlen hier; `scripts/analyze-destinations.ts` rechnet sie nach.",
  },
  types: {
    heading: "Art und Merkmale",
    intro:
      "Die **Art** sagt, wie die Straße im Gelände liegt – jede Straße hat genau eine. Die **Merkmale** sagen, wie sich das Fahren dort anfühlt; eine Straße trägt keines, eines oder mehrere. Auch sie sind redaktionelle Labels, keine gezählten Werte: Was die Daten messen – Länge, Steigung, Höhe, Grenzübertritt – steht als Zahl daneben und nicht hier.",
  },
} as const;
