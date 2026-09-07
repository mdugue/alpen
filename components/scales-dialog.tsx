"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skalen &amp; Quellen</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <h3 className="mb-1 text-base font-semibold">Woher kommen die 1–5-Bewertungen?</h3>
          <p className="mb-3 text-muted-foreground">
            Redaktionelle Einschätzungen aus dem allgemeinen Ruf der Pässe (Radsport-Literatur,
            Grand-Tour-Historie, quaeldich.de, climbbybike, Cyclingcols). Keine gemessenen Werte, keine
            Nutzerbewertungen – zur groben Einordnung, nicht zum Punktevergleich.
          </p>
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            {SCALES.map(([term, text]) => (
              <div key={term} className="contents">
                <dt className="font-semibold">{term}</dt>
                <dd className="text-muted-foreground">{text}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mb-1 text-base font-semibold">Status je Zeitraum</h3>
          <p className="mb-3 text-muted-foreground">
            Heuristik aus typischem Öffnungsfenster (halbmonatsgenau), Passhöhe und Jahreszeit.
            Bewirtschaftete Mautstraßen bekommen keinen Höhenabschlag. Für Rundtouren gilt der schlechteste
            Status ihrer Pässe. Ersetzt keine amtliche Sperrauskunft.
          </p>
          <h3 className="mb-1 text-base font-semibold">Daten</h3>
          <p className="text-muted-foreground">
            <b>Höhenprofil:</b> Open-Meteo Elevation (Copernicus DEM 90 m) entlang der gerouteten Straße.{" "}
            <b>Wetter:</b> Open-Meteo-Vorhersage auf Passhöhe, serverseitig zwischengespeichert.{" "}
            <b>Klima:</b> Open-Meteo-Archiv (ERA5-Land 2015–2024) je Halbmonat; 10-km-Raster, auf Passhöhe
            tendenziell zu mild. <b>Routen:</b> OpenRouteService (Rennrad-Profil) oder OSRM.{" "}
            <b>3D:</b> Mapzen/AWS Terrain Tiles. Karten © OpenStreetMap-Mitwirkende.
          </p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
