# Skalen und ihre Herkunft

Die vier 1–5-Skalen sind **redaktionelle Einschätzungen**, vergeben aus dem
allgemeinen Ruf der Pässe (Radsport-Literatur, Grand-Tour-Historie, Berichte auf
quaeldich.de, climbbybike, Cyclingcols). Es sind keine gemessenen Werte und
keine Nutzerbewertungen. Sie taugen zur groben Einordnung, nicht zum Vergleich
auf Punktebene. Der Skalen-Dialog in der App sagt das genauso – diese Ehrlichkeit
bitte beibehalten.

| Skala | 1 | 3 | 5 |
| --- | --- | --- | --- |
| **Bekanntheit** | kaum bekannt | in der Szene bekannt | Mythos (Galibier, Stelvio, Ventoux, Alpe d'Huez, Glockner) |
| **Schönheit** | Waldstraße ohne Aussicht | solide | Hochgebirgskulisse mit spektakulärer Straße (Bonette, Iseran, Gavia, Giau) |
| **Schwierigkeit** | kurz oder flach | normaler Alpenpass | > 1 000 hm mit Rampen über 10 % oder sehr lang und hoch |
| **Verkehr** | fast autofrei, Sackgasse | normaler Passverkehr | Durchgangsstraße (Simplon, Lautaret, Julier) |

Wer das objektivieren will: `difficulty` ließe sich aus `profiles.json`
berechnen (Länge, Ø-Steigung, Maximalrampe, Gipfelhöhe), `traffic` näherungsweise
aus den OSM-Straßenklassen entlang der gerouteten Auffahrt. Beides steht in
`docs/roadmap.md`.

## Status je Zeitraum

`passStatus()` in `lib/status.ts`:

1. Ohne `season` (ganzjährig geräumt): ab 2 300 m im Winterhalbjahr
   „wetterabhängig", ab 1 800 m etwas später, im Hochwinter generell.
2. Mit `season`: außerhalb des Fensters „oft gesperrt", im ersten und letzten
   halben Monat „wetterabhängig".
3. Zusätzlich ein Höhenabschlag im Rand des Fensters – außer bei
   `maintained: true`.

Das ist bewusst grob und ersetzt keine amtliche Auskunft. Die Funktion ist die
Stelle, an der später echte Sperrdaten andocken.
