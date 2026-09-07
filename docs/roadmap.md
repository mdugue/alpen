# Roadmap

Nach Aufwand-Nutzen sortiert. Jeder Punkt nennt, was konkret zu tun ist.

## 1. Amtlicher Live-Sperrstatus

Ersetzt die Heuristik dort, wo echte Daten vorliegen.

- Quellen: Südtirol (Open Data Hub, JSON, sauber), Trentino (HTML),
  alpen-paesse.ch bzw. TCS (HTML), Bison Futé und Departements-Seiten (HTML),
  ÖAMTC/ASFINAG (JSON hinter App-API). Keine erlaubt Direktzugriff aus dem
  Browser (kein CORS).
- Umsetzung: ein Schritt in `scripts/build-data.ts` oder ein eigener
  Cron-Job, der stündlich normalisiert nach
  `data/generated/closures.json` schreibt: `{ [passSlug]: { state, since, source, url } }`.
  Auf Vercel als Cron Function (`vercel.json` → `crons`) plus
  `revalidateTag("closures")`.
- In `lib/status.ts` eine Schicht davor: liegt ein aktueller Eintrag vor,
  gewinnt er; sonst die Heuristik. Herkunft im Detailpanel anzeigen.
- Aufwand: ein Nachmittag für Südtirol, je ein bis zwei Stunden pro weiterer
  Quelle, dauerhafte Pflege, weil sich HTML-Seiten ändern.

## 2. Verkehr aus Daten statt aus Bauchgefühl

Overpass-Abfrage entlang der gerouteten Auffahrt: Anteil der Straßenklassen
(`trunk`/`primary`/`secondary`/`tertiary`/`unclassified`) plus
`motor_vehicle=no`. Ergibt einen berechneten Wert je Auffahrt; die redaktionelle
Schätzung bleibt als Korrektur. Läuft in `data:build`, kostet nichts.

## 3. Schwierigkeit aus dem Profil

`profiles.json` enthält alles Nötige: Länge, Ø-Steigung, Steilstücke,
Gipfelhöhe. Eine Formel im Stil von climbbybike ersetzt die Schätzung, die
redaktionelle Zahl kann als „Charakter" bleiben.

## 4. Eigene Touren bauen und exportieren

Pässe in Reihenfolge anklicken → Route über OpenRouteService → km, hm, Profil →
GPX-Export für Garmin/Wahoo. Braucht eine Server-Route für das Routing (Key
bleibt serverseitig) und einen `use cache`-Eintrag pro Wegpunktfolge.

## 5. Gefahrene Pässe

GPX/FIT-Upload oder Strava-Anbindung, Abgleich mit den Passkoordinaten, Häkchen
in der Tabelle, Filter „noch offen und noch nicht gefahren". Die
Favoriten-Infrastruktur in `lib/app-state.ts` ist die Vorlage.

## 6. Weitere Regionen

Pyrenäen, Massif Central, Jura, Vogesen, Dolomiten-Ergänzungen. Rein additiv:
neue Einträge in `data/passes.json`, `data:build` nachziehen. Ab etwa 300 Pässen
lohnt eine Aufteilung der JSON-Dateien nach Region und ein Region-Filter.

## 7. Kleinere Verbesserungen

- Offline-Fähigkeit: Service Worker plus vorgehaltene Kacheln für eine Region.
- Bildmaterial je Pass (eigene Fotos oder Wikimedia mit Lizenzangabe).
- Etappenplaner für Mehrtagestouren mit Unterkunftsorten.
- Sortier- und Filterzustand ebenfalls in den URL-Hash.
- E2E-Tests (Playwright) für Auswahl, Filter und Hash-Wiederherstellung.
