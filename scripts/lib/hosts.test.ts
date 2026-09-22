import { describe, expect, test } from "bun:test";

import {
  CLIMATE_WEIGHT,
  commons,
  github,
  openMeteo,
  ORS_KEY,
  ors,
  osmMap,
  osrm,
  overpass,
} from "./hosts";
import { overpassPost } from "./locate";
import type { HostId, Transport } from "./transport";
import { LIMITS } from "./validate";

interface Asked {
  host: HostId;
  init: RequestInit | undefined;
  url: string;
  weight: number | undefined;
}

/** Records every question and answers them in order. */
const recording = (answers: unknown[]) => {
  const asked: Asked[] = [];
  const t: Transport = {
    getBytes: (host, url, init) => {
      asked.push({ host, init, url, weight: undefined });
      return Promise.resolve({
        bytes: new Uint8Array([1]),
        type: "image/jpeg",
      });
    },
    getJson: (host, url, init, weight) => {
      asked.push({ host, init, url, weight });
      return Promise.resolve(answers.shift());
    },
  };
  return { asked, t };
};

/** The error a promise rejects with. */
const rejection = async (p: Promise<unknown>): Promise<Error> => {
  try {
    await p;
  } catch (error) {
    return error as Error;
  }
  throw new Error("resolved instead of rejecting");
};

const a = { lat: 46.2, lon: 10.1 };
const b = { lat: 46.4, lon: 10.3 };
const line = (...coords: [number, number][]) => ({
  geometry: { coordinates: coords },
});

describe("ors.route", () => {
  test("posts the chunk with the gate's snap radius and returns [lat, lon] to 5 decimals", async () => {
    const { asked, t } = recording([
      { features: [line([10.1, 46.2], [10.123456, 46.3], [10.3, 46.4])] },
    ]);
    expect(await ors.route(t, [a, b])).toEqual([
      [46.2, 10.1],
      [46.3, 10.12346],
      [46.4, 10.3],
    ]);
    expect(asked).toHaveLength(1);
    const [q] = asked;
    expect(q!.host).toBe("ors");
    expect(q!.url).toBe(
      "https://api.openrouteservice.org/v2/directions/cycling-road/geojson",
    );
    expect(q!.init?.method).toBe("POST");
    expect(q!.init?.headers).toEqual({
      Authorization: ORS_KEY,
      "Content-Type": "application/json",
    });
    expect(JSON.parse(q!.init?.body as string)).toEqual({
      coordinates: [
        [10.1, 46.2],
        [10.3, 46.4],
      ],
      instructions: false,
      radiuses: [
        LIMITS.ascent.maxStartDist * 1000,
        LIMITS.ascent.maxStartDist * 1000,
      ],
    });
  });

  test("50 waypoints per request, overlapping by one, stitched without the shared point", async () => {
    const waypoints = Array.from({ length: 51 }, (_, i) => ({
      lat: 46 + i / 100,
      lon: 10,
    }));
    const { asked, t } = recording([
      { features: [line([10, 46], [10, 46.49])] },
      { features: [line([10, 46.49], [10, 46.5])] },
    ]);
    expect(await ors.route(t, waypoints)).toEqual([
      [46, 10],
      [46.49, 10],
      [46.5, 10],
    ]);
    const sizes = asked.map(
      (q) =>
        (JSON.parse(q.init?.body as string) as { coordinates: unknown[] })
          .coordinates.length,
    );
    expect(sizes).toEqual([50, 2]);
  });
});

describe("osrm.route", () => {
  test("asks the demo server with lon,lat pairs and the full geometry", async () => {
    const { asked, t } = recording([
      { code: "Ok", routes: [line([10.1, 46.2], [10.3, 46.4])] },
    ]);
    expect(await osrm.route(t, [a, b])).toEqual([
      [46.2, 10.1],
      [46.4, 10.3],
    ]);
    expect(asked).toEqual([
      {
        host: "osrm",
        init: undefined,
        url: "https://router.project-osrm.org/route/v1/driving/10.1,46.2;10.3,46.4?overview=full&geometries=geojson",
        weight: undefined,
      },
    ]);
  });

  test("12 waypoints per request", async () => {
    const waypoints = Array.from({ length: 13 }, (_, i) => ({
      lat: 46 + i / 100,
      lon: 10,
    }));
    const { asked, t } = recording([
      { code: "Ok", routes: [line([10, 46], [10, 46.11])] },
      { code: "Ok", routes: [line([10, 46.11], [10, 46.12])] },
    ]);
    expect(await osrm.route(t, waypoints)).toHaveLength(3);
    expect(
      asked.map(
        (q) => q.url.split("/driving/")[1]!.split("?")[0]!.split(";").length,
      ),
    ).toEqual([12, 2]);
  });

  test("an answer that is not Ok is the error", async () => {
    const { t } = recording([{ code: "NoRoute" }]);
    const error = await rejection(osrm.route(t, [a, b]));
    expect(error.message).toBe("NoRoute");
  });
});

describe("openMeteo", () => {
  test("elevation: one URL for the batch, billed one call per point", async () => {
    const { asked, t } = recording([{ elevation: [2757.5, 1200] }]);
    expect(await openMeteo.elevation(t, [a, b])).toEqual([2757.5, 1200]);
    expect(asked).toEqual([
      {
        host: "openMeteo",
        init: undefined,
        url: "https://api.open-meteo.com/v1/elevation?latitude=46.2,46.4&longitude=10.1,10.3",
        weight: 2,
      },
    ]);
  });

  test("archive: the frozen ten years at the pass elevation, 261 calls", async () => {
    const daily = {
      precipitation_sum: [0.4],
      snowfall_sum: [null],
      temperature_2m_max: [3.2],
      temperature_2m_min: [-1.1],
      time: ["2015-01-01"],
    };
    const { asked, t } = recording([{ daily }]);
    expect(await openMeteo.archive(t, { ...a, elevation: 2757 })).toEqual(
      daily,
    );
    expect(CLIMATE_WEIGHT).toBe(261);
    expect(asked).toEqual([
      {
        host: "openMeteo",
        init: undefined,
        url: "https://archive-api.open-meteo.com/v1/archive?latitude=46.2&longitude=10.1&elevation=2757&start_date=2015-01-01&end_date=2024-12-31&daily=temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_sum&timezone=Europe%2FBerlin",
        weight: 261,
      },
    ]);
  });

  test("a malformed answer does not become a number", async () => {
    const { t } = recording([{ elevation: ["high"] }]);
    expect(await rejection(openMeteo.elevation(t, [a]))).toBeInstanceOf(Error);
  });
});

describe("osm", () => {
  test("overpass.query posts the query as a form and keeps nodes and ways", async () => {
    const node = {
      id: 1,
      lat: 46.2,
      lon: 10.1,
      tags: { name: "x" },
      type: "node" as const,
    };
    const way = {
      geometry: [{ lat: 46.2, lon: 10.1 }],
      id: 2,
      type: "way" as const,
    };
    const mapWay = { id: 3, nodes: [1], tags: {}, type: "way" as const };
    const { asked, t } = recording([
      {
        elements: [node, way, { id: 4, members: [], type: "relation" }, mapWay],
      },
    ]);
    expect(await overpass.query(t, "[out:json];node(1);out;")).toEqual([
      node,
      way,
      mapWay,
    ]);
    expect(asked).toEqual([
      {
        host: "overpass",
        init: overpassPost("[out:json];node(1);out;"),
        url: "https://overpass-api.de/api/interpreter",
        weight: undefined,
      },
    ]);
  });

  test("osmMap.bbox asks the map API for the box as JSON", async () => {
    const { asked, t } = recording([{}]);
    expect(await osmMap.bbox(t, "10.1,46.2,10.3,46.4")).toEqual([]);
    expect(asked).toEqual([
      {
        host: "osmApi",
        init: undefined,
        url: "https://api.openstreetmap.org/api/0.6/map.json?bbox=10.1,46.2,10.3,46.4",
        weight: undefined,
      },
    ]);
  });
});

describe("commons", () => {
  const ua = {
    "User-Agent":
      "alpenpaesse-data-build/1.0 (https://github.com/mdugue/alpen; mail@manuel.fyi)",
  };
  const page = {
    imageinfo: [
      {
        descriptionurl: "https://commons.wikimedia.org/wiki/File:X.jpg",
        extmetadata: { Artist: { value: "A" } },
        height: 900,
        mime: "image/jpeg",
        thumburl: "https://upload.wikimedia.org/x/800px-X.jpg",
        url: "https://upload.wikimedia.org/x/X.jpg",
        width: 1600,
      },
    ],
    title: "File:X.jpg",
  };

  test("geosearch around a point, in the API's order", async () => {
    const { asked, t } = recording([{ query: { pages: [page] } }]);
    expect(await commons.geosearch(t, a, 2000)).toEqual([page]);
    expect(asked).toEqual([
      {
        host: "commons",
        init: { headers: ua },
        url: "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&iiextmetadatafilter=Artist%7CCredit%7CLicenseShortName%7CLicenseUrl&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=800&prop=imageinfo&generator=geosearch&ggscoord=46.2%7C10.1&ggslimit=50&ggsnamespace=6&ggsradius=2000",
        weight: undefined,
      },
    ]);
  });

  test("search by name, bitmaps only; no pages is an empty list", async () => {
    const { asked, t } = recording([{ batchcomplete: true }]);
    expect(await commons.search(t, "Passo dello Stelvio")).toEqual([]);
    expect(asked[0]!.url).toBe(
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&iiextmetadatafilter=Artist%7CCredit%7CLicenseShortName%7CLicenseUrl&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=800&prop=imageinfo&generator=search&gsrlimit=30&gsrnamespace=6&gsrsearch=filetype%3Abitmap+Passo+dello+Stelvio",
    );
  });

  test("thumbnail: the CDN host, same User-Agent, bytes as they are", async () => {
    const { asked, t } = recording([]);
    const url = "https://upload.wikimedia.org/x/20px-X.jpg";
    expect(await commons.thumbnail(t, url)).toEqual({
      bytes: new Uint8Array([1]),
      type: "image/jpeg",
    });
    expect(asked).toEqual([
      { host: "commonsThumb", init: { headers: ua }, url, weight: undefined },
    ]);
  });
});

test("github.release: the asset's download URL", async () => {
  const { asked, t } = recording([]);
  await github.release(t, "rsms/inter", "v4.1", "Inter-4.1.zip");
  expect(asked).toEqual([
    {
      host: "github",
      init: undefined,
      url: "https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip",
      weight: undefined,
    },
  ]);
});
