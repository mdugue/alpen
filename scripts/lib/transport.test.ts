import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  fixtureKey,
  fixtureTransport,
  HttpError,
  liveTransport,
  QuotaExhaustedError,
  RateLimitedError,
} from "./transport";
import type { Transport } from "./transport";

/** A clock that only moves when something sleeps – a minute of pacing in no time. */
const fakeClock = () => {
  let t = 1_000_000;
  const sleeps: number[] = [];
  return {
    clock: {
      now: () => t,
      sleep: (ms: number) => {
        sleeps.push(ms);
        t += ms;
        return Promise.resolve();
      },
    },
    sleeps,
  };
};

/** Answers in order; records what was asked. */
const fakeFetch = (answers: (() => Response)[]) => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetch = ((url: string, init?: RequestInit) => {
    calls.push({ init, url });
    const next = answers.shift();
    if (!next) throw new Error(`unexpected fetch ${url}`);
    return Promise.resolve(next());
  }) as unknown as typeof globalThis.fetch;
  return { calls, fetch };
};

const ok = () => Response.json({ fine: true });
const refused = (
  status: number,
  body = "",
  headers: Record<string, string> = {},
) => new Response(body, { headers, status });

/** The error a promise rejects with – these tests are about refusals. */
const rejection = async (p: Promise<unknown>): Promise<Error> => {
  try {
    await p;
  } catch (error) {
    return error as Error;
  }
  throw new Error("resolved instead of rejecting");
};

const setup = (
  answers: (() => Response)[],
  env: Record<string, string> = {},
) => {
  const { clock, sleeps } = fakeClock();
  const { calls, fetch } = fakeFetch(answers);
  const log: string[] = [];
  const t = liveTransport({
    clock,
    env,
    fetch,
    log: (line) => {
      log.push(line);
    },
  });
  return { calls, log, sleeps, t };
};

describe("liveTransport", () => {
  test("paces one host by its gap and leaves the others alone", async () => {
    const { calls, sleeps, t } = setup([ok, ok, ok]);
    await t.getJson("osrm", "https://osrm/1");
    await t.getJson("osrm", "https://osrm/2");
    await t.getJson("overpass", "https://overpass/1");
    expect(calls.map((c) => c.url)).toEqual([
      "https://osrm/1",
      "https://osrm/2",
      "https://overpass/1",
    ]);
    // 55 requests a minute: the second waits the gap, the other host does not.
    expect(sleeps).toHaveLength(1);
    expect(sleeps[0]).toBeCloseTo(60_000 / 55, 6);
  });

  test("weighs the gap by what Open-Meteo bills", async () => {
    const { sleeps, t } = setup([ok, ok]);
    await t.getJson("openMeteo", "https://meteo/1", undefined, 100);
    await t.getJson("openMeteo", "https://meteo/2", undefined, 1);
    expect(sleeps).toEqual([(100 * 60_000) / 500]);
  });

  test("stops at the per-run budget before the request goes out", async () => {
    const { calls, t } = setup([ok, ok], { OPEN_METEO_BUDGET: "150" });
    expect(t.host("openMeteo").budget).toBe(150);
    await t.getJson("openMeteo", "https://meteo/1", undefined, 100);
    const error = await rejection(
      t.getJson("openMeteo", "https://meteo/2", undefined, 100),
    );
    expect(error).toBeInstanceOf(QuotaExhaustedError);
    expect(error.message).toBe(
      "Open-Meteo: Budget von 150 Calls für diesen Lauf erreicht",
    );
    expect(calls).toHaveLength(1);
    expect(t.host("openMeteo")).toMatchObject({ requests: 1, used: 100 });
  });

  test("a spent hourly or daily quota stops the host for the run", async () => {
    const { calls, t } = setup([
      () =>
        refused(
          429,
          JSON.stringify({ reason: "Hourly API request limit exceeded" }),
        ),
      ok,
    ]);
    const error = await rejection(t.getJson("openMeteo", "https://meteo/1"));
    expect(error).toBeInstanceOf(QuotaExhaustedError);
    expect(error.message).toBe("Open-Meteo: Hourly API request limit exceeded");
    expect(t.host("openMeteo").exhausted).toBe(
      "Hourly API request limit exceeded",
    );
    // The next question is not even asked.
    expect(
      await rejection(t.getJson("openMeteo", "https://meteo/2")),
    ).toBeInstanceOf(QuotaExhaustedError);
    expect(calls).toHaveLength(1);
  });

  test("ORS says quota in a 403, and only the routing host stops", async () => {
    const { t } = setup([() => refused(403, "Quota exceeded"), ok]);
    expect(await rejection(t.getJson("ors", "https://ors/1"))).toBeInstanceOf(
      QuotaExhaustedError,
    );
    expect(t.host("ors").exhausted).toBe("Quota exceeded");
    expect(await t.getJson("osrm", "https://osrm/1")).toEqual({ fine: true });
  });

  test("waits Retry-After, capped at 90 s, then asks again", async () => {
    const { log, sleeps, t } = setup([
      () => refused(503, "", { "retry-after": "7" }),
      () => refused(503, "", { "retry-after": "500" }),
      ok,
    ]);
    expect(await t.getJson("osrm", "https://osrm/1")).toEqual({ fine: true });
    expect(sleeps).toEqual([7000, 90_000]);
    expect(log).toEqual([
      "  OSRM-Demo 503 (keine Angabe), warte 7s …",
      "  OSRM-Demo 503 (keine Angabe), warte 90s …",
    ]);
  });

  test("without Retry-After: a minute for a 429, 5 s steps for a 5xx", async () => {
    const { sleeps, t } = setup([
      () => refused(429, "Minutely API request limit exceeded"),
      () => refused(500),
      () => refused(502),
      ok,
    ]);
    await t.getJson("openMeteo", "https://meteo/1");
    expect(sleeps).toEqual([60_000, 10_000, 15_000]);
  });

  test("a refusal that is not worth retrying carries its status and its reason", async () => {
    const { t } = setup([
      () =>
        refused(404, JSON.stringify({ error: { code: 2010 }, reason: "x" })),
    ]);
    const error = await rejection(
      t.getJson("ors", "https://ors/v2/directions"),
    );
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(404);
    expect((error as HttpError).message).toBe(
      "404 x https://ors/v2/directions",
    );
  });

  test("the reason is the body when it is not JSON, whitespace folded and cut", async () => {
    const { t } = setup([
      () => refused(400, `You requested\n  too many nodes ${"x".repeat(200)}`),
    ]);
    const error = await rejection(t.getJson("osmApi", "https://osm/map"));
    expect(error.message).toMatch(
      /^400 You requested too many nodes x+ https/u,
    );
    expect(error.message.length).toBeLessThan(160);
  });

  test("gives up after the host's attempts", async () => {
    const { calls, t } = setup(
      Array.from({ length: 5 }, () => () => refused(500)),
    );
    const error = await rejection(t.getJson("osrm", "https://osrm/1"));
    expect(error).toBeInstanceOf(RateLimitedError);
    expect(error.message).toBe("OSRM-Demo: aufgegeben nach 5 Versuchen");
    expect(calls).toHaveLength(5);
  });

  test("Commons: six attempts, doubling backoff, Retry-After uncapped", async () => {
    const { sleeps, t } = setup([
      () => refused(429),
      () => refused(429),
      () => refused(429, "", { "retry-after": "300" }),
      ok,
    ]);
    await t.getJson("commons", "https://commons/api");
    expect(sleeps).toEqual([10_000, 20_000, 300_000]);
    const stubborn = setup(Array.from({ length: 6 }, () => () => refused(429)));
    expect(
      await rejection(stubborn.t.getJson("commons", "https://commons/api")),
    ).toBeInstanceOf(RateLimitedError);
    expect(stubborn.calls).toHaveLength(6);
  });

  test("the CDN's gap doubles on a 429 and comes back down after 25 calm answers", async () => {
    const { sleeps, t } = setup([
      () => refused(429),
      ...Array.from({ length: 27 }, () => ok),
    ]);
    const url = "https://upload.wikimedia.org/x.jpg";
    await t.getBytes("commonsThumb", url);
    // The retry's pause moved the next slot past the gap, so the second is free …
    await t.getBytes("commonsThumb", url);
    // … and the third waits the doubled gap.
    await t.getBytes("commonsThumb", url);
    expect(sleeps).toEqual([10_000, 800]);
    // The 25th untroubled answer halves the gap; the request after it still
    // waits the slot the 25th reserved, the one after that the new gap.
    for (let i = 0; i < 23; i += 1) await t.getBytes("commonsThumb", url);
    expect(sleeps.at(-1)).toBe(800);
    await t.getBytes("commonsThumb", url);
    expect(sleeps.at(-1)).toBe(400);
  });

  test("bytes come with the media type, without its parameters", async () => {
    const { calls, t } = setup([
      () =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "image/jpeg; charset=binary" },
          status: 200,
        }),
    ]);
    const init = { headers: { "User-Agent": "test" } };
    const answer = await t.getBytes("commonsThumb", "https://cdn/x.jpg", init);
    expect([...answer.bytes]).toEqual([1, 2, 3]);
    expect(answer.type).toBe("image/jpeg");
    expect(calls[0]!.init).toBe(init);
  });
});

const countingLive = () => {
  let calls = 0;
  const live: Transport = {
    getBytes: () => {
      calls += 1;
      return Promise.resolve({
        bytes: new Uint8Array([9, 8]),
        type: "image/png",
      });
    },
    getJson: (_host, url) => {
      calls += 1;
      return Promise.resolve({ answer: url, n: calls });
    },
  };
  return { calls: () => calls, live };
};

const withDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await mkdtemp(path.join(tmpdir(), "alpen-fixtures-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
};

describe("fixtureTransport", () => {
  test("records what live answered and replays it without asking again", () =>
    withDir(async (dir) => {
      const { calls, live } = countingLive();
      const t = fixtureTransport(dir, { live });
      const url = "https://overpass/api?q=1";
      const init = { body: "data=q", method: "POST" };
      expect(await t.getJson("overpass", url, init)).toEqual({
        answer: url,
        n: 1,
      });
      expect(await readdir(path.join(dir, "overpass"))).toEqual([
        `${fixtureKey(url, init)}.json`,
      ]);
      expect(await t.getJson("overpass", url, init)).toEqual({
        answer: url,
        n: 1,
      });
      expect(calls()).toBe(1);
      expect(t).toMatchObject({ recorded: 1, replayed: 1 });

      // Another transport over the same directory sees the file, not the host.
      const again = fixtureTransport(dir);
      expect(await again.getJson("overpass", url, init)).toEqual({
        answer: url,
        n: 1,
      });
      // Recording asks live again and overwrites.
      const fresh = fixtureTransport(dir, { live, record: true });
      expect(await fresh.getJson("overpass", url, init)).toEqual({
        answer: url,
        n: 2,
      });
      expect(await again.getJson("overpass", url, init)).toEqual({
        answer: url,
        n: 2,
      });
    }));

  test("bytes survive the round trip", () =>
    withDir(async (dir) => {
      const { calls, live } = countingLive();
      const t = fixtureTransport(dir, { live });
      await t.getBytes("commonsThumb", "https://cdn/x.png");
      const replayed = await fixtureTransport(dir).getBytes(
        "commonsThumb",
        "https://cdn/x.png",
      );
      expect([...replayed.bytes]).toEqual([9, 8]);
      expect(replayed.type).toBe("image/png");
      expect(calls()).toBe(1);
    }));

  test("without live, a missing fixture is an error", () =>
    withDir(async (dir) => {
      const error = await rejection(
        fixtureTransport(dir).getJson("osrm", "https://osrm/route"),
      );
      expect(error.message).toMatch(
        /^Kein Fixture für osrm https:\/\/osrm\/route/u,
      );
    }));

  test("the key is the question, never the asker", () => {
    const url = "https://ors/directions";
    const body = JSON.stringify({ coordinates: [[10, 46]] });
    const withKey = fixtureKey(url, {
      body,
      headers: { Authorization: "secret" },
      method: "POST",
    });
    expect(withKey).toMatch(/^[0-9a-f]{16}$/u);
    expect(withKey).toBe(fixtureKey(url, { body, method: "POST" }));
    expect(withKey).not.toBe(fixtureKey(url, { body: "{}", method: "POST" }));
    expect(fixtureKey(url)).not.toBe(fixtureKey(url, { method: "POST" }));
  });
});
