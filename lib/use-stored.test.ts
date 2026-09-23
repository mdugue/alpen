import { beforeEach, describe, expect, test } from "bun:test";

import { initialState, reduce } from "@/lib/app-state";
import type { AppState, Env } from "@/lib/app-state";
import { parseHash } from "@/lib/hash";
import type { Period } from "@/lib/types";
import { readStoredState, writePersisted } from "@/lib/use-stored";

/**
 * The adapter's write half, which no test reached before: the path from a
 * decision in the reducer through `PERSISTED` into web storage, and back out
 * of it through `readStoredState` – the same round trip the next visit makes.
 *
 * Web storage is a browser thing and these tests run in Bun, so the two areas
 * are a Map with the `Storage` surface on it. What that leaves untested is the
 * browser's own behaviour (quota, a blocked origin, another tab writing); what
 * it covers is every rule this module states about *what* is written.
 */
const written = new Map<string, string>();
let writes = 0;
const area = (): Storage => ({
  clear: () => written.clear(),
  getItem: (key: string) => written.get(key) ?? null,
  key: (i: number) => [...written.keys()][i] ?? null,
  get length() {
    return written.size;
  },
  removeItem: (key: string) => {
    written.delete(key);
  },
  setItem: (key: string, value: string) => {
    writes += 1;
    written.set(key, value);
  },
});
for (const name of ["localStorage", "sessionStorage"])
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: area(),
  });

const TODAY: Period = 7;
const env: Env = {
  destinations: [],
  mobile: false,
  rangeBounds: {},
  today: TODAY,
  tours: ["sellaronda"],
};
const loaded = (hash = ""): AppState =>
  reduce(
    initialState(TODAY),
    { hash: parseHash(hash), stored: readStoredState(), type: "load" },
    env,
  );

/** What the adapter does after every commit. */
const commit = (state: AppState): AppState => {
  writePersisted(state);
  return state;
};

/**
 * One slot's key and value, found by the name it ends in: under which prefix
 * the adapter keeps them is its own business and is spelled nowhere else
 * (`bun run seams`).
 */
const keyOf = (slot: string) =>
  [...written.keys()].find((key) => key.endsWith(`:${slot}`));
const valueOf = (slot: string) => {
  const key = keyOf(slot);
  return key === undefined ? null : (written.get(key) ?? null);
};

beforeEach(() => {
  written.clear();
  writes = 0;
});

describe("the storage adapter", () => {
  test("writes nothing before the world has been read in", () => {
    writePersisted(initialState(TODAY));
    expect([...written.keys()]).toEqual([]);
  });

  test("carries the visitor's own half-month to storage, a link's never", () => {
    // A shared link's half-month is applied but is not the visitor's choice,
    // so the slice has nothing to say and the key stays untouched.
    commit(loaded("#t=6"));
    expect(valueOf("period")).toBeNull();

    // The period control is the one writer, through `ownPeriod`.
    const chosen = commit(
      reduce(loaded("#t=6"), { period: 3, type: "period" }, env),
    );
    expect(valueOf("period")).toBe("3");
    expect(chosen.filters.period).toBe(3);
    // And it is read back as the next visit reads it.
    expect(readStoredState().period).toBe(3);
  });

  test("a towns tab stored by an earlier build opens the areas, where the towns are now", () => {
    // Written through the adapter, as the build that still had the tab did.
    commit({ ...loaded(), tab: "town" as never });
    expect(readStoredState().tab).toBe("destination");
    commit({ ...loaded(), tab: "nonsense" as never });
    expect(readStoredState().tab).toBe("pass");
    commit({ ...loaded(), tab: "pass" });
  });

  test("carries the tab and the map switches, and writes each one once", () => {
    commit(
      reduce(
        loaded(),
        { kind: "destination", on: false, type: "toggleKind" },
        env,
      ),
    );
    expect(valueOf("showDestinations")).toBe("false");
    expect(valueOf("tab")).toBe('"pass"');
    const stored = readStoredState();
    expect(stored.shown?.destinations).toBe(false);
    expect(stored.shown?.passes).toBe(true);
    expect(stored.tab).toBe("pass");

    // A second commit of an unchanged state wakes no reader: what is already
    // under the key is not written again.
    const before = writes;
    commit(
      reduce(
        loaded(),
        { kind: "destination", on: false, type: "toggleKind" },
        env,
      ),
    );
    expect(writes).toBe(before);
  });

  test("drops a tour slug that left the data on the way back in", () => {
    // One tour the visitor took off the map, and beside it a slug from a
    // version of the data that no longer has it.
    commit(
      reduce(
        loaded(),
        { on: false, slug: "sellaronda", type: "toggleTour" },
        env,
      ),
    );
    const key = keyOf("hiddenTours")!;
    written.set(key, '["sellaronda","gone"]');
    commit(loaded());
    expect(written.get(key)).toBe('["sellaronda"]');
  });
});
