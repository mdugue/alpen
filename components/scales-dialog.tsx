"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SCALES: [string, string][] = [
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
];

export function ScalesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Skalen &amp; Quellen</DialogTitle>
          <DialogDescription>
            Wie die 1–5-Bewertungen und der Status je Zeitraum zustande kommen –
            und woher die Daten stammen.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 text-sm">
          <section className="flex flex-col gap-2">
            <h3 className="text-base font-semibold">
              Woher kommen die 1–5-Bewertungen?
            </h3>
            <p className="text-muted-foreground">
              Redaktionelle Einschätzungen aus dem allgemeinen Ruf der Pässe
              (Radsport-Literatur, Grand-Tour-Historie, quaeldich.de,
              climbbybike, Cyclingcols). Keine gemessenen Werte, keine
              Nutzerbewertungen – zur groben Einordnung, nicht zum
              Punktevergleich.
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              {SCALES.map(([term, text]) => (
                <div key={term} className="contents">
                  <dt className="font-semibold">{term}</dt>
                  <dd className="text-muted-foreground">{text}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-base font-semibold">Status je Zeitraum</h3>
            <p className="text-muted-foreground">
              Heuristik aus typischem Öffnungsfenster (halbmonatsgenau),
              Passhöhe und Jahreszeit. Bewirtschaftete Mautstraßen bekommen
              keinen Höhenabschlag. Für Rundtouren gilt der schlechteste Status
              ihrer Pässe. Ersetzt keine amtliche Sperrauskunft.
            </p>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-base font-semibold">Kartensymbole</h3>
            <p className="text-muted-foreground">
              <b>Kreis:</b> Pass – Farbe zeigt den Status, hohler Kreis = oft
              gesperrt, Größe = Bekanntheit. <b>Stern:</b> gemerkt.{" "}
              <b>Linie:</b> Rundtour (eigene Farbe) oder Auffahrt (Statusfarbe).{" "}
              <b>Raute:</b> Rad-Ort.
            </p>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-base font-semibold">Daten</h3>
            <p className="text-muted-foreground">
              <b>Höhenprofil:</b> Open-Meteo Elevation (Copernicus DEM 90 m)
              entlang der gerouteten Straße. <b>Wetter:</b>{" "}
              Open-Meteo-Vorhersage auf Passhöhe, serverseitig
              zwischengespeichert. <b>Klima:</b> Open-Meteo-Archiv (ERA5-Land
              2015–2024) je Halbmonat; 10-km-Raster, auf Passhöhe tendenziell zu
              mild. <b>Routen:</b> OpenRouteService (Rennrad-Profil) oder OSRM.{" "}
              <b>3D:</b> Mapzen/AWS Terrain Tiles. Karten ©
              OpenStreetMap-Mitwirkende.
            </p>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-base font-semibold">Hinweise</h3>
            <p className="text-muted-foreground">
              Höhen und Auffahrtsdaten sind gerundete Richtwerte. Schönheit,
              Bekanntheit, Schwierigkeit und Verkehr sind redaktionelle
              1–5-Einschätzungen. Der Status je Zeitraum ist eine Heuristik und
              ersetzt keine amtliche Sperrauskunft. Die App dient der groben
              Routenplanung, nicht der Navigation.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
