/**
 * The one place the scripts talk to the network.
 *
 * Every host a script asks – the routers, Open-Meteo, Overpass and the OSM map
 * API, Wikimedia Commons and its file CDN, the GitHub release the glyphs come
 * from – is a row of `HOSTS`, and `liveTransport` builds one pacer per row.
 * The scripts never see a `fetch`: `scripts/lib/hosts.ts` composes the URL and
 * parses the answer, and this module decides when the request may go out,
 * what to do with a 429 and when a host is spent for the run. Before this
 * seam existed the same pacing was written four times, once per script, each
 * time a little differently.
 *
 * Rate limits. Every upstream host gets its own pacer; requests to one host are
 * sequential, the pipelines for different hosts (routing vs. Open-Meteo) run in
 * parallel. Open-Meteo bills weighted "calls", so the pacer spaces requests by
 * weight and a per-run budget stops the run before the hourly quota does.
 *
 *   OSRM demo      1 request/s, no key ("Do not exceed 1 request per second")
 *   ORS free       40 requests/min, 2 000/day; 403 "Quota exceeded" once spent
 *   Open-Meteo     600 calls/min, 5 000/h, 10 000/day per IP, shared by ALL
 *                  open-meteo.com hosts. 1 call = 1 location × ≤14 days × ≤10
 *                  variables. Observed: an elevation request with 100 points costs
 *                  ~100 calls, a 10-year daily climate request ~261 calls. The free
 *                  tier therefore fits ~40 profiles or ~19 climate series per hour.
 *   Overpass       fair use, no key; a handful of batched queries per run. Its
 *                  fallback, the OSM map API, answers one point per request
 *                  rather than a whole batch (scripts/lib/osm.ts), so it is
 *                  paced on its own.
 *   Commons API    a descriptive User-Agent and moderate serial use. The whole
 *                  photo run is ~120 requests, so three seconds costs six
 *                  minutes even from cold – and Commons' budget for an anonymous
 *                  client is small enough that one per second walks into a 429
 *                  whose Retry-After is longer than the gap it saved.
 *   Commons CDN    the placeholders. A different budget and a far cheaper
 *                  request – but there are up to six per entity and ~1 500 in a
 *                  first run, and a 20-px width nobody has asked for before has
 *                  to be rendered on demand, so the CDN answers a sustained
 *                  burst with 429 like anything else. Serial, paced, and the
 *                  pace gives way: a 429 doubles the gap, and a stretch of
 *                  answers with no complaint in it halves it back down, to the
 *                  starting value and no further.
 *
 * OPEN_METEO_BUDGET (default 4500) caps the weighted calls per run. What a run
 * does with what it did not get to is the script's business, not this module's –
 * scripts/build-data.ts says how the backlog is drained.
 *
 * A 429/403 whose body says the hour/day quota is spent stops that host for this
 * run – retrying would only burn the next window. A minutely 429 or a 5xx pauses
 * the host (Retry-After or the host's own backoff) and retries.
 *
 * The second adapter, `fixtureTransport`, answers from recorded files – today
 * the coverage report's cache (`scripts/analyze-coverage.ts`).
 */
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type HostId =
  | "ors"
  | "osrm"
  | "openMeteo"
  | "overpass"
  | "osmApi"
  | "commons"
  | "commonsThumb"
  | "github";

/** A binary answer with the media type the host declared for it. */
export interface Bytes {
  bytes: Uint8Array;
  type: string;
}

export interface Transport {
  /** Fetches and parses; throws for anything that is not a 200. */
  getJson: (
    host: HostId,
    url: string,
    init?: RequestInit,
    /** What the host bills for this request; only Open-Meteo weighs. */
    weight?: number,
  ) => Promise<unknown>;
  getBytes: (host: HostId, url: string, init?: RequestInit) => Promise<Bytes>;
}

/** What a host gets after a 429 or a 5xx, and for how long it is worth trying. */
interface RetryPolicy {
  /** Requests before the host gives up on one question. */
  attempts: number;
  /** A Retry-After longer than this is cut to it. */
  retryAfterMax: number;
  /** The pause when the answer names no usable Retry-After. */
  backoff: (status: number, attempt: number) => number;
}
/** A minute for a 429 – the minute always passes – and 5, 10, 15 s for a 5xx. */
const STEPPED: RetryPolicy = {
  attempts: 5,
  backoff: (status, attempt) =>
    status === 429 ? 60_000 : 5000 * (attempt + 1),
  retryAfterMax: 90_000,
};
/** Commons names its Retry-After and means it; without one, 10 s doubling. */
const DOUBLING: RetryPolicy = {
  attempts: 6,
  backoff: (_status, attempt) => 10_000 * 2 ** attempt,
  retryAfterMax: Infinity,
};

interface HostSpec extends RetryPolicy {
  /** In the log lines and the error messages. */
  name: string;
  /** The pace: the gap after a request is weight / this. Absent: no gap. */
  callsPerMinute?: number;
  /**
   * A gap that follows the host's pushback instead of a fixed rate: doubled
   * on every 429 up to `max`, halved back down after `calm` untroubled
   * answers, never below `min`.
   */
  adaptive?: { min: number; max: number; calm: number };
  /** Weighted calls per run, from this environment variable. */
  budget?: { env: string; fallback: number };
}

/**
 * One row per host – the only place a pace, a budget or a retry policy is
 * written down. `ors` and `osrm` exist side by side: ORS is asked first, and
 * when its daily quota runs out the run continues on the OSRM demo instead of
 * stopping (`scripts/build-data.ts` decides that; the gate makes it safe).
 * Open-Meteo's elevation and archive hosts share one quota per IP, so they are
 * one row.
 */
export const HOSTS: Record<HostId, HostSpec> = {
  commons: { ...DOUBLING, callsPerMinute: 20, name: "Commons" },
  commonsThumb: {
    ...DOUBLING,
    adaptive: { calm: 25, max: 5000, min: 400 },
    name: "Commons-CDN",
  },
  github: { ...STEPPED, name: "GitHub" },
  openMeteo: {
    ...STEPPED,
    budget: { env: "OPEN_METEO_BUDGET", fallback: 4500 },
    callsPerMinute: 500,
    name: "Open-Meteo",
  },
  ors: { ...STEPPED, callsPerMinute: 38, name: "OpenRouteService" },
  osmApi: { ...STEPPED, callsPerMinute: 30, name: "OSM-API" },
  osrm: { ...STEPPED, callsPerMinute: 55, name: "OSRM-Demo" },
  overpass: { ...STEPPED, callsPerMinute: 20, name: "Overpass" },
};
const HOST_IDS = Object.keys(HOSTS) as HostId[];

export class QuotaExhaustedError extends Error {
  name = "QuotaExhaustedError";

  constructor(host: string, reason: string) {
    super(`${host}: ${reason}`);
  }
}

/**
 * A response the host answered but refused. Carries the status so a caller can
 * tell "this host will not answer this question" (ORS 404 on a road it does not
 * route) from "this request was wrong" (400, 401) – the first has a fallback,
 * the second is a bug and has to surface.
 */
export class HttpError extends Error {
  name = "HttpError";
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * The host kept answering 429 or 5xx for as long as the retries allowed. For
 * the photo run that ends the run without failing it: what it had is already
 * on disk, and the next run picks up there.
 */
export class RateLimitedError extends Error {
  name = "RateLimitedError";
}

/** Injected so a test can run a minute of pacing in no time. */
export interface Clock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

/**
 * Sequential per-host pacer. `weight` is what the host bills for the request;
 * the gap to the next request is weight / callsPerMinute – or, for an adaptive
 * host, whatever the pushback has set it to.
 */
class Limiter {
  private chain: Promise<unknown> = Promise.resolve();
  private nextAt = 0;
  /** Set once the host's quota (or our budget) is spent; remaining tasks skip. */
  exhausted: string | null = null;
  requests = 0;
  used = 0;

  readonly name: string;
  readonly budget: number;
  private readonly callsPerMinute: number | undefined;
  private readonly adaptive: HostSpec["adaptive"];
  private gap: number;
  private sinceThrottled = 0;
  private readonly clock: Clock;

  constructor(spec: HostSpec, budget: number, clock: Clock) {
    this.name = spec.name;
    this.callsPerMinute = spec.callsPerMinute;
    this.adaptive = spec.adaptive;
    this.gap = spec.adaptive?.min ?? 0;
    this.budget = budget;
    this.clock = clock;
  }

  private gapFor(weight: number) {
    if (this.adaptive) return this.gap;
    return this.callsPerMinute ? (weight * 60_000) / this.callsPerMinute : 0;
  }

  run<T>(fn: () => Promise<T>, weight = 1): Promise<T> {
    const p = this.chain.then(async () => {
      if (!this.exhausted && this.used + weight > this.budget)
        this.exhausted = `Budget von ${this.budget} Calls für diesen Lauf erreicht`;
      if (this.exhausted)
        throw new QuotaExhaustedError(this.name, this.exhausted);
      const wait = this.nextAt - this.clock.now();
      if (wait > 0) await this.clock.sleep(wait);
      this.nextAt = this.clock.now() + this.gapFor(weight);
      this.used += weight;
      this.requests += 1;
      return await fn();
    });
    this.chain = p.catch(() => {
      // Failures surface through `p`; the chain only sequences the calls.
    });
    return p;
  }

  pause(ms: number) {
    this.nextAt = Math.max(this.nextAt, this.clock.now() + ms);
  }

  /**
   * Being told to slow down is the only measurement of "too fast" there is,
   * so it is the one an adaptive gap follows. Backing off is instant – one
   * 429 doubles the gap – and only the apology is gradual: `calm` answers
   * without a complaint halve it again, never below where it started.
   */
  slowDown() {
    if (!this.adaptive) return;
    this.gap = Math.min(this.gap * 2, this.adaptive.max);
    this.sinceThrottled = 0;
  }

  wentWell() {
    if (!this.adaptive) return;
    this.sinceThrottled += 1;
    if (this.sinceThrottled < this.adaptive.calm) return;
    this.sinceThrottled = 0;
    this.gap = Math.max(this.gap / 2, this.adaptive.min);
  }
}

/** The state of one host, for the closing lines of a run. */
export type HostState = Pick<
  Limiter,
  "budget" | "exhausted" | "name" | "requests" | "used"
>;

export interface LiveTransport extends Transport {
  host: (id: HostId) => HostState;
}

export interface LiveOptions {
  fetch?: typeof globalThis.fetch;
  env?: Record<string, string | undefined>;
  log?: (line: string) => void;
  clock?: Clock;
  /**
   * A per-run budget instead of the host's own. `Infinity` hands the stopping
   * back to the host's quota, which is what a script wants that writes nothing
   * and is watched by the person who started it (`scripts/locate-pass.ts`).
   */
  budgets?: Partial<Record<HostId, number>>;
}

/** A refused answer's reason: the JSON `reason`/`error` field, else the body. */
const reasonOf = (body: string) =>
  (() => {
    try {
      return (
        (JSON.parse(body) as { reason?: string; error?: string }).reason ?? body
      );
    } catch {
      return body;
    }
  })()
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, 120);

/** Open-Meteo: 429 "Hourly/Daily API request limit exceeded"; ORS: 403 "Quota exceeded" (daily). */
const quotaSpent = (status: number, reason: string) =>
  (status === 429 && /hourly|daily/iu.test(reason)) ||
  (status === 403 && /quota/iu.test(reason));

export const liveTransport = ({
  fetch = globalThis.fetch,
  env = process.env,
  log = (line) => console.log(line),
  clock = { now: Date.now, sleep: Bun.sleep },
  budgets = {},
}: LiveOptions = {}): LiveTransport => {
  const limiters = Object.fromEntries(
    HOST_IDS.map((id) => {
      const spec = HOSTS[id];
      const budget =
        budgets[id] ??
        (spec.budget
          ? Number(env[spec.budget.env] ?? spec.budget.fallback)
          : Infinity);
      return [id, new Limiter(spec, budget, clock)];
    }),
  ) as Record<HostId, Limiter>;

  const request = <T>(
    host: HostId,
    url: string,
    init: RequestInit | undefined,
    weight: number,
    read: (res: Response) => Promise<T>,
  ): Promise<T> => {
    const spec = HOSTS[host];
    const lim = limiters[host];
    return lim.run(async () => {
      for (let attempt = 0; attempt < spec.attempts; attempt += 1) {
        const res = await fetch(url, init);
        if (res.ok) {
          lim.wentWell();
          return await read(res);
        }

        const reason = reasonOf(await res.text().catch(() => ""));
        if (quotaSpent(res.status, reason)) {
          lim.exhausted = reason;
          throw new QuotaExhaustedError(lim.name, reason);
        }
        if (res.status === 429 || res.status >= 500) {
          if (res.status === 429) lim.slowDown();
          // Nothing follows the last attempt, so waiting for it would only
          // add the backoff – up to five minutes on the Commons hosts – to a
          // run that has already given up.
          if (attempt === spec.attempts - 1) break;
          const retryAfter = Number(res.headers.get("retry-after")) * 1000;
          const wait =
            retryAfter > 0
              ? Math.min(retryAfter, spec.retryAfterMax)
              : spec.backoff(res.status, attempt);
          log(
            `  ${lim.name} ${res.status} (${reason || "keine Angabe"}), warte ${wait / 1000}s …`,
          );
          lim.pause(wait);
          await clock.sleep(wait);
          continue;
        }
        throw new HttpError(
          res.status,
          `${res.status} ${reason} ${url.slice(0, 80)}`,
        );
      }
      throw new RateLimitedError(
        `${lim.name}: aufgegeben nach ${spec.attempts} Versuchen`,
      );
    }, weight);
  };

  return {
    getBytes: (host, url, init) =>
      request(host, url, init, 1, async (res) => ({
        bytes: new Uint8Array(await res.arrayBuffer()),
        type: res.headers.get("content-type")?.split(";")[0] ?? "",
      })),
    getJson: (host, url, init, weight = 1) =>
      request(host, url, init, weight, (res) => res.json()),
    host: (id) => limiters[id],
  };
};

// ---------------------------------------------------------------------------
// Recorded answers

/** What one fixture file holds: the question, so a reviewer can read it, and the answer. */
interface Fixture {
  method: string;
  url: string;
  body?: string;
  recordedAt: string;
  json?: unknown;
  bytes?: { type: string; base64: string };
}

export interface FixtureOptions {
  /** Ask `live` again and overwrite what is on disk – `--refresh` for a cache. */
  record?: boolean;
  /**
   * Where a missing answer comes from. Without it a question that has no
   * fixture is an error, which is what a test wants; with it the file is
   * filled in on first use, which is what a cache wants.
   */
  live?: Transport;
}

export interface FixtureTransport extends Transport {
  /** Answers that came from disk, and answers `live` gave and were written. */
  replayed: number;
  recorded: number;
}

const bodyText = (init?: RequestInit) =>
  typeof init?.body === "string" ? init.body : "";

/** The file name: a hash of what was asked, never of who asked (no headers, so no key). */
export const fixtureKey = (url: string, init?: RequestInit) =>
  createHash("sha256")
    .update(`${init?.method ?? "GET"}\n${url}\n${bodyText(init)}`)
    .digest("hex")
    .slice(0, 16);

/**
 * Answers from `<dir>/<host>/<hash>.json`. The same seam as the live
 * transport, so a script or a test runs against recorded answers without
 * knowing it – and recording is the same code path with `live` behind it.
 */
export const fixtureTransport = (
  dir: URL | string,
  { record = false, live }: FixtureOptions = {},
): FixtureTransport => {
  // A relative path is relative to where the script was started, not to the
  // filesystem root – which is what `new URL(dir, "file://")` would make of it.
  const base =
    dir instanceof URL ? dir : pathToFileURL(`${path.resolve(dir)}${path.sep}`);
  const fileOf = (host: HostId, url: string, init?: RequestInit) =>
    new URL(`${host}/${fixtureKey(url, init)}.json`, base);
  const count = { recorded: 0, replayed: 0 };

  const answer = async <T>(
    host: HostId,
    url: string,
    init: RequestInit | undefined,
    fromFixture: (f: Fixture) => T | undefined,
    fromLive: () => Promise<T>,
    toFixture: (value: T) => Partial<Fixture>,
  ): Promise<T> => {
    const file = Bun.file(fileOf(host, url, init));
    if (!record && (await file.exists())) {
      const stored = fromFixture((await file.json()) as Fixture);
      if (stored !== undefined) {
        count.replayed += 1;
        return stored;
      }
    }
    if (!live)
      throw new Error(
        `Kein Fixture für ${host} ${url.slice(0, 80)} – im Aufnahmemodus des Skripts aufnehmen (record)`,
      );
    const value = await fromLive();
    const fixture: Fixture = {
      method: init?.method ?? "GET",
      recordedAt: new Date().toISOString().slice(0, 10),
      url,
      ...(bodyText(init) ? { body: bodyText(init) } : {}),
      ...toFixture(value),
    };
    await mkdir(new URL(`${host}/`, base), { recursive: true });
    await Bun.write(file, `${JSON.stringify(fixture)}\n`);
    count.recorded += 1;
    return value;
  };

  return {
    getBytes: (host, url, init) =>
      answer<Bytes>(
        host,
        url,
        init,
        (f) =>
          f.bytes
            ? {
                bytes: new Uint8Array(Buffer.from(f.bytes.base64, "base64")),
                type: f.bytes.type,
              }
            : undefined,
        () => live!.getBytes(host, url, init),
        (v) => ({
          bytes: {
            base64: Buffer.from(v.bytes).toString("base64"),
            type: v.type,
          },
        }),
      ),
    getJson: (host, url, init, weight) =>
      answer<unknown>(
        host,
        url,
        init,
        (f) => ("json" in f ? f.json : undefined),
        () => live!.getJson(host, url, init, weight),
        (v) => ({ json: v }),
      ),
    get recorded() {
      return count.recorded;
    },
    get replayed() {
      return count.replayed;
    },
  };
};
