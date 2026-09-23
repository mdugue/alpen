# Skalen und Status

Die 1–5-Bewertungen sind redaktionelle Einschätzungen, der Status je
Halbmonat ist eine Heuristik aus Öffnungsfenster, Klimamitteln und
Tageslicht, und was Orte und Reiseziele zeigen, ist aus ihren Straßen
abgeleitet. Beides hilft beim Vergleichen, ersetzt aber keine amtliche
Auskunft.

## Die vier Skalen

Jede Straße trägt vier Bewertungen von 1 bis 5. Sie sind **redaktionelle
Einschätzungen** aus dem allgemeinen Ruf der Pässe (Radsport-Literatur,
Grand-Tour-Geschichte, quaeldich.de, climbbybike, Cyclingcols) – keine
gemessenen Werte und keine Nutzerbewertungen. Sie taugen zur groben
Einordnung, nicht zum Punktevergleich.

| Skala         | 1                            | 3                    | 5                                                                          |
| ------------- | ---------------------------- | -------------------- | -------------------------------------------------------------------------- |
| Bekanntheit   | kaum bekannt                 | in der Szene bekannt | Mythos (Galibier, Stelvio, Ventoux, Alpe d'Huez, Glockner)                 |
| Schönheit     | Waldstraße ohne Aussicht     | solide               | Hochgebirgskulisse mit spektakulärer Straße (Bonette, Iseran, Gavia, Giau) |
| Schwierigkeit | kurz oder flach              | normaler Alpenpass   | über 1.000 Höhenmeter mit Rampen über 10 %, oder sehr lang und hoch        |
| Verkehr       | fast autofrei oder Sackgasse | normaler Passverkehr | Durchgangsstraße (Simplon, Lautaret, Julier)                               |

Beim Verkehr ist 1 das Beste: Je niedriger, desto ruhiger. Sommerwochenenden
und Motorräder machen es überall schlechter.

Bekanntheit ist nicht Schwierigkeit. Der Poggio und die Cipressa aus
Mailand–Sanremo haben Bekanntheit 5 und Schwierigkeit 1. Maßstab für die
Bekanntheit ist die Geschichte der großen Rundfahrten und Klassiker.

## Art und Merkmale

Auch die **Art** einer Straße und ihre **Merkmale** sind redaktionelle
Labels, keine gezählten Werte.

- Die **Art** sagt, wie die Straße im Gelände liegt, und jede Straße hat
  genau eine: Pass, Stichstraße, Höhenstraße, Balkonstraße oder Talstraße.
  Sie entscheidet auch, wie die Qualitätsprüfung eine Strecke misst (siehe
  [Der Weg der Daten](data-journey.md)).
- Die **Merkmale** sagen, wie sich das Fahren dort anfühlt – etwa
  „Panoramastraße“, „Gletscherstraße“, „Autofrei“, „Maut“, „Kehrenbauwerk“,
  „Pflaster“ oder „Tunnel & Galerien“. Eine Straße trägt keines, eines oder
  mehrere. Bei „Maut“ sagt die Notiz, ob Räder zahlen; ob eine Mautstraße im
  Winter geräumt wird, ist davon unabhängig.
- Der **Belag** – Asphalt, Schotter oder gemischt – ist kein Merkmal, sondern
  eine eigene Angabe, die jede Straße genau einmal hat. Er entscheidet, mit
  welchem Profil die Strecke berechnet wird, wie die Straße im Winter
  schließt (siehe unten) und dass sie auf der Karte gestrichelt ist.
  „Pflaster“ ist ein Merkmal, kein Belag: Pflaster ändert die Reifenwahl,
  nicht das Rad. Auf ungeteerten Straßen gelten die vier Skalen innerhalb
  dieser Disziplin; in die Schwierigkeit geht der Belag mit ein.

Was die Daten messen – Länge, Steigung, Höhe, ein Grenzübertritt –, steht als
Zahl daneben und ist nie ein Merkmal. Dasselbe gilt für die Merkmale der Orte
(„Radsport-Mekka“, „Werkstätten & Verleih“, „Ruhig“, „Lange Saison“ …): Sie
sagen, was bei der Ankunft auffällt, und zählen keine Werkstätten oder Hotels.
Die vollständigen Listen mit ihren Erklärungen stehen in der App im Dialog
„Skalen & Quellen“.

## Der Status je Halbmonat

Der Status beantwortet die Frage „Wie gut ist es, dort in diesem Halbmonat zu
fahren?“ – nicht nur „Kommt man drüber?“. Er ist eine **Heuristik**, also
eine begründete Faustregel aus dem typischen Öffnungsfenster, der Höhe des
Passes, seiner Klimareihe und dem Tageslicht. Ob eine Straße heute gesperrt
ist, sagt er nicht.

### Vier Stufen

| Stufe         | Bedeutung                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| beste Zeit    | der längste zusammenhängende Abschnitt ohne Vorbehalt und mit wenig Schneefall                                           |
| gut           | nichts spricht gegen die Fahrt; nur ein kürzerer Abschnitt, oder es schneit gelegentlich                                 |
| eingeschränkt | fahrbar, aber mit einem Haken, der in einem Wort genannt wird                                                            |
| oft gesperrt  | die Straße ist in dieser Zeit meist zu – wegen der Wintersperre, oder auf einer ungeteerten Straße wegen der Schneedecke |

Auf der Karte, im Filter und in der Adresszeile gibt es nur drei Werte:
„beste Zeit“ und „gut“ sind dort zusammen „gut“.

### Wie eine Zelle entsteht

1. **Das Öffnungsfenster entscheidet über „oft gesperrt“.** Für jeden Pass
   ist von Hand eingetragen, von welchem bis zu welchem Halbmonat er
   typischerweise offen ist. Außerhalb davon ist er „oft gesperrt“ – und nur
   dort: Schneefall, Hitze oder kurze Tage machen eine Straße nie „gesperrt“,
   sie machen sie nur weniger ratsam. Der erste und der letzte Halbmonat im
   Fenster sind „eingeschränkt“ mit dem Wort **Randzeit**, weil sich Öffnung
   und Sperrung je nach Winter um Wochen verschieben. Die eine Ausnahme sind
   ungeteerte Straßen (siehe [Schotter](#schotter-die-schneedecke-statt-der-wintersperre)).
2. **Jedes weitere Signal kann eine Zelle nur senken, nie heben.** Schlägt
   eines an, wird aus „gut“ ein „eingeschränkt“.
3. **Das erste Signal in einer festen Reihenfolge ist das Wort.** Die Zelle
   trägt es als Kurzwort; die Detailansicht nennt alle angeschlagenen Signale,
   jedes in einem Satz mit seiner Zahl und ihrer Herkunft.
4. **„Beste Zeit“ ist der längste zusammenhängende Abschnitt** von
   „gut“-Halbmonaten mit weniger als 10 % Schneefalltagen, mindestens zwei
   Halbmonate lang. Die übrigen „gut“-Halbmonate bleiben „gut“.

Die Signale in ihrer Reihenfolge, mit den Werten, die heute gelten:

| Wort          | schlägt an, wenn …                                                                            |
| ------------- | --------------------------------------------------------------------------------------------- |
| zugeschneit   | nur auf ungeteerten Straßen: an mindestens 20 % der Tage mindestens 10 cm Schnee liegen       |
| Schnee        | an mindestens 20 % der Tage mindestens 1 cm Neuschnee fällt                                   |
| Frost         | mindestens 80 % der Nächte unter 0 °C liegen                                                  |
| Höhe          | ein hoher Pass in den Randmonaten liegt: Schnee und Eis sind möglich, auch bei offener Straße |
| Hitze         | das Tagesmaximum im Tal im Schnitt 26 °C oder mehr beträgt (abgeleitet, siehe unten)          |
| nass          | es an mindestens 70 % der Tage mindestens 1 mm regnet                                         |
| kurze Tage    | zwischen Sonnenauf- und -untergang weniger als 10,75 Stunden liegen                           |
| kalte Abfahrt | das Tagesmaximum am Gipfel im Schnitt unter 8 °C bleibt                                       |

„Höhe“ ist eine Kalenderregel ohne Klimawert: Sie gilt für Pässe ab 1.800 m
im Frühjahr und im Herbst, für hohe Pässe länger als für niedrigere, und für
ganzjährig geräumte Straßen jeder Höhe von Dezember bis Februar.
Bewirtschaftete Mautstraßen, die geräumt werden, bekommen sie nicht.

Die Zahlen sind keine Naturkonstanten. Sie stehen an einer Stelle im Code
(`SIGNALS` in [lib/status.ts](../../../lib/status.ts)), wurden an den
Klimareihen der Pässe abgestimmt, und der Dialog „Skalen & Quellen“ in der
App liest seinen Text aus derselben Tabelle. Die genauen Schwellen und ihre
Begründung stehen in [scales.md](../../scales.md) (englisch).

### Schotter: die Schneedecke statt der Wintersperre

Eine ungeteerte Straße – Belag Schotter oder gemischt – räumt niemand. Sie
ist offen, sobald der Schnee weg ist, und schließt nicht an einer Schranke.
Statt einer Wintersperre entscheidet bei ihr deshalb die **Schneedecke**:
Liegen an mindestens 50 % der Tage eines Halbmonats mindestens 10 cm Schnee,
ist sie „oft gesperrt“; ab 20 % ist sie „eingeschränkt“ mit dem Wort
**zugeschneit**. Das ist etwas anderes als das Signal „Schnee“, das
frisch gefallenen Schnee zählt.

Die Schneehöhe steht bisher in keiner gespeicherten Klimareihe. Solange sie
fehlt, wird eine ungeteerte Straße nur nach den übrigen Signalen bewertet und
nie als gesperrt gezeigt – der Streifen zeigt dann, was bekannt ist, statt
eine Sperre zu raten. Auch die beiden Anteile sind vorläufig gesetzt.

### Rundtouren

Eine Rundtour hat keine eigene Klimareihe. Für jeden Halbmonat übernimmt sie
die Zelle des Passes, der sie am stärksten einschränkt – mit Farbe, Wort und
Hinweis aus diesem einen Pass. Die Detailansicht nennt die Pässe, die die
Tour zurückhalten. „Beste Zeit“ hat eine Tour nur dort, wo alle ihre Pässe
in ihrer besten Zeit sind.

Manche Touren tragen zusätzlich ein eigenes, von Hand eingetragenes
Fenster, etwa „typisch Anfang Juni bis Anfang Oktober“. Es wird gelesen wie
das eines Passes: außerhalb „oft gesperrt“, im ersten und letzten Halbmonat
„eingeschränkt“ (Randzeit), dazwischen entscheiden die Pässe. Das Fenster
kann die Zeit der Pässe nur enger fassen, nie erweitern. Touren ohne eigenes
Fenster sind fahrbar, solange ihre Pässe offen sind.

## Die Klimagrundlage

Alle Klimasignale lesen die **Klimareihe** des Passes: zehn Jahre
(2015–2024) aus dem Open-Meteo-Archiv, auf die Höhe des Passpunkts
umgerechnet und zu 24 Halbmonaten gemittelt (siehe [Woher die Daten
kommen](data-sources.md)). Sie beschreibt das Wetter am Passpunkt im
Durchschnitt der Jahre – keine Vorhersage, und ein einzelnes Jahr kann weit
davon abweichen. Ein Anteil wie „20 % der Tage“ entspricht etwa 3 von 15
Tagen eines Halbmonats. Das Modellraster ist 9 bis 25 km grob; auf Passhöhe
fällt die Reihe eher zu mild aus.

### Abgeleitet: die Wärme im Tal

Hitze ist ein Problem im Tal, gemessen wird aber nur am Passpunkt. Die App
rechnet das Tagesmaximum des Gipfels deshalb mit 0,65 °C je 100 m bis zum
tiefsten Beginn einer Auffahrt herunter. Das ist ein Modell, keine Messung:
Inversionen, Föhn und die eigene Wärme eines Talbodens stecken nicht darin,
der Wert liegt gut ± 3 °C daneben, und bei den höchsten Pässen fällt er eher
zu niedrig aus. Die App schreibt deshalb überall, wo er erscheint,
**abgeleitet** dazu. Für Pässe ohne Höhenprofil gibt es keinen Talwert und
damit kein Hitzesignal.

### Tageslicht

Tageslänge, Sonnenauf- und -untergang sind reine Astronomie aus der Lage
des Passes, berechnet für die Mitte des Halbmonats und in
mitteleuropäischer Uhrzeit angegeben. Weil die Zeitumstellung Ende Oktober
mitten in einen Halbmonat fällt, steht dort beim Sonnenuntergang „gegen“.

## Orte: abgeleitet aus ihren Pässen

Ein Ort hat keine eigene Klimareihe und keine eigene Saison. Was er hat,
sind die Pässe in seiner Reichweite, und die sind bereits bewertet. Alles,
was die Detailansicht eines Orts zeigt, ist daraus **abgeleitet**.

### Reichweite

| Stufe           | bis   |
| --------------- | ----- |
| vor der Haustür | 18 km |
| Tagesrunde      | 45 km |
| Ausflug         | 75 km |

Gemessen wird die Luftlinie zum Passpunkt. Jenseits von 75 km endet die
Liste. Innerhalb davon zählt Nähe gleitend: Ein Pass verliert mit der
Entfernung an Gewicht, statt an einer Grenze plötzlich wegzufallen. Die
Reihenfolge innerhalb einer Stufe entsteht aus dem Status im gewählten
Halbmonat, aus Schönheit und Bekanntheit und aus dieser Nähe. Der Status
wiegt am schwersten – ein gesperrter Pass ist kein Grund für einen Standort,
wie schön er auch ist.

### Der Saisonstreifen eines Orts

Der Streifen eines Orts misst jeden Halbmonat an der **besten Zeit dieses
Orts**, nicht an einer festen Zahl. Gezählt werden die Pässe in Reichweite,
die „gut“ oder „beste Zeit“ sind:

| Stufe         | wenn …                                                    |
| ------------- | --------------------------------------------------------- |
| beste Zeit    | mindestens 75 % so viele wie im besten Halbmonat des Orts |
| gut           | mindestens 45 % so viele                                  |
| eingeschränkt | weniger, aber wenigstens einer                            |
| oft gesperrt  | kein einziger                                             |

Mit einer festen Zahl hätte ein großer Ort von Juni bis Oktober durchgehend
die höchste Stufe und ein kleiner nie – der Streifen zeigte die Größe des
Orts statt seines Jahres. Wie viel es insgesamt ist, steht deshalb in Worten
daneben: wie viele Pässe im Umkreis zur besten Zeit, gut oder eingeschränkt
sind. Die beiden Anteile sind redaktionell gesetzt wie alle Zahlen hier.

## Reiseziele: abgeleitet aus ihren Straßen

Auch ein Reiseziel hat keine eigene Klimareihe. Es wird bewertet wie ein
Ort, nur über seine eigenen Straßen statt über eine Reichweite: Welche
Straßen dazugehören, entscheidet der von Hand gezogene Kreis um die
Gebietsmitte, mit einzelnen Straßen, die redaktionell dazugezählt oder
ausgenommen sind. Nähe spielt keine Rolle – jede Straße im Gebiet zählt
einmal. Der Saisonstreifen misst jeden Halbmonat an der besten Zeit **dieses
Gebiets**, mit denselben Anteilen wie beim Ort (75 % und 45 %), und die
Detailansicht nennt die Zahl in Worten dazu.

Die Liste der Reiseziele ist nach einer Punktzahl gereiht, die nie angezeigt
wird: die Schönheit jeder im gewählten Halbmonat gut befahrbaren Straße,
zwei Fünftel davon für eine eingeschränkte, nichts für eine oft gesperrte.
Ein Gebiet mit vielen schönen, offenen Straßen steht also oben. Auch diese
Gewichtung ist redaktionell gesetzt, und sie wird nachjustiert, sobald die
App eine echte Reise geplant hat. Was ein Reiseziel ist und wie sein Kreis
gezogen wird, steht in [destinations.md](../../destinations.md) (englisch).

## Was das alles nicht ist

- **Keine amtliche Sperrauskunft.** Ob ein Pass heute offen ist, sagen
  Straßenverwaltungen und Verkehrsdienste. Echte Sperrdaten sollen den Status
  später dort ersetzen, wo es sie gibt; die Heuristik bleibt dann der
  Rückfall (siehe [roadmap.md](../../roadmap.md), englisch).
- **Keine Wettervorhersage.** Der Status beruht auf Mittelwerten aus zehn
  Jahren. Die aktuelle Vorhersage steht getrennt davon in der Detailansicht.
- **Keine Messwerte.** Skalen und Labels sind Einschätzungen, der Talwert ist
  abgeleitet, und alle Schwellen sind gesetzt und an den Daten abgestimmt,
  nicht gemessen.
