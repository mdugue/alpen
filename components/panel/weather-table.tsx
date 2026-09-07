"use client";
import useFetch from "@/lib/use-fetch";
import type { WeatherDay } from "@/lib/types";

const icon = (code: number) =>
  code === 0 ? "☀" : code <= 2 ? "🌤" : code === 3 ? "☁" : code <= 48 ? "🌫" : code <= 57 ? "🌦" : code <= 67 ? "🌧" : code <= 77 ? "🌨" : code <= 82 ? "🌧" : code <= 86 ? "🌨" : "⛈";

/** 7-day forecast at pass altitude; comes from our own route (cached server-side). */
export function WeatherTable({ slug }: { slug: string }) {
  const { data, error, loading } = useFetch<{ days: WeatherDay[] }>(`/api/weather/${slug}`);

  if (loading) return <p className="text-xs text-muted-foreground">lädt …</p>;
  if (error || !data) return <p className="text-xs text-muted-foreground">Wetter nicht verfügbar.</p>;

  return (
    <table className="w-full text-xs">
      <thead className="text-muted-foreground">
        <tr className="[&>th]:py-1 [&>th]:text-right [&>th:first-child]:text-left">
          <th>Tag</th>
          <th />
          <th>Tmin</th>
          <th>Tmax</th>
          <th>Regen</th>
          <th>Schnee</th>
          <th>Wind</th>
        </tr>
      </thead>
      <tbody>
        {data.days.map((d) => (
          <tr
            key={d.date}
            className="border-t border-border [&>td]:py-1 [&>td]:text-right [&>td:first-child]:text-left"
          >
            <td>
              {new Date(d.date).toLocaleDateString("de-DE", {
                weekday: "short",
                day: "numeric",
                month: "numeric",
              })}
            </td>
            <td>{icon(d.weatherCode)}</td>
            <td>{Math.round(d.tmin)}°</td>
            <td>{Math.round(d.tmax)}°</td>
            <td>{d.precipitation.toFixed(0)} mm</td>
            <td className={d.snowfall > 0 ? "font-semibold text-status-closed" : ""}>
              {d.snowfall > 0 ? `${d.snowfall.toFixed(0)} cm` : "–"}
            </td>
            <td>{Math.round(d.windMax)} km/h</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
