"use client";

import dynamic from "next/dynamic";

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
import { WeatherForecast } from "@/components/panel/weather-forecast";
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
import { komootHref, quaeldichHref } from "@/lib/links";
import { isTraverse } from "@/lib/regions";
import { ascentKey } from "@/lib/route-key";
import { daysOf } from "@/lib/status";
import type { ProfileWithCoords } from "@/lib/types";
import { cn, fmt, fmtUnit } from "@/lib/utils";

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

const TRAFFIC_LABEL = [
  "",
  "fast autofrei",
  "ruhig",
  "normal",
  "viel",
  "Durchgangsstraße",
];

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

/** What a pass shows, from its model and nothing else. */
export const PassDetail = ({
  model,
  actions,
}: {
  model: PassModel;
  actions: PanelActions;
}) => {
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
          traverse
            ? "Geroutete Straße, 100 Höhenpunkte aus einem Geländemodell – zum Vergleichen gut, nicht metergenau. Höhenmeter und steilster Kilometer stehen hier nicht: auf einer fast flachen Straße in einer Schlucht misst das Modell mehr Auf und Ab als die Straße hat."
            : "Geroutete Straße, 100 Höhenpunkte aus einem Geländemodell – zum Vergleichen gut, nicht metergenau."
        }
        title={traverse ? "Strecke" : "Auffahrten"}
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
            const profile = profiles[ascentKey(pass.slug, i)];
            return (
              <div key={a.label}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="text-xs font-medium">{a.label}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {profile && profileLine(profile, traverse)}
                    {!profile && !waiting && "Kein Höhenprofil vorhanden."}
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
        info="Open-Meteo-Archiv 2015–2024 (ERA5, ERA5-Land, ab 2017 ECMWF IFS), ein Modellraster von 9 bis 25 km – auf Passhöhe eher zu mild."
        title="Jahresklima"
      >
        {bucket ? (
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
              {model.sentences.climate}
            </p>
            {model.climate && (
              <ClimateChart climate={model.climate} period={period} />
            )}
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
