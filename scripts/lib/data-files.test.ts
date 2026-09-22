import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { Summit } from "../../lib/types";
import { readData, render, writeData } from "./data-files";

const dirs: string[] = [];
const tempDir = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "alpen-data-"));
  dirs.push(dir);
  return pathToFileURL(`${dir}/`);
};
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { force: true, recursive: true });
});

const summits: Record<string, Summit> = {
  "stilfser-joch": { dem: 2757, lat: 46.53, lon: 10.45, roadDist: 0.01 },
};

describe("render", () => {
  test("byKey: one sorted key per line, so a diff names the entry that moved", () => {
    const sorted = render("byKey", JSON.parse('{"b": [1], "a": [2]}'));
    expect(sorted).toBe('{\n  "a": [2],\n  "b": [1]\n}\n');
  });

  test("indented: the hand-maintained shape", () => {
    expect(render("indented", [{ a: 1 }])).toBe('[\n {\n  "a": 1\n }\n]\n');
  });
});

describe("readData / writeData", () => {
  test("what was written comes back, in the file's own layout", async () => {
    const dir = await tempDir();
    await writeData("generated/summits.json", summits, dir);
    const written = Bun.file(new URL("generated/summits.json", dir));
    const text = await written.text();
    expect(text).toBe(render("byKey", summits));
    const read = await readData("generated/summits.json", dir);
    expect(read.data).toEqual(summits);
  });

  test("a generated file that does not exist yet reads as empty", async () => {
    const dir = await tempDir();
    expect(await readData("generated/routes.json", dir)).toEqual({
      data: {},
      problems: [],
    });
  });

  test("a curated file that does not exist is missing, not empty", async () => {
    const dir = await tempDir();
    const { data, problems } = await readData("passes.json", dir);
    expect(data).toBeNull();
    expect(problems).toEqual(["passes.json: fehlt"]);
  });

  test("a file that is not JSON is reported, not thrown", async () => {
    const dir = await tempDir();
    await Bun.write(new URL("generated/summits.json", dir), "{");
    const { data, problems } = await readData("generated/summits.json", dir);
    expect(data).toBeNull();
    expect(problems[0]).toContain("kein gültiges JSON");
  });

  test("a file the schema refuses names the field that failed", async () => {
    const dir = await tempDir();
    await Bun.write(
      new URL("generated/summits.json", dir),
      render("byKey", { "stilfser-joch": { dem: "hoch" } }),
    );
    const { data, problems } = await readData("generated/summits.json", dir);
    expect(data).toBeNull();
    expect(problems[0]).toContain("stilfser-joch.dem");
  });

  test("a layout that is not the file's own is reported, the contents still read", async () => {
    const dir = await tempDir();
    await Bun.write(
      new URL("generated/summits.json", dir),
      JSON.stringify(summits),
    );
    const { data, problems } = await readData("generated/summits.json", dir);
    expect(data).toEqual(summits);
    expect(problems[0]).toContain("nicht kanonisch formatiert");
  });

  test("nothing invalid is written", async () => {
    const dir = await tempDir();
    const write = () =>
      writeData(
        "generated/summits.json",
        { "stilfser-joch": { dem: 2757 } } as never,
        dir,
      );
    expect(write()).rejects.toThrow("nicht geschrieben");
    const missing = Bun.file(new URL("generated/summits.json", dir));
    expect(await missing.exists()).toBe(false);
  });
});
