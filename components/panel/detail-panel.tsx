"use client";

import { Check, ChevronLeft, ExternalLink, Share, Star, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useSheetExpanded } from "@/components/mobile-sheet";
import { CHART_HEIGHT } from "@/components/panel/chart-size";
import {
  BasesSection,
  DestinationSection,
} from "@/components/panel/destination";
import {
  ElevationProfile,
  PROFILE_ASPECT,
} from "@/components/panel/elevation-profile";
import { PhotoCarousel } from "@/components/panel/photo-carousel";
import { Section } from "@/components/panel/section";
import { WeatherForecast } from "@/components/panel/weather-forecast";
import { Rating } from "@/components/rating";
import { SeasonStrip } from "@/components/season-strip";
import { StatusBadge, StatusDot } from "@/components/status-badge";
import { TagBadges } from "@/components/tags";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import type { EntityKind, Selection } from "@/lib/app-state";
import { clockTime, periodDate, sunTimes } from "@/lib/daylight";
import { basesFor, destinationAt } from "@/lib/destination";
import type { DetailAssets, DetailData } from "@/lib/detail-assets";
import { haversine, REACH_MAX_KM } from "@/lib/geo";
import { komootHref, quaeldichHref } from "@/lib/links";
import { nearbyKey } from "@/lib/nearby";
import type { NearbyTours } from "@/lib/nearby";
import { photoKey } from "@/lib/photos";
import { isTraverse, ROAD_TYPE } from "@/lib/regions";
import { ascentKey } from "@/lib/route-key";
import {
  cellAt,
  daysOf,
  indexBySlug,
  inputAt,
  periodIndex,
  periodLabel,
  reasonTexts,
  seasonText,
  tourText,
  valleyText,
  signalsOf,
} from "@/lib/status";
import type { Years } from "@/lib/status";
import type {
  ClimateYear,
  LatLon,
  Pass,
  Period,
  Photo,
  ProfileWithCoords,
  Tour,
  Town,
} from "@/lib/types";
import useFetch from "@/lib/use-fetch";
import { useShare } from "@/lib/use-share";
import {
  cn,
  fmt,
  fmtUnit,
  ICON_TOGGLE,
  OVERLAY_CONTROL,
  TOUCH_ICON,
} from "@/lib/utils";

/**
 * recharts is the heaviest thing this app would ship; the climate chart is
 * the only user of it and only appears once a pass is selected, so it stays
 * in its own chunk.
 */
const ClimateChart = dynamic(
  async () => {
    const m = await import("@/components/panel/climate-chart");
    return m.ClimateChart;
  },
  {
    // The chunk arrives a moment after the panel, and without a placeholder of
    // the chart's own height everything below it jumps when it does.
    loading: () => (
      <Skeleton
        aria-busy
        aria-label="Klimadiagramm wird geladen"
        className={cn("mt-3 w-full", CHART_HEIGHT)}
        role="status"
      />
    ),
  },
);

/**
 * How tall the floating control row is – what the head has to have scrolled
 * past before the row takes on a surface and the name.
 */
const BAR_PX = 44;

const TRAFFIC_LABEL = [
  "",
  "fast autofrei",
  "ruhig",
  "normal",
  "viel",
  "Durchgangsstraße",
];

interface Props {
  selection: Selection;
  period: Period;
  passes: Pass[];
  tours: Tour[];
  towns: Town[];
  /** Precomputed on the server: which tours run within reach of each entity. */
  nearbyTours: NearbyTours;
  /** One URL per entity for its profiles and photos; see `lib/detail-assets.ts`. */
  detail: DetailAssets;
  climate: Record<string, ClimateYear>;
  /** Lowest ascent start per pass, for the derived valley heat. */
  valleys: Record<string, number>;
  /** The 24 graded half-months of every pass and tour (`getYears`, lib/data.ts). */
  years: Years;
  isFavorite: (kind: EntityKind, slug: string) => boolean;
  onToggleFavorite: (kind: EntityKind, slug: string) => void;
  /**
   * What the pointer is over, anywhere on screen. Every entity named in this
   * panel is a link to a mark on the map, so every one of them lights that
   * mark – the same `hovered` the sidebar rows and the map itself share.
   */
  hovered: Selection | null;
  onHover: (sel: Selection | null) => void;
  /** Road point under the profile cursor, drawn on the map; `null` clears it. */
  onProfileCursor: (point: LatLon | null) => void;
  /** Click on the profile: fly the map to that point to look at the hairpins. */
  onProfileZoom: (point: LatLon) => void;
  onSelect: (sel: Selection) => void;
  onBack: () => void;
  /**
   * On a phone with the list drawer open underneath, dismissing the detail
   * uncovers the list – so the control says "back to the list". Opened from
   * the map with nothing underneath it simply closes, and says that instead.
   * Naming the wrong destination is worse than naming none.
   */
  backToList?: boolean;
}

/**
 * The selected entity's detail file: what it carried, and whether it is still
 * on the way. The panel renders before it arrives – the name, the status, the
 * season strip and the ratings are all in the page – so the two blocks that
 * wait for it say so rather than appearing out of nowhere.
 */
interface DetailState {
  profiles: Record<string, ProfileWithCoords>;
  photos: Photo[];
  loading: boolean;
}

/**
 * The one line of numbers over an elevation profile – and on a traverse, two
 * numbers fewer.
 *
 * `elevationGain` and `maxKmGradient` accumulate over a hundred DEM samples,
 * and a 90 m Copernicus cell in a gorge averages the road, the wall above it
 * and the river below into one height. On a climb that noise disappears under
 * the real ascent; on a balcony road there is no real ascent to hide it, and
 * the Gorges du Cians come out at 1 766 Hm for 974 m of net climb. Showing
 * that next to "Ø 4,8 %" would present a measurement the data cannot support
 * (principle 3), so the traverse types get `km`, the average and the two end
 * heights – `avgGradient` reads `start` and `top` only, two samples instead of
 * a hundred, and is sound either way. The section's info tooltip says why the
 * other two are missing.
 */
const profileLine = (profile: ProfileWithCoords, traverse: boolean) =>
  [
    fmtUnit(profile.km, "km", 1),
    ...(traverse ? [] : [fmtUnit(profile.elevationGain, "hm")]),
    `Ø ${fmt(profile.avgGradient, 1)} %`,
    ...(traverse ? [] : [`steilster km ${fmt(profile.maxKmGradient, 1)} %`]),
    `${fmt(profile.start)} → ${fmtUnit(profile.top, "m")}`,
  ].join(" · ");

const ExternalLinks = ({ links }: { links: [string, string][] }) => (
  <div className="mt-4 flex flex-wrap gap-1.5">
    {links.map(([label, href]) => (
      <Button
        key={label}
        variant="outline"
        size="sm"
        render={<a href={href} target="_blank" rel="noopener noreferrer" />}
        nativeButton={false}
      >
        {label}
        <ExternalLink data-icon="inline-end" />
        <span className="sr-only"> (öffnet in neuem Tab)</span>
      </Button>
    ))}
  </div>
);

/**
 * A named entity inside the panel. It is a link to a mark on the map, so it
 * behaves like one: pointing at it lights the mark, exactly as pointing at a
 * sidebar row does. Focus counts as pointing, so the keyboard gets it too.
 */
const LinkButton = ({
  children,
  onClick,
  hovered,
  onHover,
}: {
  children: React.ReactNode;
  onClick: () => void;
  hovered?: boolean;
  onHover?: (over: boolean) => void;
}) => (
  <Button
    variant="link"
    size="sm"
    className={cn(
      "h-auto gap-1 rounded-sm px-0 py-0.5",
      hovered && "bg-accent/20 -mx-1 px-1",
    )}
    onClick={onClick}
    onPointerEnter={onHover && (() => onHover(true))}
    onPointerLeave={onHover && (() => onHover(false))}
    onFocus={onHover && (() => onHover(true))}
    onBlur={onHover && (() => onHover(false))}
  >
    {children}
  </Button>
);

/** One labelled row of the nearby list. */
const group = (label: string, items: React.ReactNode) => (
  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
    <span className="text-muted-foreground text-xs">{label}</span>
    {items}
  </div>
);

const Nearby = ({
  lat,
  lon,
  exclude,
  skipPasses,
  skipTowns,
  ...p
}: Props & {
  lat: number;
  lon: number;
  exclude?: string;
  /** A destination block above already ranks the passes; do not list them twice. */
  skipPasses?: boolean;
  /** Likewise for the towns, where a bases block above already ranks them. */
  skipTowns?: boolean;
}) => {
  const nearPasses = skipPasses
    ? []
    : p.passes
        .map((x) => ({ d: haversine({ lat, lon }, x), x }))
        .filter((e) => e.d <= REACH_MAX_KM && e.x.slug !== exclude)
        .toSorted((a, b) => a.d - b.d);
  // Tours are lines, so their reach was measured on the server (lib/nearby.ts).
  const slugs = p.nearbyTours[nearbyKey(p.selection.kind, p.selection.slug)];
  const nearTours = p.tours.filter((t) => slugs?.includes(t.slug));
  const nearTowns = skipTowns
    ? []
    : p.towns
        .map((x) => ({ d: haversine({ lat, lon }, x), x }))
        .filter((e) => e.d <= REACH_MAX_KM && e.x.slug !== exclude)
        .toSorted((a, b) => a.d - b.d);

  if (nearPasses.length + nearTours.length + nearTowns.length === 0)
    return null;

  /** The hover wiring every named entity in this block shares. */
  const link = (kind: EntityKind, slug: string) => ({
    hovered: p.hovered?.kind === kind && p.hovered.slug === slug,
    onHover: (over: boolean) => p.onHover(over ? { kind, slug } : null),
  });

  return (
    <Section id="nearby" title={`Im Umkreis von ${REACH_MAX_KM} km`}>
      <div className="flex flex-col gap-1">
        {nearPasses.length > 0 &&
          group(
            "Pässe",
            nearPasses.map(({ x, d }) => (
              <LinkButton
                key={x.slug}
                {...link("pass", x.slug)}
                onClick={() => p.onSelect({ kind: "pass", slug: x.slug })}
              >
                <StatusDot
                  status={cellAt(p.years.passes[x.slug], p.period).status}
                />{" "}
                {x.name}
                <span className="text-muted-foreground">
                  {fmtUnit(d, "km")}
                </span>
              </LinkButton>
            )),
          )}
        {nearTours.length > 0 &&
          group(
            "Touren",
            nearTours.map((t) => (
              <LinkButton
                key={t.slug}
                {...link("tour", t.slug)}
                onClick={() => p.onSelect({ kind: "tour", slug: t.slug })}
              >
                <span
                  className="inline-block h-1 w-3 rounded"
                  style={{ background: t.color }}
                />{" "}
                {t.name}
              </LinkButton>
            )),
          )}
        {nearTowns.length > 0 &&
          group(
            "Orte",
            nearTowns.map(({ x, d }) => (
              <LinkButton
                key={x.slug}
                {...link("town", x.slug)}
                onClick={() => p.onSelect({ kind: "town", slug: x.slug })}
              >
                <span
                  className="bg-town inline-block size-2 rounded-full"
                  aria-hidden
                />{" "}
                {x.name}
                <span className="text-muted-foreground">
                  {fmtUnit(d, "km")}
                </span>
              </LinkButton>
            )),
          )}
      </div>
    </Section>
  );
};

const PassDetail = (props: Props & DetailState & { pass: Pass }) => {
  const { pass } = props;
  const climate = props.climate[pass.slug];
  const bucket = climate?.[periodIndex(props.period)];
  const signals = signalsOf(props, pass.slug);
  const input = inputAt(signals, props.period);
  const year = props.years.passes[pass.slug];
  const cell = cellAt(year, props.period);
  const reasons = reasonTexts(pass, props.period, cell.reasons, input);
  const sun = sunTimes(pass.lat, pass.lon, periodDate(props.period));

  return (
    <>
      <p className="text-muted-foreground mt-0.5 text-xs">
        <span className="text-foreground text-2xl leading-none font-bold tabular-nums">
          {fmt(pass.elevation)}
        </span>
        <span className="ml-1">m · {pass.classicAscent}</span>
      </p>
      {pass.tags && pass.tags.length > 0 && (
        <div className="mt-2">
          <TagBadges tags={pass.tags} />
        </div>
      )}

      {/* The "when" answer, boxed: verdict, why, the whole year, best time. */}
      <div className="bg-muted/40 border-border/70 mt-3 flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge cell={cell} period={props.period} />
          {year?.best && (
            <span className="text-muted-foreground text-xs">
              beste Zeit {periodLabel(year.best[0])} –{" "}
              {periodLabel(year.best[1])}
            </span>
          )}
        </div>
        {reasons.length > 0 && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {reasons.join(" ")}
          </p>
        )}
        <SeasonStrip
          cells={year?.cells ?? []}
          current={props.period}
          size="panel"
        />
      </div>

      <p className="mt-4 text-xs leading-relaxed">{seasonText(pass)}</p>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        {pass.note}
      </p>

      <Section
        id="rating"
        info="Redaktionelle Einschätzung auf einer Skala von 1 bis 5, keine gemessenen Werte."
        title="Bewertung"
      >
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-xs">
          {(
            [
              ["Schönheit", <Rating key="b" value={pass.beauty} />],
              ["Bekanntheit", <Rating key="f" value={pass.fame} />],
              ["Schwierigkeit", <Rating key="d" value={pass.difficulty} />],
              [
                "Verkehr",
                <span key="t" className="flex items-center gap-2">
                  <Rating value={pass.traffic} muted />
                  <span className="text-muted-foreground text-xs">
                    {TRAFFIC_LABEL[pass.traffic]}
                  </span>
                </span>,
              ],
            ] as [string, React.ReactNode][]
          ).map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* A traverse is not climbed to a summit, so what is drawn below is the
          road itself; "Auffahrten" would name the wrong thing. */}
      <Section
        id="ascents"
        info={
          isTraverse(pass.type)
            ? "Geroutete Straße, 100 Höhenpunkte aus einem Geländemodell – zum Vergleichen gut, nicht metergenau. Höhenmeter und steilster Kilometer stehen hier nicht: auf einer fast flachen Straße in einer Schlucht misst das Modell mehr Auf und Ab als die Straße hat."
            : "Geroutete Straße, 100 Höhenpunkte aus einem Geländemodell – zum Vergleichen gut, nicht metergenau."
        }
        title={isTraverse(pass.type) ? "Strecke" : "Auffahrten"}
      >
        {pass.type === "spur" && (
          <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
            Stichstraße: Die Straße endet oben, hinunter geht es dieselbe
            Auffahrt zurück.
          </p>
        )}
        {pass.ascents.length === 0 && (
          <Empty className="py-3">
            <EmptyHeader>
              <EmptyTitle>Keine Auffahrt hinterlegt</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
        <div className="flex flex-col gap-4">
          {pass.ascents.map((a, i) => {
            const profile = props.profiles[ascentKey(pass.slug, i)];
            return (
              <div key={a.label}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="text-xs font-medium">{a.label}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {profile && profileLine(profile, isTraverse(pass.type))}
                    {!(profile || props.loading) &&
                      "Kein Höhenprofil vorhanden."}
                  </span>
                </div>
                {profile && (
                  <ElevationProfile
                    profile={profile}
                    coords={profile.coords}
                    onCursor={props.onProfileCursor}
                    onZoomTo={props.onProfileZoom}
                  />
                )}
                {!profile && props.loading && (
                  <Skeleton
                    aria-busy
                    aria-label="Höhenprofil wird geladen"
                    className="mt-1 w-full"
                    role="status"
                    style={{ aspectRatio: PROFILE_ASPECT }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        id="weather"
        info="Vorhersage von Open-Meteo für die Passhöhe, sieben Tage."
        title="Aktuelles Wetter"
      >
        <WeatherForecast slug={pass.slug} />
      </Section>

      <Section
        id="climate"
        info="ERA5-Land 2015–2024, ein 10-km-Raster – auf Passhöhe eher zu mild."
        title="Jahresklima"
      >
        {bucket && climate ? (
          <>
            <ItemGroup className="grid grid-cols-3 gap-1.5">
              {(
                [
                  [
                    `${fmt(bucket.tmax)}° / ${fmt(bucket.tmin)}°`,
                    "Ø Tag / Nacht",
                  ],
                  [
                    `${bucket.frostPct} %`,
                    `Frost · ${daysOf(bucket.frostPct)} von 15 Tagen`,
                  ],
                  [
                    `${bucket.snowPct} %`,
                    `Schnee · ${daysOf(bucket.snowPct)} von 15 Tagen`,
                  ],
                ] as [string, string][]
              ).map(([value, label]) => (
                <Item
                  key={label}
                  variant="muted"
                  size="xs"
                  className="flex-col items-start gap-0.5"
                >
                  <ItemContent className="gap-0">
                    <ItemTitle className="text-sm leading-tight tabular-nums">
                      {value}
                    </ItemTitle>
                    <ItemDescription className="text-2xs line-clamp-none leading-tight text-pretty">
                      {label}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
            {/* The derived values, labelled as such – the summit values above
                are what the series measured (Principle 3). */}
            <p className="text-muted-foreground text-2xs mt-1.5">
              {periodLabel(props.period)} auf {fmtUnit(pass.elevation, "m")};
              Niederschlag an {bucket.wetPct} % der Tage.{" "}
              {valleyText(pass, bucket, signals.valley)} Tag{" "}
              {sun.dayLength.toLocaleString("de-DE", {
                maximumFractionDigits: 1,
              })}{" "}
              h, Sonne {clockTime(sun.sunrise)}–{clockTime(sun.sunset)}.
            </p>
            <ClimateChart climate={climate} period={props.period} />
          </>
        ) : (
          <Empty className="py-3">
            <EmptyHeader>
              <EmptyTitle>Keine Klimareihe</EmptyTitle>
              <EmptyDescription>
                Für diesen Pass liegen noch keine Klimadaten vor.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Section>

      {/* The inverse of the town panel's list: where this road could be
          ridden from. Same bands, same weighting, read the other way round. */}
      <BasesSection
        bases={basesFor(
          pass,
          props.towns,
          props.passes,
          props.years,
          props.period,
        )}
        hovered={props.hovered}
        onHover={props.onHover}
        onSelect={(slug) => props.onSelect({ kind: "town", slug })}
      />
      <Nearby
        {...props}
        lat={pass.lat}
        lon={pass.lon}
        exclude={pass.slug}
        skipTowns
      />
      <ExternalLinks
        links={[
          ["quaeldich.de", quaeldichHref(pass)],
          ["komoot", komootHref(pass.name, pass.lat, pass.lon)],
          [
            "Google Maps",
            `https://www.google.com/maps/search/?api=1&query=${pass.lat},${pass.lon}`,
          ],
          [
            "OSM",
            `https://www.openstreetmap.org/?mlat=${pass.lat}&mlon=${pass.lon}#map=14/${pass.lat}/${pass.lon}`,
          ],
        ]}
      />
    </>
  );
};

const TourDetail = (props: Props & { tour: Tour }) => {
  const { tour } = props;
  const passIndex = indexBySlug(props.passes);
  const year = props.years.tours[tour.slug];
  const cell = cellAt(year, props.period);
  // The passes that hold the tour back come from the cell, not from a second
  // pass over the members: the sentence and the badge describe one set.
  const limited = tourText(cell, (slug) => passIndex.get(slug)?.name);

  return (
    <>
      <p className="text-muted-foreground mt-0.5 text-xs">
        <span className="text-foreground text-2xl leading-none font-bold tabular-nums">
          {fmt(tour.km)}
        </span>
        <span className="ml-1">km · </span>
        <span className="text-foreground text-2xl leading-none font-bold tabular-nums">
          {fmt(tour.elevationGain)}
        </span>
        <span className="ml-1">hm · {tour.passes.length} Pässe</span>
      </p>

      <div className="bg-muted/40 border-border/70 mt-3 flex flex-col gap-2 rounded-lg border p-3">
        <StatusBadge cell={cell} period={props.period} />
        {limited && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {limited}
          </p>
        )}
        <SeasonStrip
          cells={year?.cells ?? []}
          current={props.period}
          size="panel"
        />
      </div>

      <p className="mt-4 text-xs leading-relaxed">{tour.description}</p>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        {tour.season}
      </p>

      <Section id="tour-passes" title="Pässe der Runde">
        <div className="flex flex-col items-start">
          {tour.passes.map((slug) => {
            const p = passIndex.get(slug);
            if (!p) return null;
            return (
              <LinkButton
                key={slug}
                hovered={
                  props.hovered?.kind === "pass" && props.hovered.slug === slug
                }
                onHover={(over) =>
                  props.onHover(over ? { kind: "pass", slug } : null)
                }
                onClick={() => props.onSelect({ kind: "pass", slug })}
              >
                <StatusDot
                  status={cellAt(props.years.passes[slug], props.period).status}
                />{" "}
                {p.name}
                <span className="text-muted-foreground tabular-nums">
                  {fmtUnit(p.elevation, "m")}
                </span>
              </LinkButton>
            );
          })}
        </div>
      </Section>

      <Nearby
        {...props}
        lat={tour.waypoints[0]!.lat}
        lon={tour.waypoints[0]!.lon}
      />
    </>
  );
};

/**
 * The labels say in two words why the town is in the list at all – a planner
 * scanning bases wants "Radsport-Mekka" or "Ruhig" before the prose. What each
 * label means, and that it is an editorial judgement rather than a count, is
 * explained once in the scales dialog.
 */
const TownDetail = (props: Props & { town: Town }) => {
  const { town } = props;
  // The verdict of a base is the verdict of what it reaches; nothing about a
  // town is measured (`lib/destination.ts` says why, and the block says so).
  const destination = destinationAt(
    town,
    props.passes,
    props.years,
    props.period,
  );
  return (
    <>
      <div className="mt-2">
        <TagBadges tags={town.tags} />
      </div>
      <p className="mt-2 text-xs">{town.why}</p>
      <DestinationSection
        d={destination}
        period={props.period}
        hovered={props.hovered}
        onHover={props.onHover}
        onSelect={(slug) => props.onSelect({ kind: "pass", slug })}
      />
      <Nearby
        {...props}
        lat={town.lat}
        lon={town.lon}
        exclude={town.slug}
        skipPasses
      />
      <ExternalLinks
        links={[
          [
            "Werkstätten (OSM)",
            `https://www.openstreetmap.org/search?query=${encodeURIComponent(`Fahrradwerkstatt ${town.name}`)}`,
          ],
          [
            "Radläden (Google)",
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`bike shop ${town.name}`)}`,
          ],
        ]}
      />
    </>
  );
};

/**
 * The panel's head. Two shapes, one element: the kicker and the name lie on
 * the hero photo where there is one, and stand in the panel's own colours
 * where there is not – but they are the *same* nodes either way, only
 * differently placed. Rendering them in two branches would take the heading
 * out of the document the moment the last slide failed to load.
 */
const PanelHead = ({
  hero,
  kicker,
  name,
  loading,
  photos,
  onBroken,
}: {
  /** The panel opens on a photograph; the title lies on it rather than above it. */
  hero: boolean;
  kicker: string;
  name: string;
  /** The detail file is still on its way; the hero reserves its box meanwhile. */
  loading: boolean;
  photos: Photo[];
  onBroken: (src: string) => void;
}) => (
  <div
    className={cn(
      "relative",
      // A thin margin rather than none at all: the photo is then a card
      // inside the panel's card, and its corners can be cut concentric
      // with the panel's own instead of running into them. Full bleed
      // put the picture's corner exactly where the drawer's radius is,
      // which is the one place a right angle and a curve cannot agree.
      hero && "mx-1.5 mt-1.5 overflow-hidden rounded-lg",
    )}
  >
    {hero && (
      <PhotoCarousel loading={loading} onBroken={onBroken} photos={photos} />
    )}
    {/*
     * 10 px inside a hero that is 6 px inside the panel: the name then starts
     * on the same line as the numbers under it.
     */}
    <div
      className={cn(
        hero
          ? "pointer-events-none absolute inset-x-0 bottom-6 px-2.5 text-white"
          : "px-4 pt-11",
      )}
    >
      <p
        className={cn(
          "text-2xs truncate font-semibold tracking-widest uppercase",
          hero ? "text-white/85" : "text-muted-foreground",
        )}
      >
        {kicker}
      </p>
      <h2
        id="detail-title"
        className={cn(
          "text-xl leading-tight font-bold tracking-tight text-balance",
          hero && "drop-shadow-[0_1px_10px_rgb(0_0_0/0.55)]",
        )}
      >
        {name}
      </h2>
    </div>
  </div>
);

/**
 * The panel's own controls, lying on the hero rather than in a bar above it –
 * which is what lets the photo start at the panel's top edge. The row is
 * transparent there and lets the pointer through, and each control carries its
 * own translucent surface (`OVERLAY_CONTROL`) so it reads on a photograph.
 *
 * Past the head it becomes an ordinary header instead: the row takes the
 * surface, the controls give theirs up, and the name appears – because the
 * title is written on the photo and has scrolled away with it. That is also
 * the honest reason for the change of tone: what is under the controls a
 * moment later is body text, and a scrim that works on a photograph does not.
 */
const PanelBar = ({
  name,
  solid,
  scrolled,
  backToList,
  favorite,
  shared,
  onBack,
  onShare,
  onToggleFavorite,
}: {
  name: string;
  /** Past the head: the row carries the surface, not the controls. */
  solid: boolean;
  /** Past the head, so the name is no longer anywhere else on screen. */
  scrolled: boolean;
  /** A list drawer underneath: leaving means going back to it, not closing. */
  backToList: boolean;
  favorite: boolean;
  /** The link has just been handed over; the share icon says so for a moment. */
  shared: boolean;
  onBack: () => void;
  onShare: () => void;
  onToggleFavorite: () => void;
}) => (
  <div
    className={cn(
      "pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-1.5 p-2.5 transition-colors duration-200",
      solid &&
        "border-border/60 bg-card/90 supports-not-[backdrop-filter:blur(0)]:bg-card border-b backdrop-blur-md",
    )}
  >
    {backToList && (
      <Button
        size="sm"
        variant="ghost"
        onClick={onBack}
        aria-label="Zurück zur Liste"
        className={cn(
          "pointer-events-auto shrink-0 gap-1 px-2",
          !solid && OVERLAY_CONTROL,
        )}
      >
        <ChevronLeft />
        Liste
      </Button>
    )}
    {/* The name, once the head it was written on has scrolled away. */}
    <p
      className={cn(
        "min-w-0 flex-1 truncate text-sm font-semibold transition-opacity duration-200",
        scrolled ? "opacity-100" : "opacity-0",
      )}
      aria-hidden
    >
      {name}
    </p>
    <Button
      size="icon"
      variant="ghost"
      onClick={onShare}
      aria-label={shared ? "Link kopiert" : `${name} teilen`}
      className={cn(
        "pointer-events-auto",
        !solid && OVERLAY_CONTROL,
        TOUCH_ICON,
      )}
    >
      {shared ? <Check className="text-status-open" /> : <Share />}
    </Button>
    <Toggle
      pressed={favorite}
      onPressedChange={onToggleFavorite}
      aria-label={favorite ? `${name} nicht mehr merken` : `${name} merken`}
      className={cn(
        "pointer-events-auto",
        ICON_TOGGLE,
        !solid && OVERLAY_CONTROL,
        TOUCH_ICON,
      )}
    >
      <Star className={cn(favorite && "fill-accent text-accent")} />
    </Toggle>
    {!backToList && (
      <Button
        size="icon"
        variant="ghost"
        onClick={onBack}
        aria-label="Details schließen"
        className={cn(
          "pointer-events-auto",
          !solid && OVERLAY_CONTROL,
          TOUCH_ICON,
        )}
      >
        <X />
      </Button>
    )}
  </div>
);

/**
 * Detail view of the selected entity. It is a panel of its own in both layouts:
 * the slide-over next to the sidebar on desktop, its own bottom sheet on a
 * phone – so closing it always means the same thing and the lists keep their
 * scroll position underneath.
 */
export const DetailPanel = (props: Props) => {
  const { selection, onBack } = props;
  const panel = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // Below the sheet's top snap point nothing scrolls, so the head is on screen
  // by construction and the bar has no business taking a surface.
  const expanded = useSheetExpanded();
  // The hash already *is* the shareable state; this only hands it over.
  const { share, done: shared } = useShare();
  /**
   * Which borrowed files failed. It lives here rather than in the carousel
   * because it decides the shape of the whole panel head: with every slide
   * gone there is no picture for white letters to lie on, so the title drops
   * back into the panel's own colours and the controls grow their surface.
   *
   * Keyed by URL, so a list left over from another entity cannot mark the
   * wrong photo broken – which is why it needs no resetting.
   */
  const [broken, setBroken] = useState<string[]>([]);
  /**
   * Whether the panel head has scrolled out from under the control row – for
   * this entity, which is what makes it reset itself: the key changes with
   * the selection, so a fresh panel starts at the top without an effect
   * writing state after the fact.
   */
  const [pastHead, setPastHead] = useState<string | null>(null);

  // The profiles and the photos of this one entity, as a static file with a
  // content hash in its name (lib/detail-assets.ts) – so the page does not
  // carry all 201 passes' worth, and looking at the same pass again is free.
  // An entity with neither has no URL and nothing is fetched.
  const asset = props.detail[photoKey(selection.kind, selection.slug)];
  const { data, loading } = useFetch<DetailData>(asset?.url ?? null);
  const loaded: DetailState = {
    loading,
    photos: data?.photos ?? [],
    profiles: data?.profiles ?? {},
  };

  // Move focus and scroll to the top whenever another entity is selected. The
  // selection is the trigger, not something the effect reads – which is what
  // the rule objects to.
  //
  // A *layout* effect, so the panel owns the focus in the frame it appears in.
  // As a passive effect this ran after paint, which left a window – one that
  // widens with everything else the commit has to do – in which the panel was
  // on screen while focus was still on the row that opened it. Escape then
  // went to the row, which has no handler for it, and the panel simply would
  // not close from the keyboard. The e2e suite caught it as a flake; a
  // keyboard visitor would have caught it as "Escape does nothing".
  //
  // What takes the focus is the *panel*, not the heading. The heading is
  // written across the foot of the hero photo, and focusing something that far
  // down a scroll container asks the browser to bring it into view;
  // `preventScroll` is the request not to, and it is a request browsers have
  // not always honoured. Where it was ignored the panel opened already
  // scrolled – the photo had slid up over its own title, which reads as the
  // title having disappeared behind the picture. Nothing about the
  // announcement changes: the section carries `aria-labelledby="detail-title"`
  // either way. And the scroll reset now runs *after* the focus call rather
  // than before it, so a browser that scrolls anyway is put back.
  useLayoutEffect(() => {
    panel.current?.focus({ preventScroll: true });
    scroller.current?.scrollTo({ top: 0 });
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [selection.kind, selection.slug]);

  // Coming back down from the top snap point, the content starts over at the
  // hero: a collapsed sheet showing the middle of an article has lost the one
  // thing it is tall enough to show.
  useEffect(() => {
    if (!expanded) scroller.current?.scrollTo({ top: 0 });
  }, [expanded]);

  const entity =
    selection.kind === "pass"
      ? props.passes.find((p) => p.slug === selection.slug)
      : selection.kind === "tour"
        ? props.tours.find((t) => t.slug === selection.slug)
        : props.towns.find((t) => t.slug === selection.slug);
  if (!entity) return null;

  const kicker =
    selection.kind === "pass"
      ? `${ROAD_TYPE[(entity as Pass).type].label} · ${(entity as Pass).region} · ${(entity as Pass).country}`
      : selection.kind === "tour"
        ? "Rundtour"
        : `Rad-Ort · ${(entity as Town).country}`;
  const favorite = props.isFavorite(selection.kind, selection.slug);
  const shown = loaded.photos.filter((ph) => !broken.includes(ph.src));
  /**
   * Whether the panel opens on a photograph. Known from the page's own
   * `DetailAsset` before the file with the photos in it arrives, so the head
   * has its shape from the first frame and nothing below it jumps; it only
   * gives way once every slide has failed to load.
   */
  const hero =
    (asset?.photos ?? 0) > 0 &&
    (loaded.photos.length === 0 || shown.length > 0);
  const key = `${selection.kind}:${selection.slug}`;
  const scrolled = expanded && pastHead === key;
  /**
   * The control row carries a surface everywhere except on the hero, where the
   * photo's own scrim is what the icons read against. On the way past the head
   * it takes one on, and with it the name – which is the other half of why it
   * is worth knowing: the title lies on the photo and scrolls away with it.
   */
  const solid = !hero || scrolled;

  return (
    <section
      ref={panel}
      tabIndex={-1}
      aria-labelledby="detail-title"
      className="relative flex min-h-0 flex-1 flex-col outline-none"
      onKeyDown={(e) => {
        if (e.key === "Escape") onBack();
      }}
    >
      <PanelBar
        name={entity.name}
        solid={solid}
        scrolled={scrolled}
        backToList={!!props.backToList}
        favorite={favorite}
        shared={shared}
        onBack={onBack}
        onShare={() => share(`${entity.name} – Alpenpässe`)}
        onToggleFavorite={() =>
          props.onToggleFavorite(selection.kind, selection.slug)
        }
      />
      <div
        ref={scroller}
        onScroll={(e) => {
          // The head is the first child either way – the hero or the plain
          // title block – so what has to be measured is measured rather than
          // guessed at a width the panel takes from its layout.
          const head = e.currentTarget.firstElementChild as HTMLElement | null;
          const limit = Math.max(
            0,
            (head?.offsetTop ?? 0) + (head?.offsetHeight ?? 0) - BAR_PX,
          );
          setPastHead(e.currentTarget.scrollTop > limit ? key : null);
        }}
        className={cn(
          "min-h-0 flex-1 overscroll-contain pb-6",
          expanded ? "overflow-y-auto" : "overflow-hidden",
        )}
      >
        <PanelHead
          hero={hero}
          kicker={kicker}
          name={entity.name}
          loading={loaded.photos.length === 0}
          photos={shown}
          onBroken={(src) =>
            setBroken((br) => (br.includes(src) ? br : [...br, src]))
          }
        />
        <div className="px-4 pt-3">
          {selection.kind === "pass" && (
            <PassDetail {...props} {...loaded} pass={entity as Pass} />
          )}
          {selection.kind === "tour" && (
            <TourDetail {...props} tour={entity as Tour} />
          )}
          {selection.kind === "town" && (
            <TownDetail {...props} town={entity as Town} />
          )}
        </div>
      </div>
    </section>
  );
};
