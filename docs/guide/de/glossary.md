# Glossar

Kurze Erklärungen der Begriffe und Abkürzungen, die in der App und auf diesen
Seiten vorkommen – von „abgeleitet“ bis „zugeschneit“.

## A

- **abgeleitet** – ein Wert, den die App aus anderen Daten errechnet, statt
  ihn zu lesen. Beispiel: die Wärme im Tal, heruntergerechnet aus dem
  Klimawert am Passpunkt. Solche Werte tragen in der App immer den Zusatz
  „abgeleitet“, und der Ausgangswert bleibt daneben sichtbar.
- **Auffahrt** – ein klassischer Anstieg zu einer Straße, von einem Startort
  im Tal bis zum Passpunkt. Ein Pass hat meist zwei oder mehr Auffahrten,
  jede mit eigenem Straßenverlauf und Höhenprofil.

## B

- **Balkonstraße** – eine Straße, die in eine Felswand gehauen ist, ohne
  Gipfel, auf den die Fahrt zuläuft (etwa Combe Laval). Eine der fünf Arten
  einer Straße.
- **Bekanntheit** – redaktionelle Skala von 1 (kaum bekannt) bis 5 (Mythos),
  vor allem an der Geschichte der großen Rundfahrten und Klassiker gemessen.
  Sagt nichts über die Schwierigkeit.
- **Belag** – woraus die Fahrbahn einer Straße ist: Asphalt, Schotter oder
  gemischt (Asphalt mit einem Schotterstück, das kein Rennrad fährt). Jede
  Straße hat genau einen. Ungeteerte Straßen sind auf der Karte gestrichelt,
  schließen im Winter über die Schneedecke statt über eine Wintersperre, und
  der Filter „Belag“ schränkt die Liste auf einen Belag ein. Siehe Schotter.
- **beste Zeit** – die höchste Stufe des Status: der längste
  zusammenhängende Abschnitt des Jahres ohne Vorbehalt und mit weniger als
  10 % Schneefalltagen. Siehe [Skalen und Status](scales-and-status.md).

## C

- **Copernicus DEM** – ein weltweites digitales Geländemodell des
  europäischen Copernicus-Programms mit einem Raster von etwa 90 m. Die
  Höhenprofile beruhen darauf, abgefragt über Open-Meteo.

## E

- **eingeschränkt** – Stufe des Status: fahrbar, aber mit einem Haken, den
  ein Wort nennt – zugeschneit, Randzeit, Schnee, Frost, Höhe, Hitze, nass,
  kurze Tage oder kalte Abfahrt.
- **ERA5-Land** – ein Klimamodell des Europäischen Zentrums für
  mittelfristige Wettervorhersage (ECMWF), das das Wetter vergangener Jahre
  für jeden Tag auf einem Raster von rund 10 km nachrechnet. Die Klimareihe
  jedes Passes stammt daraus, für die Jahre 2015–2024.

## G

- **Gebirge** – die oberste Einteilung der Karte: Alpen, Jura, Vogesen und
  Pyrenäen, darunter die Regionen (etwa Westalpen oder Dolomiten).
  Vorgesehen ist ein Filter „Gebirge“, der auch den Kartenausschnitt auf das
  gewählte Gebirge rückt; er erscheint erst, wenn die Karte Straßen aus mehr
  als einem Gebirge enthält. Heute liegen alle in den Alpen.
- **Geländemodell** – ein Raster aus Höhenwerten, das die Erdoberfläche
  beschreibt, englisch „digital elevation model“ (DEM). Es kennt keine
  Straßen; auf engen Kehren oder in Schluchten rauscht es um einige Meter.
- **gemerkt** – mit dem Stern vorgemerkt: eine Straße, ein Reiseziel, eine
  Tour oder ein Ort. Gemerktes liegt nur im Speicher deines Browsers.
- **GeoJSON** – ein offenes Textformat für Geodaten wie Punkte und Linien.
  Die Karte lädt die Strecken aller Auffahrten und Touren als eine
  GeoJSON-Datei.
- **Grundkarte** – die Karte unter den Pässen und Strecken. Standard ist
  eine Vektorkarte von OpenFreeMap in den Farben der App; andere lassen sich
  wahlweise einblenden.

## H

- **Halbmonat** – die Zeiteinheit der App: Anfang (1. bis 15.) oder Ende
  (16. bis Monatsende) eines Monats, 24 im Jahr. Alle Bewertungen gelten für
  den gewählten Halbmonat.
- **Heuristik** – eine begründete Faustregel statt einer Messung. Der Status
  ist eine Heuristik aus Öffnungsfenster, Klimamitteln und Tageslicht, keine
  amtliche Auskunft.
- **Höhenmeter (hm)** – die Summe aller Anstiege entlang einer Strecke, in
  Metern. Aus dem Geländemodell berechnet und geglättet, also ein Richtwert.
- **Höhenprofil** – die Höhe entlang einer Auffahrt, hier aus rund 100
  Punkten des Geländemodells. Gut zum Vergleichen, nicht metergenau.
- **Höhenstraße** – eine Straße, die oben bleibt, statt einmal überzuqueren:
  Hochebene oder Höhenweg. Eine der fünf Arten einer Straße.

## K

- **Klimareihe** – die zehnjährige Wetterreihe eines Passes (ERA5-Land,
  2015–2024), zu 24 Halbmonaten gemittelt: Tageshöchst- und
  Tiefsttemperatur sowie die Anteile der Tage mit Neuschnee, mit Frost und
  mit Niederschlag.

## M

- **Merkmal** – ein redaktionelles Label, das sagt, wie sich eine Straße
  fährt („Panoramastraße“, „Maut“, „Autofrei“ …) oder warum ein Ort in der
  Liste steht („Radsport-Mekka“, „Bahnanschluss“ …). Kein gezählter Wert.

## O

- **Öffnungsfenster** – die Halbmonate, in denen ein Pass typischerweise
  offen ist, von Hand eingetragen. Außerhalb davon heißt der Status „oft
  gesperrt“. Straßen, die ganzjährig geräumt werden, haben keines. Manche
  Rundtouren haben ein eigenes, das die Zeit ihrer Pässe enger fasst.
- **oft gesperrt** – Stufe des Status: außerhalb des typischen
  Öffnungsfensters, meist wegen der Wintersperre, oder auf einer ungeteerten
  Straße unter einer Schneedecke. Auf der Karte ein hohler Kreis.
- **OpenFreeMap** – ein freier Dienst für Vektorkacheln aus
  OpenStreetMap-Daten. Liefert die Grundkarte.
- **Open-Meteo** – ein Wetterdienst mit offener Schnittstelle. Liefert hier
  Höhenprofile, Klimareihen und die Wettervorhersage.
- **OpenRouteService (ORS)** – ein Routing-Dienst auf OpenStreetMap-Daten.
  Berechnet mit einem Rennradprofil den Straßenverlauf der Auffahrten und
  Touren, auf ungeteerten Straßen mit einem Mountainbike-Profil.
- **OpenStreetMap (OSM)** – die freie, gemeinschaftlich gepflegte
  Weltkarte, auf der Grundkarte und Routing aufbauen.
- **Ort** – ein möglicher Standort für die Hotelsuche, etwa ein Radort mit
  Werkstätten und Bike-Hotels oder ein Ort mit mehreren Anstiegen vor der
  Tür. Orte haben keinen eigenen Reiter; sie stehen in der Liste unter ihrem
  Reiseziel oder unter „Weitere Orte“.
- **OSRM** – Open Source Routing Machine, ein Routing-Dienst mit Autoprofil.
  Springt ein, wenn OpenRouteService nicht verfügbar ist; solche Strecken
  werden später neu berechnet.
- **Overpass** – eine Abfrageschnittstelle für OpenStreetMap-Daten. Mit ihr
  wird geprüft, ob ein Passpunkt an einer befahrbaren Straße liegt.

## P

- **Pass** – eine Straße über einen Übergang: auf der einen Seite hinauf,
  auf der anderen hinunter. Im weiteren Sinn jeder Eintrag der Liste
  „Straßen“.
- **Passpunkt** – der eingetragene Punkt einer Straße, meist die Passhöhe.
  Seine Höhe ist die Höhe, für die Klima und Wettervorhersage gelten.

## Q

- **Qualitätsprüfung** – die Prüfung, die jede geroutete Strecke bestehen
  muss, bevor sie gespeichert wird: Länge, Start, Ende, höchster Punkt und
  Höhenmeter. Siehe [Der Weg der Daten](data-journey.md).

## R

- **Rampe** – ein kurzes, besonders steiles Stück einer Auffahrt. Siehe
  Steigung.
- **Randzeit** – der erste oder letzte Halbmonat im Öffnungsfenster. Weil
  sich Öffnung und Sperrung je nach Winter um Wochen verschieben, gilt er als
  „eingeschränkt“.
- **Reichweite** – was von einem Ort aus erreichbar ist, in drei Stufen:
  „vor der Haustür“ (bis 18 km), „Tagesrunde“ (bis 45 km) und „Ausflug“ (bis
  75 km), gemessen als Luftlinie.
- **Reiseziel** – ein Radgebiet wie das Oisans oder das Engadin: ein von Hand
  gezogener Kreis um ein Tal oder Massiv mit den Straßen, Touren und Orten
  darin und zwei Sätzen dazu, wie es sich dort fährt. Die Liste „Reiseziele“
  reiht die Gebiete nach dem gewählten Halbmonat, bis zu drei lassen sich
  nebeneinander vergleichen. Status und Saisonstreifen sind aus den Straßen
  des Gebiets abgeleitet. Auf der Karte eine hellblaue Umrandung.
- **Rundtour** – eine Runde über mehrere Pässe, etwa die Sellaronda. Ihr
  Status ist der ihres am stärksten eingeschränkten Passes.

## S

- **Saisonband** – der Zeitregler am unteren Rand. Er zeigt für die Pässe der
  aktuellen Auswahl je Halbmonat das mittlere Tagesmaximum, die häufigste
  Stufe und den Anteil der Tage mit Schneefall.
- **Saisonstreifen** – 24 Zellen, eine je Halbmonat, jede in der Farbe ihrer
  Stufe: das Jahr einer Straße, einer Tour, eines Reiseziels oder eines Orts
  auf einen Blick. Bei Reisezielen und Orten ist er abgeleitet.
- **Schneedecke** – Schnee, der liegen bleibt, im Unterschied zu frisch
  gefallenem Neuschnee. Sie entscheidet, wann eine ungeteerte Straße
  „zugeschneit“ oder „oft gesperrt“ ist.
- **Schönheit** – redaktionelle Skala von 1 (Waldstraße ohne Aussicht) bis 5
  (Hochgebirgskulisse mit spektakulärer Straße).
- **Schotter** – ungeteerte Straße: Militärstraße, Almweg, eher für Gravel-
  oder Mountainbike. Einer der drei Beläge. Niemand räumt sie; sie ist
  offen, sobald der Schnee weg ist.
- **Schwierigkeit** – redaktionelle Skala von 1 (kurz oder flach) bis 5 (über
  1.000 Höhenmeter mit Rampen über 10 %, oder sehr lang und hoch).
- **Status** – wie gut es ist, eine Straße im gewählten Halbmonat zu fahren,
  in vier Stufen: beste Zeit, gut, eingeschränkt, oft gesperrt. Eine
  Heuristik, keine amtliche Sperrauskunft.
- **Steigung** – das Verhältnis von Höhengewinn zu Strecke, in Prozent. Die
  App nennt je Auffahrt die durchschnittliche Steigung und den steilsten
  Kilometer; Letzterer ist eine Schätzung aus dem Geländemodell.
- **Stichstraße** – ein Anstieg zu einem Punkt, an dem die Straße endet;
  hinunter geht es dieselbe Auffahrt zurück. Eine der fünf Arten einer
  Straße.

## T

- **Talstraße** – ein ruhiges Sackgassental mit wenig Steigung. Eine der
  fünf Arten einer Straße.

## V

- **Verkehr** – redaktionelle Skala von 1 (fast autofrei oder Sackgasse) bis
  5 (Durchgangsstraße). Hier ist die niedrige Zahl die bessere.

## W

- **Wikimedia Commons** – die freie Mediensammlung der Wikimedia-Projekte.
  Die Fotos der Detailansicht stammen von dort, jeweils mit Urheber und
  Lizenz.
- **Wintersperre** – die Zeit, in der eine Passstraße wegen Schnee
  geschlossen ist. In der App steckt sie im Öffnungsfenster; ob eine Straße
  gerade wirklich gesperrt ist, sagt die App nicht.

## Z

- **zugeschneit** – das Wort einer eingeschränkten Zelle auf einer
  ungeteerten Straße, wenn an mindestens 20 % der Tage mindestens 10 cm
  Schnee liegen; ab 50 % ist die Straße „oft gesperrt“. Siehe [Skalen und
  Status](scales-and-status.md).
