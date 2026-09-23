import { describe, expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { I18nProvider } from "@/components/i18n";
import type { PanelActions } from "@/components/panel/actions";
import { DestinationDetail } from "@/components/panel/destination-detail";
import { PassDetail } from "@/components/panel/pass-detail";
import { TourDetail } from "@/components/panel/tour-detail";
import { TownDetail } from "@/components/panel/town-detail";
import { membersOf } from "@/lib/destination";
import { BLOCKS, detailModel } from "@/lib/detail-model";
import type { DetailModel } from "@/lib/detail-model";
import type { DetailState } from "@/lib/detail-state";
import { DE } from "@/lib/i18n/dictionaries";
import { entityKey } from "@/lib/route-key";
import type { Destination } from "@/lib/types";
import {
  bundleOf,
  makePass,
  makeTour,
  makeTown,
  PERIOD,
  yearsOf,
} from "@/test/fixtures";

/**
 * The three kind modules, rendered from one fixture.
 *
 * `renderToStaticMarkup` needs no DOM and no browser, which is what makes a
 * test of the panel possible at all: until plan 31 nothing but the e2e ever
 * rendered it, and the e2e only read the title and the close control. What is
 * asserted here is what the model promised – the sentences, the blocks, the
 * lists – rather than any markup detail, so the layout stays free to move.
 */

const passes = [
  makePass("stilfser-joch", 0, { name: "Stilfser Joch", tags: ["hairpins"] }),
  makePass("gavia", 20, { name: "Gavia" }),
];
const tours = [
  makeTour("runde", ["stilfser-joch", "gavia"], { name: "Runde" }),
];
const towns = [makeTown("bormio", 8, { name: "Bormio" })];
const years = yearsOf(
  [
    ["stilfser-joch", "best"],
    ["gavia", "limited"],
  ],
  [["runde", "limited"]],
);
const state: DetailState = { phase: "absent" };
const area: Destination = {
  access: "Bahn bis Tirano.",
  baseTowns: ["bormio"],
  center: { lat: 46, lon: 10.1 },
  character: "Zwei Riesen auf einem Fleck.",
  country: "IT",
  exclude: [],
  include: [],
  multiDay: "Drei Tage reichen.",
  name: "Alta Valtellina",
  radiusKm: 30,
  slug: "valtellina",
};
const data = bundleOf(passes, tours, towns, years, {
  destinationMembers: { valtellina: membersOf(area, passes, tours, towns) },
  destinations: [area],
  nearbyTours: {
    [entityKey("pass", "stilfser-joch")]: [{ km: 3, slug: "runde" }],
    [entityKey("town", "bormio")]: [{ km: 5, slug: "runde" }],
  },
});

const noop = () => {
  /* the markup is what is under test, not the wiring */
};
const actions: PanelActions = {
  onBack: noop,
  onHover: noop,
  onProfileCursor: noop,
  onProfileZoom: noop,
  onSelect: noop,
  onToggleFavorite: noop,
};

const modelOf = <K extends DetailModel["kind"]>(kind: K, slug: string) => {
  const model = detailModel({ kind, slug }, data, {
    detail: state,
    hovered: null,
    period: PERIOD,
    w: DE,
  });
  // A narrow, not a cast: the fixture has the entity, so the discriminant is
  // the proof rather than an assertion over it.
  if (model?.kind !== kind) throw new Error(`kein Modell für ${kind}:${slug}`);
  return model as Extract<DetailModel, { kind: K }>;
};

/** The panels read their words from the provider, as they do on the page. */
const render = (node: React.ReactNode) =>
  renderToStaticMarkup(<I18nProvider messages={DE}>{node}</I18nProvider>);

const html = {
  destination: render(
    <DestinationDetail
      actions={actions}
      model={modelOf("destination", "valtellina")}
    />,
  ),
  pass: render(
    <PassDetail actions={actions} model={modelOf("pass", "stilfser-joch")} />,
  ),
  tour: render(
    <TourDetail actions={actions} model={modelOf("tour", "runde")} />,
  ),
  town: render(
    <TownDetail actions={actions} model={modelOf("town", "bormio")} />,
  ),
};

/** The headings a block is folded by – `Section` writes the id on its root. */
const blocksIn = (markup: string) =>
  [...markup.matchAll(/data-block="(?<id>[^"]+)"/gu)].map((m) => m.groups!.id!);

describe("the four kind modules render their model", () => {
  test("a pass leads with its height and its own sentences", () => {
    // Every German line of it comes from the model, which is the point: the
    // panel used to glue six fragments together in JSX (plan 31 phase B).
    const model = modelOf("pass", "stilfser-joch");
    expect(html.pass).toContain("2.000");
    expect(html.pass).toContain(model.sentences.season);
    expect(html.pass).toContain(model.sentences.note);
    // The towns it could be ridden from are its own ranked block.
    expect(html.pass).toContain("Bormio");
  });

  test("a tour shows the passes of the round, with each one's status", () => {
    const model = modelOf("tour", "runde");
    expect(html.tour).toContain(model.tour.description);
    for (const { pass } of model.members)
      expect(html.tour).toContain(pass.name);
  });

  test("a town shows what it reaches, derived and labelled as derived", () => {
    expect(html.town).toContain(modelOf("town", "bormio").town.why);
    expect(html.town).toContain("Abgeleitet aus den 2 Pässen im Umkreis");
  });

  test("a destination shows its sentences, its members and the way back to its base", () => {
    const model = modelOf("destination", "valtellina");
    expect(html.destination).toContain(area.character);
    expect(html.destination).toContain(area.multiDay);
    expect(html.destination).toContain(area.access);
    expect(model.passes.map((m) => m.pass.slug)).toEqual([
      "stilfser-joch",
      "gavia",
    ]);
    expect(html.destination).toContain(
      "Abgeleitet aus den 2 Straßen im Gebiet",
    );
    expect(html.destination).toContain("Unterkunft suchen");
    expect(html.destination).toContain("Runde");
    // And the town links back up to the area it lies in.
    expect(modelOf("town", "bormio").areas.map((d) => d.slug)).toEqual([
      "valtellina",
    ]);
    expect(html.town).toContain("Alta Valtellina");
  });

  test("each kind renders exactly the blocks its model declares", () => {
    for (const kind of ["pass", "tour", "town", "destination"] as const)
      expect(blocksIn(html[kind])).toEqual(BLOCKS[kind]);
  });

  test("nothing a sibling block already ranked is listed twice", () => {
    // The town's ranked pass list is the destination block; the "Im Umkreis"
    // block below it names only the tours and the other towns.
    const umkreis = html.town.slice(html.town.indexOf('data-block="nearby"'));
    expect(umkreis).not.toContain("Gavia");
    expect(umkreis).toContain("Runde");
  });
});
