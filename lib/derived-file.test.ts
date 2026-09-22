import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { canonicalJson, derivedDir, writeDerived } from "@/lib/derived-file";
import { DETAIL_FILES } from "@/lib/detail-assets";
import { MAP_FILES } from "@/lib/map-assets";

const dirs: string[] = [];
const tempDir = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "alpen-derived-"));
  dirs.push(dir);
  return pathToFileURL(`${dir}/`);
};
afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

/**
 * What Next.js makes of a `headers()` source. Only the two forms these rules
 * use – a named parameter with a pattern, and literal text – because the point
 * of the assertion is whether the rule covers the names the pruner writes, not
 * whether path-to-regexp is reimplemented here.
 */
const literal = (s: string) => s.replaceAll(/[$()*+.?[\\\]^{|}]/gu, "\\$&");
const asRegExp = (source: string) => {
  let out = "";
  let last = 0;
  for (const m of source.matchAll(
    /:[a-z]+\((?<pattern>(?:[^()]|\([^()]*\))*)\)/gu,
  )) {
    out += `${literal(source.slice(last, m.index))}(?:${m.groups?.pattern})`;
    last = m.index + m[0].length;
  }
  return new RegExp(`^${out}${literal(source.slice(last))}$`, "u");
};

const shape = derivedDir({
  dir: "derived",
  ext: "txt",
  param: "part",
  stem: "alpha|beta",
});

describe("derivedDir", () => {
  test("the name is the stem, eight hex digits of the content, the extension", () => {
    expect(shape.name("alpha", "hello")).toMatch(/^alpha\.[0-9a-f]{8}\.txt$/u);
  });

  test("the same body gives the same name, a changed body another", () => {
    expect(shape.name("alpha", "hello")).toBe(shape.name("alpha", "hello"));
    expect(shape.name("alpha", "hello")).not.toBe(
      shape.name("alpha", "hello!"),
    );
  });

  test("the URL is the directory and the name", () => {
    expect(shape.url("alpha.0123abcd.txt")).toBe("/derived/alpha.0123abcd.txt");
  });
});

// The invariant the derived files stand on, for both directories at once: the
// name a module writes is one its script prunes, and one `next.config.ts`
// promises a year of immutability to. Spelled apart, the header rule would
// cache a name the pruner may replace – or the pruner would leave a stale hash
// behind because it no longer recognises its own output.
describe.each([
  {
    ext: "geojson",
    files: MAP_FILES,
    other: "style-light.json",
    stems: ["routes", "tours"],
    wrong: ["towns", "route"],
  },
  {
    ext: "json",
    files: DETAIL_FILES,
    other: "manifest.json",
    stems: ["pass-stilfser-joch", "tour-sellaronda", "town-bormio"],
    wrong: ["plan-sellaronda", "pass_stilfser_joch"],
  },
])("$files.dir", ({ ext, files, other, stems, wrong }) => {
  const cached = asRegExp(files.cachePattern);

  test("every name it writes is pruned and cached", () => {
    for (const stem of stems) {
      const name = files.name(stem, `{"stem":"${stem}"}`);
      expect(files.prune.test(name)).toBe(true);
      expect(cached.test(files.url(name))).toBe(true);
    }
  });

  test("a stem of another shape is neither", () => {
    for (const stem of wrong) {
      const name = `${stem}.0123abcd.${ext}`;
      expect(files.prune.test(name)).toBe(false);
      expect(cached.test(files.url(name))).toBe(false);
    }
  });

  test("a name without a full hash is neither", () => {
    for (const name of [
      `${stems[0]}.${ext}`,
      `${stems[0]}.0123abc.${ext}`,
      other,
    ]) {
      expect(files.prune.test(name)).toBe(false);
      expect(cached.test(files.url(name))).toBe(false);
    }
  });
});

describe("writeDerived", () => {
  test("writes the files and drops the stale names of the shape", async () => {
    const out = await tempDir();
    await writeFile(new URL("alpha.00000000.txt", out), "old");
    await writeFile(new URL("beta.11111111.txt", out), "old");
    const files = [{ body: "neu", name: shape.name("alpha", "neu") }];
    await writeDerived({ files, out, prune: shape.prune });
    const left = await readdir(out);
    expect(left.toSorted()).toEqual([files[0]!.name]);
    expect(await Bun.file(new URL(files[0]!.name, out)).text()).toBe("neu");
  });

  test("leaves what the pattern does not match alone", async () => {
    // `public/map` holds the two basemap styles and the committed glyphs
    // beside the geometry; the script that prunes writes neither.
    const out = await tempDir();
    await writeFile(new URL("style-light.json", out), "{}");
    await writeDerived({
      files: [{ body: "neu", name: shape.name("beta", "neu") }],
      out,
      prune: shape.prune,
    });
    const left = await readdir(out);
    expect(left).toHaveLength(2);
  });

  test("without a pattern it prunes nothing", async () => {
    const out = await tempDir();
    await writeFile(new URL("alpha.00000000.txt", out), "old");
    await writeDerived({
      files: [{ body: "{}", name: "style-dark.json" }],
      out,
    });
    const left = await readdir(out);
    expect(left.toSorted()).toEqual(["alpha.00000000.txt", "style-dark.json"]);
  });

  test("makes the directory it writes into", async () => {
    const out = new URL("nested/", await tempDir());
    await writeDerived({ files: [{ body: "x", name: "a.txt" }], out });
    expect(await Bun.file(new URL("a.txt", out)).text()).toBe("x");
  });
});

/**
 * The same data with its keys in the opposite order. Built key by key rather
 * than written out: this repo's formatter sorts an object literal's keys, so a
 * second literal in the other order would be reformatted into the first and
 * the test would assert nothing.
 */
const reordered = (o: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).toReversed());

describe("canonicalJson", () => {
  /**
   * The bug this pins cost a broken build: the script that writes a detail
   * file and the page that derives its name built the same data by two routes,
   * and the routes disagreed about key order. Both hashed their own
   * serialisation, so the page asked for a name nothing had written.
   */
  test("the same content in two key orders is one string", () => {
    const a = { artist: "Bonzon", blur: "data:…", height: 640 };
    const b = reordered(a);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(DETAIL_FILES.name("pass-x", canonicalJson(a))).toBe(
      DETAIL_FILES.name("pass-x", canonicalJson(b)),
    );
  });

  test("it sorts every level, not only the top one", () => {
    const a = { photos: [{ artist: "A", src: "u" }], profiles: { up: 1 } };
    const b = { ...reordered(a), photos: [reordered(a.photos[0]!)] };
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  test("arrays keep their order – it is content, not spelling", () => {
    expect(canonicalJson({ a: [3, 1, 2] })).toBe('{"a":[3,1,2]}');
  });

  test("null is a value, not an object to sort", () => {
    expect(canonicalJson(reordered({ a: 1, b: null }))).toBe(
      '{"a":1,"b":null}',
    );
  });
});
