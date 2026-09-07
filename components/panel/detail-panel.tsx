"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ExternalLink, HelpCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Toggle } from "@/components/ui/toggle";
import { Rating } from "@/components/rating";
import { StatusBadge, StatusDot } from "@/components/status-badge";
import { ElevationProfile } from "@/components/panel/elevation-profile";
import { ClimateChart } from "@/components/panel/climate-chart";
import { WeatherTable } from "@/components/panel/weather-table";
import { haversine, NEARBY_RADIUS_KM } from "@/lib/geo";
import { passStatus, periodIndex, periodLabel, seasonText, tourStatus } from "@/lib/status";
import { cn, fmt, fmtUnit } from "@/lib/utils";
import type { EntityKind, Selection } from "@/lib/app-state";
import type {
  ClimateYear,
  ElevationProfile as Profile,
  Pass,
  Period,
  RouteGeometry,
  Tour,
  Town,
} from "@/lib/types";

const TRAFFIC_LABEL = ["", "fast autofrei", "ruhig", "normal", "viel", "Durchgangsstraße"];

interface Props {
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
 * Detail view of the selected entity. Lives inside the sidebar (desktop) or
 * the bottom sheet (mobile) as a stack on top of the lists.
 */
export function DetailPanel(props: Props) {
  const { selection, onBack } = props;
  const heading = useRef<HTMLHeadingElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Move focus and scroll to the top whenever another entity is selected.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
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
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" /> Liste
        </Button>
        <p className="min-w-0 flex-1 truncate text-center text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          {kicker}
        </p>
        <Toggle
          size="sm"
          pressed={favorite}
          onPressedChange={() => props.onToggleFavorite(selection.kind, selection.slug)}
          aria-label={favorite ? "Merkung entfernen" : "Merken"}
        >
          <Star className={cn(favorite && "fill-accent text-accent")} />
        </Toggle>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-3">
        <h2 ref={heading} id="detail-title" tabIndex={-1} className="text-2xl font-bold outline-none">
          {entity.name}
        </h2>
        {selection.kind === "pass" && <PassDetail {...props} pass={entity as Pass} />}
        {selection.kind === "tour" && <TourDetail {...props} tour={entity as Tour} />}
        {selection.kind === "town" && <TownDetail {...props} town={entity as Town} />}
      </div>
    </section>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <h3 className="mt-5 mb-2 flex items-baseline gap-2 border-b border-border pb-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
      {children}
      {hint && <span className="text-[11px] font-normal tracking-normal normal-case">{hint}</span>}
    </h3>
  );
}

function LinkButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Button variant="link" size="sm" className="h-auto gap-1 px-0 py-0.5 text-[13px]" onClick={onClick}>
      {children}
    </Button>
  );
}

function Nearby({ lat, lon, exclude, ...p }: Props & { lat: number; lon: number; exclude?: string }) {
  const nearPasses = p.passes
    .map((x) => ({ x, d: haversine({ lat, lon }, x) }))
    .filter((e) => e.d <= NEARBY_RADIUS_KM && e.x.slug !== exclude)
    .sort((a, b) => a.d - b.d);
  const nearTours = p.tours.filter((t) =>
    (p.routes[`tour:${t.slug}`] ?? t.waypoints.map((w) => [w.lat, w.lon] as [number, number])).some(
      ([tlat, tlon]) => haversine({ lat, lon }, { lat: tlat, lon: tlon }) <= NEARBY_RADIUS_KM,
    ),
  );
  const nearTowns = p.towns
    .map((x) => ({ x, d: haversine({ lat, lon }, x) }))
    .filter((e) => e.d <= NEARBY_RADIUS_KM && e.x.slug !== exclude)
    .sort((a, b) => a.d - b.d);

  const group = (label: string, items: React.ReactNode) => (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {items}
    </div>
  );

  return (
    <>
      <SectionTitle>Im Umkreis von {NEARBY_RADIUS_KM} km</SectionTitle>
      <div className="flex flex-col gap-1">
        {nearPasses.length > 0 &&
          group(
            "Pässe",
            nearPasses.map(({ x, d }) => (
              <LinkButton key={x.slug} onClick={() => p.onSelect({ kind: "pass", slug: x.slug })}>
                <StatusDot status={passStatus(x, p.period)} /> {x.name}
                <span className="text-muted-foreground">{fmtUnit(d, "km")}</span>
              </LinkButton>
            )),
          )}
        {nearTours.length > 0 &&
          group(
            "Touren",
            nearTours.map((t) => (
              <LinkButton key={t.slug} onClick={() => p.onSelect({ kind: "tour", slug: t.slug })}>
                <span className="inline-block h-1 w-3 rounded" style={{ background: t.color }} /> {t.name}
              </LinkButton>
            )),
          )}
        {nearTowns.length > 0 &&
          group(
            "Orte",
            nearTowns.map(({ x, d }) => (
              <LinkButton key={x.slug} onClick={() => p.onSelect({ kind: "town", slug: x.slug })}>
                <span className="inline-block size-2 rotate-45 rounded-[1px] bg-town" aria-hidden /> {x.name}
                <span className="text-muted-foreground">{fmtUnit(d, "km")}</span>
              </LinkButton>
            )),
          )}
      </div>
    </>
  );
}

function ExternalLinks({ links }: { links: [string, string][] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {links.map(([label, href]) => (
        <Button
          key={label}
          variant="outline"
          size="xs"
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
}

function PassDetail(props: Props & { pass: Pass }) {
  const { pass } = props;
  const status = passStatus(pass, props.period);
  const climate = props.climate[pass.slug];
  const bucket = climate?.[periodIndex(props.period)];
  const days = (pct: number) => Math.round((pct / 100) * 15);

  return (
    <>
      <div className="mt-2 mb-2 flex flex-wrap items-baseline gap-3">
        <span className="text-4xl leading-none font-bold tabular-nums">
          {fmt(pass.elevation)}
          <span className="ml-1 text-lg text-muted-foreground">m</span>
        </span>
        <StatusBadge status={status} period={props.period} />
      </div>

      <dl className="my-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-muted-foreground">Klassisch</dt>
        <dd>{pass.classicAscent}</dd>
        <dt className="flex items-center gap-1 text-muted-foreground">
          Bewertung
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Skalen erklärt"
            onClick={props.onOpenScales}
            className="text-muted-foreground"
          >
            <HelpCircle />
          </Button>
        </dt>
        <dd className="grid grid-cols-[auto_auto] items-center gap-x-3 gap-y-0.5 justify-self-start text-xs text-muted-foreground">
          <span>Schönheit</span>
          <Rating value={pass.beauty} />
          <span>Bekanntheit</span>
          <Rating value={pass.fame} />
          <span>Schwierigkeit</span>
          <Rating value={pass.difficulty} />
          <span>Verkehr</span>
          <span className="flex items-center gap-1.5">
            <Rating value={pass.traffic} muted /> {TRAFFIC_LABEL[pass.traffic]}
          </span>
        </dd>
      </dl>

      <p className="text-[13px]">{seasonText(pass)}</p>
      <p className="mt-1 text-[13px]">
        <b>Hinweis:</b> {pass.note}
      </p>

      <SectionTitle hint="Routing + Höhenmodell">Auffahrten</SectionTitle>
      {pass.ascents.length === 0 && (
        <Empty className="py-3">
          <EmptyHeader>
            <EmptyTitle>Keine Auffahrt hinterlegt</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
      {pass.ascents.map((a, i) => {
        const profile = props.profiles[`${pass.slug}:${i}`];
        return (
          <div key={a.label} className="mb-3">
            <div className="flex flex-col">
              <span className="text-[13px] font-medium">{a.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {profile
                  ? `${fmtUnit(profile.km, "km", 1)} · ${fmtUnit(profile.elevationGain, "hm")} · Ø ${fmt(profile.avgGradient, 1)} % · ${fmt(profile.start)} → ${fmtUnit(profile.top, "m")}`
                  : "Kein Höhenprofil vorhanden."}
              </span>
            </div>
            {profile && <ElevationProfile profile={profile} />}
          </div>
        );
      })}

      <SectionTitle hint="7 Tage, Open-Meteo">Wetter auf Passhöhe</SectionTitle>
      <WeatherTable slug={pass.slug} />

      <SectionTitle hint="ERA5-Land, 2015–2024">Klima auf Passhöhe</SectionTitle>
      {bucket && climate ? (
        <>
          <p className="mb-1.5 text-xs text-muted-foreground">
            {periodLabel(props.period)} auf {fmtUnit(pass.elevation, "m")}, Mittel 2015–2024 (≈ 15 Tage je
            Halbmonat):
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              [`${fmt(bucket.tmax)} / ${fmt(bucket.tmin)} °C`, "Ø Höchst-/Tiefstwert"],
              [`${bucket.frostPct} %`, `Frost (≈ ${days(bucket.frostPct)} von 15)`],
              [`${bucket.snowPct} %`, `Schneefall (≈ ${days(bucket.snowPct)} von 15)`],
            ].map(([value, label]) => (
              <Card key={label} size="sm" className="gap-0 py-1.5">
                <CardContent className="px-2">
                  <CardTitle className="text-base leading-tight tabular-nums">{value}</CardTitle>
                  <CardDescription className="text-[11px] leading-tight">{label}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Niederschlag ≥ 1 mm an {bucket.wetPct} % der Tage (≈ {days(bucket.wetPct)} von 15).
          </p>
          <ClimateChart climate={climate} period={props.period} />
          <p className="mt-1 text-xs text-muted-foreground">
            ERA5-Land ist ein 10-km-Raster und auf Passhöhe eher zu mild – gut zum Vergleich der Zeiträume,
            nicht als Absolutwert.
          </p>
        </>
      ) : (
        <Empty className="py-3">
          <EmptyHeader>
            <EmptyTitle>Keine Klimareihe</EmptyTitle>
            <EmptyDescription>Für diesen Pass liegen noch keine Klimadaten vor.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <Nearby {...props} lat={pass.lat} lon={pass.lon} exclude={pass.slug} />
      <ExternalLinks
        links={[
          ["quaeldich.de", `https://www.quaeldich.de/suche/?q=${encodeURIComponent(pass.name)}`],
          ["komoot", `https://www.komoot.com/discover?lat=${pass.lat}&lng=${pass.lon}&sport=racebike`],
          ["Google Maps", `https://www.google.com/maps/search/?api=1&query=${pass.lat},${pass.lon}`],
          ["OSM", `https://www.openstreetmap.org/?mlat=${pass.lat}&mlon=${pass.lon}#map=14/${pass.lat}/${pass.lon}`],
        ]}
      />
    </>
  );
}

function TourDetail(props: Props & { tour: Tour }) {
  const { tour } = props;
  const status = tourStatus(tour, props.passes, props.period);
  const limiting = tour.passes
    .map((s) => props.passes.find((p) => p.slug === s))
    .filter((p): p is Pass => Boolean(p))
    .filter((p) => passStatus(p, props.period) !== "open");

  return (
    <>
      <div className="mt-2 mb-2 flex flex-wrap items-baseline gap-3">
        <span className="text-3xl leading-none font-bold tabular-nums">
          {fmt(tour.km)}
          <span className="ml-1 text-base text-muted-foreground">km</span>
        </span>
        <span className="text-3xl leading-none font-bold tabular-nums">
          {fmt(tour.elevationGain)}
          <span className="ml-1 text-base text-muted-foreground">hm</span>
        </span>
        <StatusBadge status={status} period={props.period} />
      </div>
      {limiting.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Einschränkung durch: {limiting.map((p) => p.name).join(", ")}
        </p>
      )}
      <p className="mt-2 text-[13px]">{tour.description}</p>
      <dl className="my-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-muted-foreground">Saison</dt>
        <dd>{tour.season}</dd>
        <dt className="text-muted-foreground">Pässe</dt>
        <dd className="flex flex-col items-start">
          {tour.passes.map((slug) => {
            const p = props.passes.find((x) => x.slug === slug);
            if (!p) return null;
            return (
              <LinkButton key={slug} onClick={() => props.onSelect({ kind: "pass", slug })}>
                <StatusDot status={passStatus(p, props.period)} /> {p.name}
              </LinkButton>
            );
          })}
        </dd>
      </dl>
      <Nearby {...props} lat={tour.waypoints[0]!.lat} lon={tour.waypoints[0]!.lon} />
    </>
  );
}

function TownDetail(props: Props & { town: Town }) {
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
}
