"use client";

import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/rating";
import { StatusBadge, StatusDot } from "@/components/status-badge";
import { ElevationProfile } from "@/components/panel/elevation-profile";
import { ClimateChart } from "@/components/panel/climate-chart";
import { WeatherTable } from "@/components/panel/weather-table";
import { haversine, NEARBY_RADIUS_KM } from "@/lib/geo";
import { passStatus, periodIndex, periodLabel, seasonText, tourStatus } from "@/lib/status";
import { cn, fmt } from "@/lib/utils";
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
  selection: Selection | null;
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
  onClose: () => void;
  onOpenScales: () => void;
}

export function DetailPanel(props: Props) {
  const { selection, onClose } = props;
  const open = Boolean(selection);

  return (
    <aside
      className={cn(
        "absolute z-20 overflow-y-auto border border-border bg-card shadow-xl transition-all duration-200",
        "inset-x-0 bottom-0 max-h-[64%] rounded-t-xl border-b-0",
        "md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-[24rem] md:rounded-xl md:border-b",
        open
          ? "translate-y-0 opacity-100 md:translate-x-0"
          : "pointer-events-none translate-y-full opacity-0 md:translate-x-[115%] md:translate-y-0",
      )}
      aria-live="polite"
    >
      {selection && (
        <div className="relative p-4">
          <Button
            size="icon-sm"
            variant="ghost"
            className="absolute right-2 top-2"
            onClick={onClose}
            aria-label="Schließen"
          >
            <X />
          </Button>
          {selection.kind === "pass" && <PassDetail {...props} entitySlug={selection.slug} />}
          {selection.kind === "tour" && <TourDetail {...props} entitySlug={selection.slug} />}
          {selection.kind === "town" && <TownDetail {...props} entitySlug={selection.slug} />}
        </div>
      )}
    </aside>
  );
}

function FavButton({
  kind,
  slug,
  isFavorite,
  onToggleFavorite,
}: Pick<Props, "isFavorite" | "onToggleFavorite"> & { kind: EntityKind; slug: string }) {
  const on = isFavorite(kind, slug);
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      className="absolute right-10 top-2"
      onClick={() => onToggleFavorite(kind, slug)}
      aria-pressed={on}
      title={on ? "Merkung entfernen" : "Merken"}
    >
      <Star className={on ? "fill-accent text-accent" : "text-muted-foreground"} />
    </Button>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <h4 className="mt-4 mb-1.5 flex items-baseline gap-2 border-b border-border pb-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
      {children}
      {hint && <span className="text-[11px] font-normal normal-case tracking-normal">{hint}</span>}
    </h4>
  );
}

function Nearby({
  lat,
  lon,
  exclude,
  ...p
}: Props & { lat: number; lon: number; exclude?: string }) {
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

  const Link = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick} className="mr-2 text-left text-[13px] text-primary hover:underline">
      {children}
    </button>
  );

  return (
    <>
      <SectionTitle>Im Umkreis von {NEARBY_RADIUS_KM} km</SectionTitle>
      {nearPasses.length > 0 && (
        <p className="mb-1">
          <span className="text-xs text-muted-foreground">Pässe: </span>
          {nearPasses.map(({ x, d }) => (
            <Link key={x.slug} onClick={() => p.onSelect({ kind: "pass", slug: x.slug })}>
              <StatusDot status={passStatus(x, p.period)} /> {x.name}{" "}
              <span className="text-muted-foreground">{d.toFixed(0)} km</span>
            </Link>
          ))}
        </p>
      )}
      {nearTours.length > 0 && (
        <p className="mb-1">
          <span className="text-xs text-muted-foreground">Touren: </span>
          {nearTours.map((t) => (
            <Link key={t.slug} onClick={() => p.onSelect({ kind: "tour", slug: t.slug })}>
              <span className="inline-block h-1 w-3 rounded" style={{ background: t.color }} /> {t.name}
            </Link>
          ))}
        </p>
      )}
      {nearTowns.length > 0 && (
        <p>
          <span className="text-xs text-muted-foreground">Orte: </span>
          {nearTowns.map(({ x, d }) => (
            <Link key={x.slug} onClick={() => p.onSelect({ kind: "town", slug: x.slug })}>
              ◆ {x.name} <span className="text-muted-foreground">{d.toFixed(0)} km</span>
            </Link>
          ))}
        </p>
      )}
    </>
  );
}

function ExternalLinks({ links }: { links: [string, string][] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {links.map(([label, href]) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener"
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
        >
          {label}
        </a>
      ))}
    </div>
  );
}

function PassDetail(props: Props & { entitySlug: string }) {
  const pass = props.passes.find((p) => p.slug === props.entitySlug);
  if (!pass) return null;
  const status = passStatus(pass, props.period);
  const climate = props.climate[pass.slug];
  const bucket = climate?.[periodIndex(props.period)];
  const days = (pct: number) => Math.round((pct / 100) * 15);

  return (
    <>
      <FavButton kind="pass" slug={pass.slug} {...props} />
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
        Pass · {pass.region} · {pass.country}
      </p>
      <h2 className="mt-0.5 pr-16 text-2xl font-bold">{pass.name}</h2>
      <div className="mt-2 mb-2 flex items-baseline gap-3">
        <span className="text-4xl leading-none font-bold">
          {fmt(pass.elevation)}
          <span className="ml-1 text-lg text-muted-foreground">m</span>
        </span>
        <StatusBadge status={status} period={props.period} />
      </div>

      <dl className="my-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-muted-foreground">Klassisch</dt>
        <dd>{pass.classicAscent}</dd>
        <dt className="text-muted-foreground">
          Schönheit{" "}
          <button onClick={props.onOpenScales} className="underline decoration-dotted" title="Skalen erklärt">
            ?
          </button>
        </dt>
        <dd>
          <Rating value={pass.beauty} />
        </dd>
        <dt className="text-muted-foreground">Bekanntheit</dt>
        <dd>
          <Rating value={pass.fame} />
        </dd>
        <dt className="text-muted-foreground">Schwierigkeit</dt>
        <dd>
          <Rating value={pass.difficulty} />
        </dd>
        <dt className="text-muted-foreground">Verkehr</dt>
        <dd>
          <Rating value={pass.traffic} muted />{" "}
          <span className="text-xs text-muted-foreground">{TRAFFIC_LABEL[pass.traffic]}</span>
        </dd>
      </dl>

      <p className="text-[13px]">{seasonText(pass)}</p>
      <p className="mt-1 text-[13px]">
        <b>Hinweis:</b> {pass.note}
      </p>

      <SectionTitle hint="Routing + Höhenmodell">Auffahrten</SectionTitle>
      {pass.ascents.length === 0 && <p className="text-xs text-muted-foreground">keine Auffahrt hinterlegt</p>}
      {pass.ascents.map((a, i) => {
        const profile = props.profiles[`${pass.slug}:${i}`];
        return (
          <div key={a.label} className="mb-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium">{a.label}</span>
              <span className="text-xs text-muted-foreground">
                {profile
                  ? `${profile.km} km · ${profile.elevationGain} hm · Ø ${profile.avgGradient} % · ${profile.start}→${profile.top} m`
                  : "kein Profil (bun run data:build)"}
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
          <p className="mb-1 text-xs text-muted-foreground">
            {periodLabel(props.period)} auf {fmt(pass.elevation)} m, Mittel 2015–2024 (≈ 15 Tage je Halbmonat):
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              [`${bucket.tmax} / ${bucket.tmin} °C`, "Ø Höchst-/Tiefstwert"],
              [`${bucket.frostPct} %`, `Frost (≈ ${days(bucket.frostPct)} von 15)`],
              [`${bucket.snowPct} %`, `Schneefall (≈ ${days(bucket.snowPct)} von 15)`],
            ].map(([value, label]) => (
              <div key={label} className="rounded-md bg-muted px-2 py-1.5">
                <b className="block text-lg leading-none font-bold">{value}</b>
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Niederschlag ≥ 1 mm an {bucket.wetPct} % der Tage (≈ {days(bucket.wetPct)} von 15).
          </p>
          <ClimateChart climate={climate} period={props.period} />
          <p className="mt-1 text-xs text-muted-foreground">
            ERA5-Land ist ein 10-km-Raster und auf Passhöhe eher zu mild – gut zum Vergleich der Zeiträume,
            nicht als Absolutwert.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">keine Klimareihe (bun run data:build)</p>
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

function TourDetail(props: Props & { entitySlug: string }) {
  const tour = props.tours.find((t) => t.slug === props.entitySlug);
  if (!tour) return null;
  const status = tourStatus(tour, props.passes, props.period);
  const limiting = tour.passes
    .map((s) => props.passes.find((p) => p.slug === s))
    .filter((p): p is Pass => Boolean(p))
    .filter((p) => passStatus(p, props.period) !== "open");

  return (
    <>
      <FavButton kind="tour" slug={tour.slug} {...props} />
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Rundtour</p>
      <h2 className="mt-0.5 pr-16 text-2xl font-bold">{tour.name}</h2>
      <div className="mt-2 mb-2 flex flex-wrap items-baseline gap-3">
        <span className="text-3xl leading-none font-bold">
          {tour.km}
          <span className="ml-1 text-base text-muted-foreground">km</span>
        </span>
        <span className="text-3xl leading-none font-bold">
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
              <button
                key={slug}
                className="text-primary hover:underline"
                onClick={() => props.onSelect({ kind: "pass", slug })}
              >
                <StatusDot status={passStatus(p, props.period)} /> {p.name}
              </button>
            );
          })}
        </dd>
      </dl>
      <Nearby {...props} lat={tour.waypoints[0]!.lat} lon={tour.waypoints[0]!.lon} />
    </>
  );
}

function TownDetail(props: Props & { entitySlug: string }) {
  const town = props.towns.find((t) => t.slug === props.entitySlug);
  if (!town) return null;
  return (
    <>
      <FavButton kind="town" slug={town.slug} {...props} />
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
        Rad-Ort · {town.country}
      </p>
      <h2 className="mt-0.5 pr-16 text-2xl font-bold">{town.name}</h2>
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
