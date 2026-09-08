"use client";

import {
  ArrowLeft,
  ExternalLink,
  HelpCircle,
  Info,
  Star,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";

import { ElevationProfile } from "@/components/panel/elevation-profile";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { EntityKind, Selection } from "@/lib/app-state";
import { haversine, NEARBY_RADIUS_KM } from "@/lib/geo";
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
  ElevationProfile as Profile,
  Pass,
  Period,
  RouteGeometry,
  Tour,
  Town,
} from "@/lib/types";
import { cn, fmt, fmtUnit, ICON_TOGGLE } from "@/lib/utils";

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
  /** "back" inside the mobile sheet (returns to the list), "close" for the desktop slide-over. */
  dismiss: "back" | "close";
  selection: Selection;
  period: Period;
  passes: Pass[];
  tours: Tour[];
  towns: Town[];
  routes: Record<string, RouteGeometry>;
  profiles: Record<string, Profile>;
  climate: Record<string, ClimateYear>;
  isFavorite: (kind: EntityKind, slug: string) => boolean;
  onToggleFavorite: (kind: EntityKind, slug: string) => void;
  onSelect: (sel: Selection) => void;
  onBack: () => void;
  onOpenScales: () => void;
}

/**
 * The one heading level inside the panel: small caps, a hairline, and room
 * above it. `hint` names the source in passing, `info` hides the caveat that
 * belongs to it behind an icon – a sentence about grid resolution must not
 * take the place a fact could have.
 */
const SectionTitle = ({
  children,
  hint,
  info,
}: {
  children: React.ReactNode;
  hint?: string;
  info?: string;
}) => (
  <h3 className="border-border text-muted-foreground mt-6 mb-2.5 flex items-baseline gap-2 border-b pb-1.5 text-[11px] font-semibold tracking-widest uppercase">
    {children}
    {hint && (
      <span className="truncate text-[11px] font-normal tracking-normal normal-case">
        {hint}
      </span>
    )}
    {info && (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Hinweis zur Quelle"
              className="text-muted-foreground/70 ml-auto self-center"
            />
          }
        >
          <Info />
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{info}</TooltipContent>
      </Tooltip>
    )}
  </h3>
);

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
  const nearTours = p.tours.filter((t) =>
    (
      p.routes[`tour:${t.slug}`] ??
      t.waypoints.map((w) => [w.lat, w.lon] as [number, number])
    ).some(
      ([tlat, tlon]) =>
        haversine({ lat, lon }, { lat: tlat, lon: tlon }) <= NEARBY_RADIUS_KM,
    ),
  );
  const nearTowns = p.towns
    .map((x) => ({ d: haversine({ lat, lon }, x), x }))
    .filter((e) => e.d <= NEARBY_RADIUS_KM && e.x.slug !== exclude)
    .toSorted((a, b) => a.d - b.d);

  return (
    <>
      <SectionTitle>Im Umkreis von {NEARBY_RADIUS_KM} km</SectionTitle>
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
                  className="bg-town inline-block size-2 rotate-45 rounded-[1px]"
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
    </>
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
      <p className="text-muted-foreground mt-0.5 text-[13px]">
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

      <p className="mt-4 text-[13px] leading-relaxed">{seasonText(pass)}</p>
      <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
        {pass.note}
      </p>

      <SectionTitle hint="redaktionell, 1–5">
        Bewertung
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Skalen erklärt"
          onClick={props.onOpenScales}
        >
          <HelpCircle />
        </Button>
      </SectionTitle>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-[13px]">
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

      <SectionTitle hint="Routing + Höhenmodell">Auffahrten</SectionTitle>
      {pass.ascents.length === 0 && (
        <Empty className="py-3">
          <EmptyHeader>
            <EmptyTitle>Keine Auffahrt hinterlegt</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
      <div className="flex flex-col gap-4">
        {pass.ascents.map((a, i) => {
          const profile = props.profiles[`${pass.slug}:${i}`];
          return (
            <div key={a.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-[13px] font-medium">{a.label}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {profile
                    ? `${fmtUnit(profile.km, "km", 1)} · ${fmtUnit(profile.elevationGain, "hm")} · Ø ${fmt(profile.avgGradient, 1)} %`
                    : "Kein Höhenprofil vorhanden."}
                </span>
              </div>
              {profile && <ElevationProfile profile={profile} />}
            </div>
          );
        })}
      </div>

      <SectionTitle hint="Open-Meteo">Wetter auf Passhöhe</SectionTitle>
      <WeatherForecast slug={pass.slug} />

      <SectionTitle
        hint="ERA5-Land 2015–2024"
        info="ERA5-Land ist ein 10-km-Raster und auf Passhöhe eher zu mild – gut zum Vergleich der Zeiträume, nicht als Absolutwert."
      >
        Klima
      </SectionTitle>
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
                  <ItemDescription className="line-clamp-none text-[11px] leading-tight text-pretty">
                    {label}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
          <p className="text-muted-foreground mt-1.5 text-[11px]">
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
      <p className="text-muted-foreground mt-0.5 text-[13px]">
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

      <p className="mt-4 text-[13px] leading-relaxed">{tour.description}</p>
      <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
        {tour.season}
      </p>

      <SectionTitle>Pässe der Runde</SectionTitle>
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
      <p className="mt-2 text-[13px]">{town.why}</p>
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
 * Detail view of the selected entity. Lives inside the sidebar (desktop) or
 * the bottom sheet (mobile) as a stack on top of the lists.
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
        {props.dismiss === "back" && (
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft data-icon="inline-start" /> Liste
          </Button>
        )}
        <p
          className={cn(
            "text-muted-foreground min-w-0 flex-1 truncate text-[11px] font-semibold tracking-widest uppercase",
            props.dismiss === "back" ? "text-center" : "pl-2",
          )}
        >
          {kicker}
        </p>
        <Toggle
          pressed={favorite}
          onPressedChange={() =>
            props.onToggleFavorite(selection.kind, selection.slug)
          }
          aria-label={favorite ? "Nicht mehr merken" : "Merken"}
          className={ICON_TOGGLE}
        >
          <Star className={cn(favorite && "fill-accent text-accent")} />
        </Toggle>
        {props.dismiss === "close" && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onBack}
            aria-label="Details schließen"
          >
            <X />
          </Button>
        )}
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
