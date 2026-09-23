# Woher die Daten kommen

Die Karte verbindet von Hand gepflegte Einschätzungen mit offenen Daten aus
OpenStreetMap, Routing-Diensten, Open-Meteo und Wikimedia Commons. Diese
Seite sagt, was aus welcher Quelle stammt.

## Von Hand gepflegt

Der Kern der App ist redaktionell: drei von Hand gepflegte Dateien für
Straßen, Rundtouren und Orte. Aus ihnen stammen

- Name, weitere gebräuchliche Namen, Land und Region,
- die Lage des Passpunkts und seine Höhe, die Startpunkte der Auffahrten,
- die vier Bewertungen von 1 bis 5 (Bekanntheit, Schönheit, Schwierigkeit,
  Verkehr), die Art der Straße und ihre Merkmale,
- das **typische Öffnungsfenster** eines Passes in Halbmonaten, oder dass er
  ganzjährig geräumt wird,
- eine kurze Notiz zu jeder Straße,
- bei Rundtouren die beteiligten Pässe, grobe Wegpunkte, Länge und
  Höhenmeter,
- bei Orten die Merkmale und ein Satz, warum der Ort in der Liste steht.

Die Bewertungen beruhen auf dem allgemeinen Ruf der Pässe – Radsport-Literatur,
Grand-Tour-Geschichte, quaeldich.de, climbbybike und Cyclingcols. Sie sind die
Einschätzung einer Redaktion, keine Messwerte und keine Nutzerbewertungen;
keine automatische Prüfung kann eine falsche 4 finden. Mehr dazu unter
[Skalen und Status](scales-and-status.md).

## OpenStreetMap

[OpenStreetMap](https://www.openstreetmap.org) (OSM) ist die freie
Weltkarte, auf der fast alles Geografische hier aufbaut.

- **Beim Vorbereiten der Daten** fragen Skripte über die Overpass-Schnittstelle
  – bei deren Ausfall direkt bei openstreetmap.org – nach Passpunkten und
  befahrbaren Straßen in der Nähe. So wird geprüft, ob ein eingetragener
  Passpunkt wirklich an der Straße liegt, und ein besserer vorgeschlagen, wenn
  nicht. Eine Auswertung derselben Daten zeigt außerdem, welche Pässe rund um
  einen Ort noch nicht in der Liste stehen; aufgenommen wird daraus nichts
  automatisch, sondern nur von Hand.
- **Die Routing-Dienste** (unten) rechnen auf OSM-Daten.
- **Die Grundkarte** kommt von OpenFreeMap (unten) und ist ebenfalls aus OSM
  gebaut.

Die Karte nennt die Quelle unten in der Ecke hinter dem ⓘ, mit einem Link
auf die Lizenzhinweise von OpenStreetMap.

## Routing: OpenRouteService und OSRM

Der Straßenverlauf jeder Auffahrt und jeder Rundtour wird einmal von einem
Routing-Dienst berechnet und dann gespeichert.

- **OpenRouteService** mit einem Rennradprofil ist die erste Wahl. Es kennt
  auch Straßen, die für Autos gesperrt sind, oder Pflaster- und
  Schotterstücke.
- **OSRM**, ein öffentlicher Demo-Server mit Autoprofil, springt ein, wenn
  OpenRouteService nicht verfügbar ist. Ein Autoprofil kürzt manchmal anders
  ab als ein Radfahrer und meidet autofreie Straßen; solche Strecken werden
  vermerkt und später mit OpenRouteService neu berechnet. Heute stammen fast
  alle gespeicherten Strecken von OpenRouteService.

Bevor eine Strecke gespeichert wird, muss sie eine Qualitätsprüfung bestehen
– siehe [Der Weg der Daten](data-journey.md).

## Open-Meteo

[Open-Meteo](https://open-meteo.com) liefert drei Dinge.

### Höhenprofile

Entlang jeder gerouteten Auffahrt werden rund 100 Punkte an Open-Meteos
Höhendienst geschickt, der das Geländemodell Copernicus DEM (GLO-90, ein
Raster von etwa 90 m) abfragt. Daraus entstehen Höhenprofil, Höhenmeter,
durchschnittliche Steigung und der steilste Kilometer. Das Modell rauscht um
einige Meter; das Profil ist deshalb gut zum Vergleichen, aber nicht
metergenau, und der steilste Kilometer ist eine Schätzung.

### Klima

Für jeden Pass wird eine zehnjährige Tagesreihe (2015–2024) aus dem
Open-Meteo-Archiv abgerufen: ERA5-Land, auf die Höhe des Passpunkts
umgerechnet. Sie enthält Tageshöchst- und Tiefsttemperatur, Neuschnee und
Niederschlag. Daraus werden für jeden der 24 Halbmonate gebildet:

- das durchschnittliche Tagesmaximum und Tagesminimum,
- der Anteil der Tage mit mindestens 1 cm Neuschnee,
- der Anteil der Nächte unter 0 °C,
- der Anteil der Tage mit mindestens 1 mm Niederschlag.

ERA5-Land ist ein Modell mit einem Raster von rund 10 km, keine
Wetterstation. Einen einzelnen Sattel sieht es nicht, auf Passhöhe ist es
eher zu mild, und „Neuschnee“ heißt frisch gefallener Schnee, nicht Schnee,
der auf der Straße liegt.

### Wettervorhersage

Die Vorhersage für die nächsten sieben Tage auf Passhöhe (Höchst- und
Tiefsttemperatur, Niederschlag, Neuschnee, stärkster Wind und Wetterart) ist
das Einzige, das beim Ansehen der Karte abgefragt wird. Die Anfrage läuft über
den Server der App und wird dort eine Stunde lang je Pass zwischengespeichert;
dein Browser verbindet sich nicht selbst mit Open-Meteo.

## Wikimedia Commons

Die Fotos in der Detailansicht stammen von
[Wikimedia Commons](https://commons.wikimedia.org). Gesucht wird nach Bildern
im Umkreis von 2 km um einen Passpunkt (2,5 km um einen Ort) und nach
Dateien, die den Namen nennen. Offensichtliche Nicht-Fotos wie Schilder und
Karten werden über Name und Format aussortiert, der Rest nach Namensnähe und
Entfernung sortiert. Eine redaktionelle Auswahl gibt es dabei nicht. Rundtouren
haben keine eigenen Fotos, sie leihen sich die ihrer Pässe.

Gespeichert werden nur Angaben zum Bild: Adresse, Urheber, Lizenz und
Dateiseite. Das Bild selbst lädt dein Browser direkt von Wikimedia. Jedes
Foto nennt Urheber und Lizenz und verlinkt auf seine Dateiseite.

## Grundkarte und Relief

- **OpenFreeMap** liefert die Vektorkacheln der Grundkarte (im Schema von
  OpenMapTiles, gebaut aus OSM). Die App malt sie in ihren eigenen Farben, hell
  oder dunkel je nach Einstellung deines Betriebssystems. Die Karte nennt dazu
  „OpenFreeMap © OpenMapTiles, Daten von OpenStreetMap“.
- **AWS Terrain Tiles** (ursprünglich von Mapzen) liefern Schummerung und
  3D-Gelände; die Karte nennt sie als „Terrain © Mapzen/AWS“.
- **Andere Grundkarten** lassen sich wahlweise einblenden: OpenStreetMap,
  OpenTopoMap, CyclOSM, Esri Topo und Satellit sowie Waymarked Trails als
  Radrouten-Ebene. Thunderforest und MapTiler stehen nur zur Wahl, wenn die
  jeweilige Installation einen Schlüssel dafür hat. Jede dieser Karten trägt
  ihren eigenen Quellenhinweis.

Diese Kacheln lädt dein Browser direkt bei den Anbietern.

## Nur verlinkt, nicht abgefragt

Die Detailansicht verlinkt auf quaeldich.de, Komoot, Google Maps und
OpenStreetMap, bei Orten auf die Suche nach Werkstätten und Radläden. Von
diesen Seiten wird nie etwas abgerufen: Sie sind Ziele für dich, keine
Quellen für die App.

## Mehr dazu

Welche Quelle welche Frage beantwortet, was sie gut und was sie schlecht
kann und welche Kontingente gelten, steht ausführlich in
[data-pipeline.md](../../data-pipeline.md) (englisch).
