# Glossar

Kurze Erklärungen der Begriffe und Abkürzungen, die in der App und auf diesen
Seiten vorkommen – von „abgeleitet“ bis „Wintersperre“.

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
- **beste Zeit** – die höchste Stufe des Status: der längste
  zusammenhängende Abschnitt des Jahres ohne Vorbehalt und mit weniger als
  10 % Schneefalltagen. Siehe [Skalen und Status](scales-and-status.md).

## C

- **Copernicus DEM** – ein weltweites digitales Geländemodell des
  europäischen Copernicus-Programms mit einem Raster von etwa 90 m. Die
  Höhenprofile beruhen darauf, abgefragt über Open-Meteo.

## E

- **eingeschränkt** – Stufe des Status: fahrbar, aber mit einem Haken, den
  ein Wort nennt – Randzeit, Schnee, Frost, Höhe, Hitze, nass, kurze Tage
  oder kalte Abfahrt.
- **ERA5-Land** – ein Klimamodell des Europäischen Zentrums für
  mittelfristige Wettervorhersage (ECMWF), das das Wetter vergangener Jahre
  für jeden Tag auf einem Raster von rund 10 km nachrechnet. Die Klimareihe
  jedes Passes stammt daraus, für die Jahre 2015–2024.

## G

- **Geländemodell** – ein Raster aus Höhenwerten, das die Erdoberfläche
  beschreibt, englisch „digital elevation model“ (DEM). Es kennt keine
  Straßen; auf engen Kehren oder in Schluchten rauscht es um einige Meter.
- **gemerkt** – mit dem Stern vorgemerkt. Gemerktes liegt nur im Speicher
  deines Browsers.
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
  offen ist, von Hand eingetragen. Nur außerhalb davon heißt der Status „oft
  gesperrt“. Straßen, die ganzjährig geräumt werden, haben keines.
- **oft gesperrt** – Stufe des Status: außerhalb des typischen
  Öffnungsfensters, meist wegen der Wintersperre. Auf der Karte ein hohler
  Kreis.
- **OpenFreeMap** – ein freier Dienst für Vektorkacheln aus
  OpenStreetMap-Daten. Liefert die Grundkarte.
- **Open-Meteo** – ein Wetterdienst mit offener Schnittstelle. Liefert hier
  Höhenprofile, Klimareihen und die Wettervorhersage.
- **OpenRouteService (ORS)** – ein Routing-Dienst auf OpenStreetMap-Daten.
  Berechnet mit einem Rennradprofil den Straßenverlauf der Auffahrten und
  Touren.
- **OpenStreetMap (OSM)** – die freie, gemeinschaftlich gepflegte
  Weltkarte, auf der Grundkarte und Routing aufbauen.
- **Ort** – ein möglicher Standort für die Hotelsuche, etwa ein Radort mit
  Werkstätten und Bike-Hotels oder ein Ort mit mehreren Anstiegen vor der
  Tür.
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
- **Rundtour** – eine Runde über mehrere Pässe, etwa die Sellaronda. Ihr
  Status ist der ihres am stärksten eingeschränkten Passes.

## S

- **Saisonband** – der Zeitregler am unteren Rand. Er zeigt für die Pässe der
  aktuellen Auswahl je Halbmonat das mittlere Tagesmaximum, die häufigste
  Stufe und den Anteil der Tage mit Schneefall.
- **Saisonstreifen** – 24 Zellen, eine je Halbmonat, jede in der Farbe ihrer
  Stufe: das Jahr einer Straße, Tour oder eines Orts auf einen Blick.
- **Schönheit** – redaktionelle Skala von 1 (Waldstraße ohne Aussicht) bis 5
  (Hochgebirgskulisse mit spektakulärer Straße).
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
