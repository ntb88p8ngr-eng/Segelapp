"use client";

import { useMemo, useRef, useState } from "react";
import { Wind } from "lucide-react";
import { AMMERSEE_LOCATION } from "@/lib/locations";
import { kmhToKnots } from "@/lib/format";
import { hourOf } from "@/lib/scoring";
import { sunTimes } from "@/lib/sun";
import { useForecast } from "./ForecastProvider";

/**
 * Reihenfarben. Beide Töne sind mit dem Palettenprüfer gegen hellen und
 * dunklen Grund geprüft (Helligkeitsband, Buntheit, Farbfehlsichtigkeit,
 * Kontrast) und bestehen in beiden Modi — deshalb dieselben Werte für beide.
 * Sie entsprechen den Symbolfarben in den Tageskacheln: Wind blau, Böen amber.
 */
const WIND_COLOR = "#0284c7";
const GUST_COLOR = "#d97706";

const VIEW = { w: 760, h: 230 };
const PAD = { top: 14, right: 14, bottom: 30, left: 46 };
const PLOT = {
  w: VIEW.w - PAD.left - PAD.right,
  h: VIEW.h - PAD.top - PAD.bottom,
};

interface Point {
  hour: number;
  wind: number;
  gust: number;
}

/** Achsenteilung in Schritten, die auf runden Knotenwerten liegen. */
function niceTicks(max: number): number[] {
  const step = max <= 8 ? 2 : max <= 20 ? 5 : 10;
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  return ticks;
}

export default function TodayWindChart() {
  const { forecast, window: sailingWindow } = useForecast();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverHour, setHoverHour] = useState<number | null>(null);

  const today = forecast[0];

  const { points, maxValue, sunrise, sunset } = useMemo(() => {
    if (!today) {
      return { points: [] as Point[], maxValue: 10, sunrise: 0, sunset: 24 };
    }

    const collected: Point[] = today.hourly
      .filter((h) => h.windSpeedKmh != null)
      .map((h) => ({
        hour: hourOf(h),
        wind: kmhToKnots(h.windSpeedKmh!),
        gust: h.windGustKmh != null ? kmhToKnots(h.windGustKmh) : kmhToKnots(h.windSpeedKmh!),
      }))
      .sort((a, b) => a.hour - b.hour);

    const peak = collected.reduce((m, p) => Math.max(m, p.gust), 0);
    const sun = sunTimes(new Date(today.date), AMMERSEE_LOCATION.lat, AMMERSEE_LOCATION.lon);

    return {
      points: collected,
      maxValue: Math.max(6, Math.ceil(peak / 2) * 2),
      sunrise: sun.sunrise.getHours() + sun.sunrise.getMinutes() / 60,
      sunset: sun.sunset.getHours() + sun.sunset.getMinutes() / 60,
    };
  }, [today]);

  if (!today || points.length < 2) return null;

  const firstHour = points[0].hour;
  const lastHour = points[points.length - 1].hour;
  const spanHours = Math.max(1, lastHour - firstHour);

  const x = (hour: number) => PAD.left + ((hour - firstHour) / spanHours) * PLOT.w;
  const y = (value: number) => PAD.top + PLOT.h - (value / maxValue) * PLOT.h;

  const path = (pick: (p: Point) => number) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.hour)} ${y(pick(p))}`).join(" ");

  const ticks = niceTicks(maxValue);
  const hourLabels = points
    .map((p) => p.hour)
    .filter((h) => h % 3 === 0);

  const hovered = hoverHour != null ? points.find((p) => p.hour === hoverHour) : null;

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Bildschirmkoordinaten in das viewBox-System umrechnen.
    const localX = ((event.clientX - rect.left) / rect.width) * VIEW.w;
    const ratio = (localX - PAD.left) / PLOT.w;
    const hour = Math.round(firstHour + ratio * spanHours);
    setHoverHour(points.some((p) => p.hour === hour) ? hour : null);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Wind className="h-4 w-4 text-accent" />
          Windverlauf heute
        </h3>

        {/* Legende: bei zwei Reihen Pflicht, damit Identität nicht allein an
            der Farbe hängt. Die Böenlinie ist zusätzlich gestrichelt. */}
        <div className="flex items-center gap-4 text-[11px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <svg width="16" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="16" y2="4" stroke={WIND_COLOR} strokeWidth="2" />
            </svg>
            Wind
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="8" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="16"
                y2="4"
                stroke={GUST_COLOR}
                strokeWidth="2"
                strokeDasharray="4 3"
              />
            </svg>
            Böen
          </span>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        className="mt-2 w-full touch-none"
        style={{ height: "auto" }}
        role="img"
        aria-label={`Windverlauf heute: zwischen ${Math.round(Math.min(...points.map((p) => p.wind)))} und ${Math.round(Math.max(...points.map((p) => p.wind)))} Knoten, Böen bis ${Math.round(Math.max(...points.map((p) => p.gust)))} Knoten.`}
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverHour(null)}
      >
        {/* Nacht abdunkeln, damit die Segelstunden hervortreten. */}
        {sunrise > firstHour && (
          <rect
            x={x(firstHour)}
            y={PAD.top}
            width={Math.max(0, x(Math.min(sunrise, lastHour)) - x(firstHour))}
            height={PLOT.h}
            fill="currentColor"
            className="text-ink"
            opacity="0.06"
          />
        )}
        {sunset < lastHour && (
          <rect
            x={x(Math.max(sunset, firstHour))}
            y={PAD.top}
            width={Math.max(0, x(lastHour) - x(Math.max(sunset, firstHour)))}
            height={PLOT.h}
            fill="currentColor"
            className="text-ink"
            opacity="0.06"
          />
        )}

        {/* Gewählte Segelzeit hervorheben. */}
        <rect
          x={x(Math.max(sailingWindow.startHour, firstHour))}
          y={PAD.top}
          width={Math.max(
            0,
            x(Math.min(sailingWindow.endHour, lastHour)) -
              x(Math.max(sailingWindow.startHour, firstHour)),
          )}
          height={PLOT.h}
          fill={WIND_COLOR}
          opacity="0.07"
        />

        {/* Zurückhaltendes Raster. */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              y1={y(t)}
              x2={PAD.left + PLOT.w}
              y2={y(t)}
              stroke="currentColor"
              className="text-ink"
              opacity="0.12"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              className="fill-current text-ink-muted"
              style={{ fontSize: 11 }}
            >
              {t}
            </text>
          </g>
        ))}
        <text
          x={PAD.left - 8}
          y={PAD.top - 2}
          textAnchor="end"
          className="fill-current text-ink-soft"
          style={{ fontSize: 10 }}
        >
          kn
        </text>

        {hourLabels.map((h) => (
          <text
            key={h}
            x={x(h)}
            y={VIEW.h - 10}
            textAnchor="middle"
            className="fill-current text-ink-muted"
            style={{ fontSize: 11 }}
          >
            {h}
          </text>
        ))}

        <path
          d={path((p) => p.gust)}
          fill="none"
          stroke={GUST_COLOR}
          strokeWidth="2"
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={path((p) => p.wind)}
          fill="none"
          stroke={WIND_COLOR}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {hovered && (
          <g>
            <line
              x1={x(hovered.hour)}
              y1={PAD.top}
              x2={x(hovered.hour)}
              y2={PAD.top + PLOT.h}
              stroke="currentColor"
              className="text-ink"
              opacity="0.3"
              strokeWidth="1"
            />
            {/* Ring in Flächenfarbe, damit der Punkt sich von der Linie löst. */}
            <circle
              cx={x(hovered.hour)}
              cy={y(hovered.gust)}
              r="5"
              fill={GUST_COLOR}
              stroke="var(--surface-strong)"
              strokeWidth="2"
            />
            <circle
              cx={x(hovered.hour)}
              cy={y(hovered.wind)}
              r="5"
              fill={WIND_COLOR}
              stroke="var(--surface-strong)"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      <p className="min-h-5 text-center text-[11px] text-ink-muted">
        {hovered ? (
          <>
            <span className="font-semibold text-ink">{hovered.hour}:00 Uhr</span> —{" "}
            Wind {hovered.wind.toFixed(1)} kn · Böen {hovered.gust.toFixed(1)} kn
          </>
        ) : (
          <>
            Sonnenaufgang {formatHour(sunrise)} · Sonnenuntergang {formatHour(sunset)}
          </>
        )}
      </p>

      <details className="mt-1">
        <summary className="cursor-pointer text-[11px] text-ink-soft">
          Werte als Tabelle
        </summary>
        <div className="mt-2 max-h-48 overflow-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="text-ink-soft">
              <tr>
                <th className="py-1 pr-3 font-medium">Uhrzeit</th>
                <th className="py-1 pr-3 font-medium">Wind</th>
                <th className="py-1 font-medium">Böen</th>
              </tr>
            </thead>
            <tbody className="text-ink-muted">
              {points.map((p) => (
                <tr key={p.hour}>
                  <td className="py-0.5 pr-3">{p.hour}:00</td>
                  <td className="py-0.5 pr-3">{p.wind.toFixed(1)} kn</td>
                  <td className="py-0.5">{p.gust.toFixed(1)} kn</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function formatHour(value: number): string {
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
