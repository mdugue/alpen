import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: { canonical: "/impressum" },
  robots: { index: false },
  // The site name is appended by the title template in app/layout.tsx.
  title: "Impressum",
};

const ImpressumPage = () => (
  <main className="bg-background text-foreground h-dvh overflow-y-auto px-4 py-10">
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Zurück zur Karte
      </Link>

      <h1 className="font-heading text-2xl font-bold tracking-wide">
        Impressum
      </h1>

      <section className="flex flex-col gap-2 text-sm">
        <h2 className="text-base font-semibold">Angaben gemäß § 5 DDG</h2>
        <p>
          Manuel Dugué
          <br />
          Görlitzer Str. 23
          <br />
          01099 Dresden
          <br />
          Deutschland
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm">
        <h2 className="text-base font-semibold">Kontakt</h2>
        <p>
          E-Mail:{" "}
          <a href="mailto:mail@manuel.fyi" className="underline">
            mail@manuel.fyi
          </a>
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm">
        <h2 className="text-base font-semibold">Hinweis zum Angebot</h2>
        <p className="text-muted-foreground">
          Alpenpässe ist ein privates, nicht-kommerzielles Hobbyprojekt ohne
          Werbung, ohne Nutzerkonten und ohne Bezahlfunktion. Die App dient der
          groben Routenplanung für Rennradfahrten in den Alpen und ersetzt keine
          amtliche Auskunft, insbesondere nicht zu Straßensperrungen oder
          Straßenzuständen – siehe dazu auch die Hinweise unter „Skalen &amp;
          Quellen“ in der App.
        </p>
      </section>

      <section className="flex flex-col gap-2 text-sm">
        <h2 className="text-base font-semibold">Haftungsausschluss</h2>
        <p className="text-muted-foreground">
          <b>Inhalte:</b> Die Inhalte dieser Seite wurden mit Sorgfalt erstellt.
          Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann
          jedoch keine Gewähr übernommen werden; die Höhenangaben,
          Auffahrtsdaten, Bewertungen und der Status je Zeitraum sind
          redaktionelle Einschätzungen bzw. Heuristiken, keine gemessenen oder
          amtlichen Werte.
        </p>
        <p className="text-muted-foreground">
          <b>Links:</b> Diese Seite verweist auf Kartenmaterial und Wetterdaten
          externer Anbieter (siehe Datenschutzerklärung). Für deren Inhalte sind
          ausschließlich die jeweiligen Betreiber verantwortlich; auf sie hat
          der Betreiber dieser Seite keinen Einfluss.
        </p>
        <p className="text-muted-foreground">
          <b>Urheberrecht:</b> Der Quellcode dieses Projekts ist öffentlich
          einsehbar. Kartendaten stammen von OpenStreetMap und weiteren, jeweils
          mit Quellenangabe in der App und in der Datenschutzerklärung benannten
          Anbietern.
        </p>
      </section>

      <p className="text-muted-foreground text-xs">
        Siehe auch:{" "}
        <Link href="/datenschutz" className="underline">
          Datenschutzerklärung
        </Link>
      </p>
    </div>
  </main>
);

export default ImpressumPage;
