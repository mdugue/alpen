/**
 * The one pair that reads and writes `data/`.
 *
 * Where a file lives, whether it may be missing, how it is laid out and that
 * it is validated before it is written are all in `FILES` (`lib/schema.ts`);
 * this module is what turns that table into two functions. Before it existed
 * six readers and three writers each decided those four things again, and the
 * differences between them were not choices: `data:check` alone insisted on
 * the canonical layout, and the scripts that spend API calls read their input
 * with a cast while the ones that spend nothing parsed it (principle 4).
 *
 * A reader never throws on bad content. It hands back what it found wrong, as
 * the sentences `data:check` prints, so the caller decides whether that is a
 * report or the end of the run – a build must stop, a check has forty more
 * things to say first.
 */
import type { z } from "zod";

import { FILES } from "../../lib/schema";
import type { DataFile, DataFileName } from "../../lib/schema";

const DATA = new URL("../../data/", import.meta.url);

/** The validated contents of one file. */
export type Data<K extends DataFileName> = z.infer<(typeof FILES)[K]["schema"]>;

export interface ReadResult<T> {
  /** Null when the file could not be parsed at all. */
  data: T | null;
  /** What is wrong with the file, in the words `data:check` prints. */
  problems: string[];
}

const entries = (data: unknown) => Object.entries(data as object);

/** The text a value gets on disk, in the layout its file is kept in. */
export const render = (layout: DataFile["layout"], data: unknown): string =>
  layout === "indented"
    ? `${JSON.stringify(data, null, 1)}\n`
    : `{\n${entries(data)
        .toSorted(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
        .join(",\n")}\n}\n`;

/** A zod failure as one line per issue, prefixed with the path that failed. */
export const issueLines = (name: string, error: z.ZodError): string[] =>
  error.issues.map((issue) => {
    const path = issue.path
      .map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`))
      .join("")
      .replace(/^\./u, "");
    return `${name} › ${path || "(root)"}: ${issue.message}`;
  });

/**
 * Reads, parses and validates one file. A file that may be missing reads as
 * its `empty` value, which goes through the same schema – so no caller has to
 * know whether the first build has run yet. A layout that is not the file's
 * own is reported and the contents are still handed back: the reader says what
 * it saw, it does not decide what that is worth.
 */
export const readData = async <K extends DataFileName>(
  file: K,
  dir: URL = DATA,
): Promise<ReadResult<Data<K>>> => {
  const spec: DataFile = FILES[file];
  const f = Bun.file(new URL(file, dir));
  const raw = (await f.exists()) ? await f.text() : null;
  if (raw === null && spec.empty === undefined)
    return { data: null, problems: [`${file}: fehlt`] };

  const problems: string[] = [];
  let value: unknown = spec.empty;
  if (raw !== null) {
    try {
      value = JSON.parse(raw);
    } catch (error) {
      return {
        data: null,
        problems: [`${file}: kein gültiges JSON (${(error as Error).message})`],
      };
    }
    // Compared against the parsed value rather than against what the schema
    // returns: zod rebuilds an object in the schema's key order, which says
    // nothing about how the file is written.
    if (raw !== render(spec.layout, value))
      problems.push(
        spec.layout === "indented"
          ? `${file}: nicht kanonisch formatiert (JSON.stringify(data, null, 1) + Zeilenumbruch)`
          : `${file}: nicht kanonisch formatiert (ein sortierter Schlüssel je Zeile)`,
      );
  }

  // Validated, but what is handed back is what the file says rather than the
  // copy zod rebuilt: none of these schemas has a default or a transform, and
  // the copy comes back in the schema's key order – so a run that moved one
  // coordinate would rewrite every entry of `passes.json` around it.
  const result = spec.schema.safeParse(value);
  return result.success
    ? { data: value as Data<K>, problems }
    : {
        data: null,
        problems: [...problems, ...issueLines(file, result.error)],
      };
};

/**
 * Validates, then writes in the file's own layout. The value handed in is what
 * is written, not what the schema returned: parsing rebuilds an object in the
 * schema's key order, and a run that filled one gap must not reformat the
 * whole file around it.
 */
export const writeData = async <K extends DataFileName>(
  file: K,
  data: Data<K>,
  dir: URL = DATA,
): Promise<void> => {
  const spec: DataFile = FILES[file];
  const result = spec.schema.safeParse(data);
  if (!result.success)
    throw new Error(`${issueLines(file, result.error)[0]} – nicht geschrieben`);
  await Bun.write(new URL(file, dir), render(spec.layout, data));
};
