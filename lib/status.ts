import type { Pass, Period, Status, Tour } from "@/lib/types";

export const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
] as const;

/** "Anfang Oktober" / "Ende Oktober" für eine Period. */
export function periodLabel(t: Period): string {
  return `${t % 1 ? "Ende" : "Anfang"} ${MONTHS[Math.floor(t) - 1]}`;
}

/** Alle 24 Halbmonats-Zeitpunkte. */
export const PERIODS: Period[] = Array.from({ length: 24 }, (_, i) =>
  Math.floor(i / 2) + 1 + (i % 2 ? 0.5 : 0),
);

/** Index in eine ClimateYear-Reihe. */
export function periodIndex(t: Period): number {
  return (Math.floor(t) - 1) * 2 + (t % 1 ? 1 : 0);
}

export const STATUS_LABEL: Record<Status, string> = {
  open: "meist offen",
  risky: "wetterabhängig",
  closed: "oft gesperrt",
};

/**
 * Heuristik aus typischem Öffnungsfenster, Passhöhe und Jahreszeit.
 * Ersetzt keine amtliche Sperrauskunft – siehe docs/roadmap.md ("Live-Status").
 */
export function passStatus(pass: Pass, t: Period): Status {
  const s = pass.season;
  if (!s) {
    if (pass.elevation >= 2300 && (t >= 10 || t < 5.5)) return "risky";
    if (pass.elevation >= 1800 && (t >= 11 || t < 4.5)) return "risky";
    if (t >= 12 || t < 3) return "risky";
    return "open";
  }
  if (t < s.opens || t >= s.closes) return "closed";
  if (t < s.opens + 0.5 || t >= s.closes - 0.5) return "risky";
  if (!s.maintained) {
    if (pass.elevation >= 2300 && (t >= 10 || t < 6.5)) return "risky";
    if (pass.elevation >= 1800 && (t >= 10.5 || t < 6)) return "risky";
  }
  return "open";
}

export function seasonText(pass: Pass): string {
  const s = pass.season;
  if (!s) return "Ganzjährig befahrbar (Winterräumung); Schnee und Kälte je nach Höhe.";
  return `Typisch offen ${periodLabel(s.opens)} bis ${periodLabel(s.closes)}${
    s.maintained ? " (bewirtschaftete Mautstraße, wird geräumt)" : ""
  }.`;
}

/** Eine Tour ist so gut befahrbar wie ihr schlechtester Pass. */
export function tourStatus(tour: Tour, passes: Pass[], t: Period): Status {
  const list = tour.passes
    .map((slug) => passes.find((p) => p.slug === slug))
    .filter((p): p is Pass => Boolean(p))
    .map((p) => passStatus(p, t));
  if (list.includes("closed")) return "closed";
  if (list.includes("risky")) return "risky";
  return "open";
}
