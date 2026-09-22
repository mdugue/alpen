"use client";

import dynamic from "next/dynamic";

import { useT } from "@/components/i18n";
import type { PanelActions } from "@/components/panel/actions";
import { CHART_HEIGHT } from "@/components/panel/chart-size";
import { BasesSection } from "@/components/panel/destination";
import {
  ElevationProfile,
  PROFILE_ASPECT,
} from "@/components/panel/elevation-profile";
import { ExternalLinks, Nearby } from "@/components/panel/nearby";
import { Section } from "@/components/panel/section";
import { VerdictBox } from "@/components/panel/verdict-box";
import { WeatherSkeleton } from "@/components/panel/weather-forecast";
import { Rating } from "@/components/rating";
import { TagBadges } from "@/components/tags";
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
  ItemTitle,
  ItemGroup,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import type { PassModel } from "@/lib/detail-model";
import { profilesOf } from "@/lib/detail-state";
import type { Messages } from "@/lib/i18n";
import { komootHref, quaeldichHref } from "@/lib/links";
import { isTraverse } from "@/lib/regions";
import { ascentKey } from "@/lib/route-key";
import { daysOf } from "@/lib/status";
import type { ProfileWithCoords } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The chart's placeholder – a component, so it can say what it is in the page's language. */
const ChartLoading = () => {
  const { t } = useT();
  return (
    <Skeleton
      aria-busy
      aria-label={t.panel.chart.loading}
      className={cn("mt-3 w-full", CHART_HEIGHT)}
      role="status"
    />
  );
};

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
    loading: () => <ChartLoading />,
  },
);

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
const profileLine = (
  profile: ProfileWithCoords,
  traverse: boolean,
  t: Messages,
  fmt: (n: number, digits?: number) => string,
  fmtUnit: (n: number, unit: string, digits?: number) => string,
) =>
  [
    fmtUnit(profile.km, "km", 1),
    ...(traverse ? [] : [fmtUnit(profile.elevationGain, t.vocab.unit.climb)]),
    t.panel.ascents.average(fmt(profile.avgGradient, 1)),
    ...(traverse
      ? []
      : [t.panel.ascents.steepestKm(fmt(profile.maxKmGradient, 1))]),
    `${fmt(profile.start)} → ${fmtUnit(profile.top, "m")}`,
  ].join(" · ");

/** What a pass shows, from its model and nothing else. */
export const PassDetail = ({
  model,
  actions,
  weather,
}: {
  model: PassModel;
  actions: PanelActions;
  /** The forecast the pass's route streamed in; absent until it has arrived. */
  weather?: React.ReactNode;
}) => {
  const { t, fmt, fmtUnit } = useT();
  const { bucket, pass, period } = model;
  const profiles = profilesOf(model.detail);
  const waiting = model.detail.phase === "pending";
  const traverse = isTraverse(pass.type);

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

      <VerdictBox
        best={model.verdict.best}
        period={period}
        text={model.verdict.text}
        year={model.verdict.year}
      />

      <p className="mt-4 text-xs leading-relaxed">{model.sentences.season}</p>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        {model.sentences.note}
      </p>

      <Section
        id="rating"
        info={t.panel.rating.info}
        title={t.panel.rating.title}
      >
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-xs">
          {(
            [
              [t.panel.rating.beauty, <Rating key="b" value={pass.beauty} />],
              [t.panel.rating.fame, <Rating key="f" value={pass.fame} />],
              [
                t.panel.rating.difficulty,
                <Rating key="d" value={pass.difficulty} />,
              ],
              [
                t.panel.rating.traffic,
                <span key="t" className="flex items-center gap-2">
                  <Rating value={pass.traffic} muted />
                  <span className="text-muted-foreground text-xs">
                    {t.panel.rating.trafficLevel[pass.traffic]}
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
        info={traverse ? t.panel.ascents.infoTraverse : t.panel.ascents.info}
        title={traverse ? t.panel.ascents.titleTraverse : t.panel.ascents.title}
      >
        {pass.type === "spur" && (
          <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
            {t.panel.ascents.spur}
          </p>
        )}
        {pass.ascents.length === 0 && (
          <Empty className="py-3">
            <EmptyHeader>
              <EmptyTitle>{t.panel.ascents.none}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
        <div className="flex flex-col gap-4">
          {pass.ascents.map((a, i) => {
            const profile = profiles[ascentKey(pass.slug, i)];
            return (
              <div key={a.label}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="text-xs font-medium">{a.label}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {profile && profileLine(profile, traverse, t, fmt, fmtUnit)}
                    {!profile && !waiting && t.panel.ascents.noProfile}
                  </span>
                </div>
                {profile && (
                  <ElevationProfile
                    profile={profile}
                    coords={profile.coords}
                    onCursor={actions.onProfileCursor}
                    onZoomTo={actions.onProfileZoom}
                  />
                )}
                {!profile && waiting && (
                  <Skeleton
                    aria-busy
                    aria-label={t.panel.profile.loading}
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
        info={t.panel.weather.info}
        title={t.panel.weather.title}
      >
        {/* Rendered on the server for this pass's route and streamed in
            (`components/panel/weather.tsx`); until the route's payload has
            arrived the block shows what it will look like. */}
        {weather ?? <WeatherSkeleton />}
      </Section>

      <Section
        id="climate"
        info={t.panel.climate.info}
        title={t.panel.climate.title}
      >
        {bucket ? (
          <>
            <ItemGroup className="grid grid-cols-3 gap-1.5">
              {(
                [
                  [
                    `${fmt(bucket.tmax)}° / ${fmt(bucket.tmin)}°`,
                    t.panel.climate.dayNight,
                  ],
                  [
                    `${bucket.frostPct} %`,
                    t.panel.climate.frost(fmt(daysOf(bucket.frostPct))),
                  ],
                  [
                    `${bucket.snowPct} %`,
                    t.panel.climate.snow(fmt(daysOf(bucket.snowPct))),
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
              {model.sentences.climate}
            </p>
            {model.climate && (
              <ClimateChart climate={model.climate} period={period} />
            )}
          </>
        ) : (
          <Empty className="py-3">
            <EmptyHeader>
              <EmptyTitle>{t.panel.climate.noneTitle}</EmptyTitle>
              <EmptyDescription>{t.panel.climate.noneText}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Section>

      {/* The inverse of the town panel's list: where this road could be
          ridden from. Same bands, same weighting, read the other way round. */}
      <BasesSection
        bases={model.bases}
        hovered={model.hovered}
        onHover={actions.onHover}
        onSelect={(slug) => actions.onSelect({ kind: "town", slug })}
      />
      <Nearby actions={actions} model={model} />
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
