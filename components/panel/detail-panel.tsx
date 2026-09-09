"use client";

import { ExternalLink, Star, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";

import { ElevationProfile } from "@/components/panel/elevation-profile";
import { PhotoCarousel } from "@/components/panel/photo-carousel";
import { Section } from "@/components/panel/section";
import { WeatherForecast } from "@/components/panel/weather-forecast";
import { Rating } from "@/components/rating";
import { SeasonStrip } from "@/components/season-strip";
import { StatusBadge, StatusDot } from "@/components/status-badge";
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
import { Toggle } from "@/components/ui/toggle";
import type { EntityKind, Selection } from "@/lib/app-state";
import { haversine, NEARBY_RADIUS_KM } from "@/lib/geo";
import { nearbyKey } from "@/lib/nearby";
import type { NearbyTours } from "@/lib/nearby";
import { photoKey } from "@/lib/photos";
import { ascentKey } from "@/lib/route-key";
import {
  bestPeriods,
  climateBucket,
  daysOf,
  indexBySlug,
  passSeason,
  passStatus,
  passVerdict,
  periodIndex,
  periodLabel,
  seasonText,
  tourSeason,
  tourStatus,
  verdictReasons,
} from "@/lib/status";
import type {
  ClimateYear,
  LatLon,
  Pass,
  Period,
  Photos,
  ProfileWithCoords,
  Tour,
  Town,
} from "@/lib/types";
import { cn, fmt, fmtUnit, ICON_TOGGLE, TOUCH_ICON } from "@/lib/utils";

/**
 * recharts is the heaviest thing this app would ship; the climate chart is
 * the only user of it and only appears once a pass is selected, so it stays
 * in its own chunk.
 */
const ClimateChart = dynamic(async () => {
  const m = await import("@/components/panel/climate-chart");
  return m.ClimateChart;
});

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
  profiles: Record<string, ProfileWithCoords>;
  climate: Record<string, ClimateYear>;
  /** Commons photos per entity, keyed by `photoKey`. */
  photos: Photos;
  isFavorite: (kind: EntityKind, slug: string) => boolean;
  onToggleFavorite: (kind: EntityKind, slug: string) => void;
  /** Road point under the profile cursor, drawn on the map; `null` clears it. */
  onProfileCursor: (point: LatLon | null) => void;
  /** Click on the profile: fly the map to that point to look at the hairpins. */
  onProfileZoom: (point: LatLon) => void;
  onSelect: (sel: Selection) => void;
  onBack: () => void;
}

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

const LinkButton = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <Button
    variant="link"
    size="sm"
    className="h-auto gap-1 px-0 py-0.5"
    onClick={onClick}
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
  ...p
}: Props & { lat: number; lon: number; exclude?: string }) => {
  const nearPasses = p.passes
    .map((x) => ({ d: haversine({ lat, lon }, x), x }))
    .filter((e) => e.d <= NEARBY_RADIUS_KM && e.x.slug !== exclude)
    .toSorted((a, b) => a.d - b.d);
  // Tours are lines, so their reach was measured on the server (lib/nearby.ts).
  const slugs = p.nearbyTours[nearbyKey(p.selection.kind, p.selection.slug)];
  const nearTours = p.tours.filter((t) => slugs?.includes(t.slug));
  const nearTowns = p.towns
    .map((x) => ({ d: haversine({ lat, lon }, x), x }))
    .filter((e) => e.d <= NEARBY_RADIUS_KM && e.x.slug !== exclude)
    .toSorted((a, b) => a.d - b.d);

  return (
    <Section id="nearby" title={`Im Umkreis von ${NEARBY_RADIUS_KM} km`}>
      <div className="flex flex-col gap-1">
        {nearPasses.length > 0 &&
          group(
            "Pässe",
            nearPasses.map(({ x, d }) => (
              <LinkButton
                key={x.slug}
                onClick={() => p.onSelect({ kind: "pass", slug: x.slug })}
              >
                <StatusDot
                  status={passStatus(
                    x,
                    p.period,
                    climateBucket(p.climate, x.slug, p.period),
                  )}
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

const PassDetail = (props: Props & { pass: Pass }) => {
  const { pass } = props;
  const climate = props.climate[pass.slug];
  const bucket = climate?.[periodIndex(props.period)];
  const { status } = passVerdict(pass, props.period, bucket);
  const reasons = verdictReasons(pass, props.period, bucket);
  const best = bestPeriods(pass, climate);

  return (
    <>
      <p className="text-muted-foreground mt-0.5 text-xs">
        <span className="text-foreground text-2xl leading-none font-bold tabular-nums">
          {fmt(pass.elevation)}
        </span>
        <span className="ml-1">m · {pass.classicAscent}</span>
      </p>

      {/* The "when" answer, boxed: verdict, why, the whole year, best time. */}
      <div className="bg-muted/40 border-border/70 mt-3 flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge status={status} period={props.period} />
          {best && (
            <span className="text-muted-foreground text-xs">
              beste Zeit {periodLabel(best[0])} – {periodLabel(best[1])}
            </span>
          )}
        </div>
        {reasons.length > 0 && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {reasons.join(" ")}
          </p>
        )}
        <SeasonStrip
          statuses={passSeason(pass, climate)}
          current={props.period}
          size="panel"
          best={best}
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

      <Section
        id="ascents"
        info="Geroutete Straße, 100 Höhenpunkte aus einem Geländemodell – zum Vergleichen gut, nicht metergenau."
        title="Auffahrten"
      >
        {pass.deadEnd && (
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
                    {profile
                      ? `${fmtUnit(profile.km, "km", 1)} · ${fmtUnit(profile.elevationGain, "hm")} · Ø ${fmt(profile.avgGradient, 1)} % · steilster km ${fmt(profile.maxKmGradient, 1)} % · ${fmt(profile.start)} → ${fmtUnit(profile.top, "m")}`
                      : "Kein Höhenprofil vorhanden."}
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
            <p className="text-muted-foreground text-2xs mt-1.5">
              {periodLabel(props.period)} auf {fmtUnit(pass.elevation, "m")};
              Niederschlag an {bucket.wetPct} % der Tage.
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

      <Nearby {...props} lat={pass.lat} lon={pass.lon} exclude={pass.slug} />
      <ExternalLinks
        links={[
          [
            "quaeldich.de",
            `https://www.quaeldich.de/suche/?q=${encodeURIComponent(pass.name)}`,
          ],
          [
            "komoot",
            `https://www.komoot.com/discover?lat=${pass.lat}&lng=${pass.lon}&sport=racebike`,
          ],
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
  const status = tourStatus(tour, passIndex, props.period, props.climate);
  const limiting = tour.passes
    .map((s) => passIndex.get(s))
    .filter((p): p is Pass => Boolean(p))
    .filter(
      (p) =>
        passStatus(
          p,
          props.period,
          climateBucket(props.climate, p.slug, props.period),
        ) !== "open",
    );

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
        <StatusBadge status={status} period={props.period} />
        {limiting.length > 0 && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Eingeschränkt durch {limiting.map((p) => p.name).join(", ")}.
          </p>
        )}
        <SeasonStrip
          statuses={tourSeason(tour, passIndex, props.climate)}
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
                onClick={() => props.onSelect({ kind: "pass", slug })}
              >
                <StatusDot
                  status={passStatus(
                    p,
                    props.period,
                    climateBucket(props.climate, p.slug, props.period),
                  )}
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

const TownDetail = (props: Props & { town: Town }) => {
  const { town } = props;
  return (
    <>
      <p className="mt-2 text-xs">{town.why}</p>
      <Nearby {...props} lat={town.lat} lon={town.lon} exclude={town.slug} />
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
 * Detail view of the selected entity. It is a panel of its own in both layouts:
 * the slide-over next to the sidebar on desktop, its own bottom sheet on a
 * phone – so closing it always means the same thing and the lists keep their
 * scroll position underneath.
 */
export const DetailPanel = (props: Props) => {
  const { selection, onBack } = props;
  const heading = useRef<HTMLHeadingElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Move focus and scroll to the top whenever another entity is selected. The
  // selection is the trigger, not something the effect reads – which is what
  // the rule objects to.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [selection.kind, selection.slug]);

  const entity =
    selection.kind === "pass"
      ? props.passes.find((p) => p.slug === selection.slug)
      : selection.kind === "tour"
        ? props.tours.find((t) => t.slug === selection.slug)
        : props.towns.find((t) => t.slug === selection.slug);
  if (!entity) return null;

  const kicker =
    selection.kind === "pass"
      ? `Pass · ${(entity as Pass).region} · ${(entity as Pass).country}`
      : selection.kind === "tour"
        ? "Rundtour"
        : `Rad-Ort · ${(entity as Town).country}`;
  const favorite = props.isFavorite(selection.kind, selection.slug);

  return (
    <section
      aria-labelledby="detail-title"
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(e) => {
        if (e.key === "Escape") onBack();
      }}
    >
      <div className="border-border flex h-10 shrink-0 items-center gap-1 border-b px-2">
        <p className="text-muted-foreground text-2xs min-w-0 flex-1 truncate pl-2 font-semibold tracking-widest uppercase">
          {kicker}
        </p>
        <Toggle
          pressed={favorite}
          onPressedChange={() =>
            props.onToggleFavorite(selection.kind, selection.slug)
          }
          aria-label={favorite ? "Nicht mehr merken" : "Merken"}
          className={cn(ICON_TOGGLE, TOUCH_ICON)}
        >
          <Star className={cn(favorite && "fill-accent text-accent")} />
        </Toggle>
        <Button
          size="icon"
          variant="ghost"
          onClick={onBack}
          aria-label="Details schließen"
          className={TOUCH_ICON}
        >
          <X />
        </Button>
      </div>
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-6"
      >
        <h2
          ref={heading}
          id="detail-title"
          tabIndex={-1}
          className="text-xl leading-tight font-bold tracking-tight text-balance outline-none"
        >
          {entity.name}
        </h2>
        <PhotoCarousel
          photos={props.photos[photoKey(selection.kind, selection.slug)] ?? []}
        />
        {selection.kind === "pass" && (
          <PassDetail {...props} pass={entity as Pass} />
        )}
        {selection.kind === "tour" && (
          <TourDetail {...props} tour={entity as Tour} />
        )}
        {selection.kind === "town" && (
          <TownDetail {...props} town={entity as Town} />
        )}
      </div>
    </section>
  );
};
