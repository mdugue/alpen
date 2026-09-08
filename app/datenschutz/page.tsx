import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  // The site name is appended by the title template in app/layout.tsx.
  title: "Datenschutzerklärung",
  alternates: { canonical: "/datenschutz" },
  robots: { index: false },
};

export default function DatenschutzPage() {
  return (
    <main className="h-dvh overflow-y-auto bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Zurück zur Karte
        </Link>

        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-wide">Datenschutzerklärung</h1>
          <p className="text-xs text-muted-foreground">Stand: September 2026</p>
        </div>

        <section className="flex flex-col gap-2 text-sm">
          <h2 className="text-base font-semibold">Verantwortlicher</h2>
          <p className="text-muted-foreground">
            Manuel Dugué, Görlitzer Str. 23, 01099 Dresden, Deutschland – E-Mail:{" "}
            <a href="mailto:mail@manuel.fyi" className="underline">
              mail@manuel.fyi
            </a>
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm">
          <h2 className="text-base font-semibold">Im Überblick</h2>
          <p className="text-muted-foreground">
            Alpenpässe ist ein statischer Kartendienst ohne Nutzerkonten, ohne Tracking und ohne
            Werbenetzwerke. Es werden keine Analyse-Tools eingesetzt und es werden keine Cookies zu
            Tracking- oder Marketingzwecken gesetzt. Personenbezogene Daten fallen im Wesentlichen nur an,
            wenn Ihr Browser beim Laden der Seite und der Kartenkacheln automatisch Verbindungsdaten an
            Server überträgt – siehe unten.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm">
          <h2 className="text-base font-semibold">Hosting und Server-Logfiles</h2>
          <p className="text-muted-foreground">
            Diese Seite wird bei Vercel Inc. (USA) gehostet und als vorgerenderte, statische Seite über
            dessen Content Delivery Network ausgeliefert. Dabei erhebt und speichert der Hoster automatisch
            technische Zugriffsdaten in sogenannten Server-Logfiles, u. a. IP-Adresse, Datum und Uhrzeit des
            Zugriffs, aufgerufene Seite, Referrer-URL sowie Browsertyp und Betriebssystem. Diese Daten
            dienen ausschließlich dem technischen Betrieb, der Absicherung und der Fehleranalyse und werden
            nicht mit anderen Datenquellen zusammengeführt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
            (berechtigtes Interesse an einem sicheren und funktionsfähigen Betrieb).
          </p>
          <p className="text-muted-foreground">
            Eine Verarbeitung kann dabei auch auf Servern in den USA stattfinden. Vercel verpflichtet sich
            nach eigenen Angaben zur Einhaltung der EU-Standardvertragsklauseln als zusätzliche Garantie;
            Details finden sich in der Datenschutzerklärung von Vercel unter{" "}
            <a href="https://vercel.com/legal/privacy-policy" className="underline" target="_blank" rel="noreferrer">
              vercel.com/legal/privacy-policy
            </a>
            .
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm">
          <h2 className="text-base font-semibold">Kartenkacheln externer Anbieter</h2>
          <p className="text-muted-foreground">
            Die Karte lädt ihre Kartenkacheln direkt im Browser von den jeweiligen Anbietern nach – je
            nachdem, welche Grundkarte oder welches Overlay Sie auswählen. Dabei überträgt Ihr Browser
            zwangsläufig Ihre IP-Adresse sowie technische Angaben (z. B. Browsertyp) an den jeweiligen
            Server, so wie bei jedem Laden eines Bildes von einer fremden Website. Genutzt werden je nach
            Auswahl:
          </p>
          <ul className="list-disc pl-5 text-muted-foreground">
            <li>OpenStreetMap (tile.openstreetmap.org) – OpenStreetMap Foundation</li>
            <li>OpenTopoMap (tile.opentopomap.org)</li>
            <li>CyclOSM (tile-cyclosm.openstreetmap.fr)</li>
            <li>Esri / ArcGIS Online (server.arcgisonline.com), Esri Inc., USA – Topo- und Satellitenkarte</li>
            <li>Waymarked Trails (tile.waymarkedtrails.org) – Radrouten-Overlay</li>
            <li>Amazon S3 „elevation-tiles-prod“ (Mapzen/AWS, USA) – Höhenrelief und 3D-Gelände</li>
            <li>
              Thunderforest und MapTiler – nur falls der Betreiber der jeweiligen Installation einen API-Key
              hinterlegt hat und Sie diese Grundkarte aktiv auswählen
            </li>
          </ul>
          <p className="text-muted-foreground">
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Darstellung der
            Karte). Es werden hierbei keine Cookies durch diese App gesetzt; welche Daten die genannten
            Anbieter selbst protokollieren, entnehmen Sie bitte deren eigenen Datenschutzhinweisen.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm">
          <h2 className="text-base font-semibold">Wetter- und Höhendaten (Open-Meteo)</h2>
          <p className="text-muted-foreground">
            Wettervorhersage und Höhenprofile stammen von Open-Meteo. Diese Anfragen laufen ausschließlich
            serverseitig über eine eigene, zwischengespeicherte Route – Ihr Browser stellt hierbei keine
            eigene Verbindung zu Open-Meteo her, es werden also keine Daten von Ihnen (insbesondere keine
            IP-Adresse) an Open-Meteo übertragen.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm">
          <h2 className="text-base font-semibold">Lokale Speicherung im Browser</h2>
          <p className="text-muted-foreground">
            Ihre Auswahl (Favoriten, ein-/ausgeblendete Touren, sichtbare Orte, gewählte Grundkarte,
            aufgeklappte Listen, Sidebar-Zustand) wird ausschließlich lokal im localStorage Ihres Browsers
            gespeichert, um sie beim nächsten Besuch wiederherzustellen. Diese Daten verlassen Ihr Gerät nie
            und werden nicht an diesen oder einen anderen Server übertragen. Als technisch notwendige
            Speicherung ist hierfür keine Einwilligung nach § 25 TDDDG (vormals TTDSG) erforderlich.
          </p>
          <p className="text-muted-foreground">
            Die aktuelle Filter-, Kamera- und Auswahleinstellung wird zusätzlich im URL-Fragment
            („#…“) der Adresszeile gespiegelt, damit sich Ansichten per Link teilen lassen. Dieser Teil der
            URL wird von Browsern grundsätzlich nicht an Server übertragen.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm">
          <h2 className="text-base font-semibold">Ihre Rechte</h2>
          <p className="text-muted-foreground">
            Sie haben nach der DSGVO das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung
            (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und
            Widerspruch (Art. 21) bezüglich Sie betreffender personenbezogener Daten. Wenden Sie sich dazu
            an die oben genannte Kontaktadresse. Außerdem haben Sie das Recht, sich bei einer
            Datenschutz-Aufsichtsbehörde zu beschweren, z. B. beim Sächsischen Datenschutzbeauftragten
            (zuständig am Sitz des Verantwortlichen in Dresden).
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm">
          <h2 className="text-base font-semibold">Änderungen</h2>
          <p className="text-muted-foreground">
            Diese Datenschutzerklärung wird angepasst, sobald sich die beschriebene Datenverarbeitung
            ändert, z. B. bei neu hinzukommenden Kartenanbietern.
          </p>
        </section>

        <p className="text-xs text-muted-foreground">
          Siehe auch:{" "}
          <Link href="/impressum" className="underline">
            Impressum
          </Link>
        </p>
      </div>
    </main>
  );
}
