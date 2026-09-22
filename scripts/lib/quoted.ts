/**
 * Where the documents quote a threshold, and how they have to spell it.
 *
 * `LIMITS` (`scripts/lib/validate.ts`) is restated as a table in the
 * `curate-data` skill and drawn into two diagrams of `docs/data-model.md`;
 * the status constants (`SIGNALS` and the lapse rate, `lib/status.ts`) sit
 * in a table, a diagram and a paragraph of `docs/scales.md`. The documents
 * stay hand-written on purpose – they explain, they are not generated – so
 * nothing used to notice when a constant moved and the prose kept the old
 * number. `data:check` reads this table and fails, the way it fails on a
 * stale `data/schema/*.json`, when a document no longer contains the
 * spelling its constant has today.
 *
 * One entry per constant, with the spelling the documents use: the skill
 * writes "≤ 60 km", the diagram "at most 60 km", and both contain "60 km".
 * A constant that appears in no document is not listed – the check asks only
 * that what is quoted is quoted right. The plans under `docs/plans/` are
 * history and are not checked.
 */
import { LAPSE_RATE, SIGNALS, signalValue } from "../../lib/status";
import { fmt } from "../../lib/utils";
import { LIMITS } from "./validate";

export interface Quote {
  /** The constant, as code names it – what the error message says. */
  constant: string;
  /** The text the document has to contain, as a whole number with its unit. */
  text: string;
  /** Paths from the repository root. */
  files: string[];
}

const SKILL = ".agents/skills/curate-data/SKILL.md";
const MODEL = "docs/data-model.md";
const PIPELINE = "docs/data-pipeline.md";
const SCALES = "docs/scales.md";

/** "500 m" for 0.5, "2 km" for 2 – the way every document writes a distance. */
export const spellKm = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`;

/** "80 m", "3 000 m" – metres with a space as the thousands separator. */
export const spellM = (m: number): string =>
  `${m.toLocaleString("de-DE").replaceAll(".", " ")} m`;

/** "15 %" for 0.15 – a ratio as the percentage the documents print. */
export const spellPct = (ratio: number): string =>
  `${Math.round(ratio * 100)} %`;

/**
 * The documents write the day length as "10,75 h" where the dialog says
 * "10,75 Stunden"; every other unit is spelled alike on both sides.
 */
export const docUnit = (text: string) => text.replace(/ Stunden$/u, " h");

const { ascent, summit, tour } = LIMITS;

export const QUOTES: Quote[] = [
  {
    constant: "LIMITS.ascent.maxKm",
    files: [SKILL, MODEL],
    text: spellKm(ascent.maxKm),
  },
  {
    constant: "LIMITS.ascent.maxStartDist",
    files: [SKILL, MODEL],
    text: spellKm(ascent.maxStartDist),
  },
  {
    constant: "LIMITS.ascent.maxEndDist",
    files: [SKILL, MODEL],
    text: spellKm(ascent.maxEndDist),
  },
  {
    constant: "LIMITS.ascent.maxTopDelta",
    files: [SKILL, MODEL],
    text: spellM(ascent.maxTopDelta),
  },
  {
    // The skill and the diagram say "in the last 25 %", the complement.
    constant: "LIMITS.ascent.minPeakAt",
    files: [SKILL, MODEL],
    text: spellPct(1 - ascent.minPeakAt),
  },
  {
    constant: "LIMITS.ascent.maxGain",
    files: [SKILL],
    text: spellM(ascent.maxGain),
  },
  {
    constant: "LIMITS.tour.maxKmDelta",
    files: [SKILL],
    text: spellPct(tour.maxKmDelta),
  },
  {
    constant: "LIMITS.tour.maxWaypointDist",
    files: [SKILL],
    text: spellKm(tour.maxWaypointDist),
  },
  {
    constant: "LIMITS.summit.maxDelta",
    files: [SKILL, MODEL, PIPELINE],
    text: spellM(summit.maxDelta),
  },
  {
    constant: "LIMITS.summit.maxRoadDist",
    files: [SKILL, MODEL, PIPELINE],
    text: spellKm(summit.maxRoadDist),
  },
  ...SIGNALS.map((s) => ({
    constant: `SIGNALS[${s.reason ?? "best"}]`,
    files: [SCALES],
    text: docUnit(signalValue(s)),
  })),
  {
    // "0,65 °C per 100 m", as `lapseText` says it in the dialog.
    constant: "LAPSE_RATE",
    files: [SCALES],
    text: `${fmt(LAPSE_RATE * 100, 2)} °C`,
  },
];

/**
 * Whether a document quotes a value: the text as a whole number, so "8 °C"
 * is not found inside "18 °C" and "10 %" not inside "110 %". A digit, a
 * comma or a point in front of it makes it part of another number.
 */
export const quotes = (doc: string, text: string): boolean =>
  new RegExp(
    `(?<![\\d,.])${text.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`,
    "u",
  ).test(doc);

/**
 * Which quotes a set of documents gets wrong: one sentence per document and
 * constant, in the words `data:check` prints. Pure – the caller reads the
 * files – so the rule is testable against a made-up document.
 */
export const misquoted = (
  read: (file: string) => string,
  list: Quote[] = QUOTES,
): string[] => {
  const out: string[] = [];
  for (const q of list)
    for (const file of q.files)
      if (!quotes(read(file), q.text))
        out.push(
          `${file} nennt ${q.constant} nicht als „${q.text}“ – die Zahl im Text nachziehen (scripts/lib/quoted.ts sagt, wo)`,
        );
  return out;
};

/** The same over the real documents under `root`. */
export const misquotedIn = async (root: URL): Promise<string[]> => {
  const docs = new Map<string, string>();
  for (const file of new Set(QUOTES.flatMap((q) => q.files)))
    docs.set(file, await Bun.file(new URL(file, root)).text());
  return misquoted((file) => docs.get(file) ?? "");
};
