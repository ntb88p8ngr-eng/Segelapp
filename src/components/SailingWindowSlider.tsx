"use client";

import { useMemo } from "react";
import { RotateCcw, Sunrise, Sunset } from "lucide-react";
import { AMMERSEE_LOCATION } from "@/lib/locations";
import { daylightHours } from "@/lib/sun";
import { MIN_WINDOW_HOURS, useForecast } from "./ForecastProvider";

/**
 * Zwei getrennte Regler statt eines Doppelgriffs: Ein echter Doppelgriff
 * bräuchte eigene Zeiger-Behandlung und wäre mit der Tastatur schwerer zu
 * bedienen. Zwei native Regler sind sofort barrierefrei.
 */
export default function SailingWindowSlider() {
  const { window: sailingWindow, setWindow, resetWindow, isCustomWindow, forecast } =
    useForecast();

  // Grenzen folgen dem Tageslicht: Im Oktober ist 20 Uhr keine Segelzeit mehr.
  const bounds = useMemo(() => {
    const day = forecast[0]?.date;
    const { firstHour, lastHour, sunrise, sunset } = daylightHours(
      day ? new Date(day) : new Date(),
      AMMERSEE_LOCATION.lat,
      AMMERSEE_LOCATION.lon,
    );
    return {
      min: Math.max(0, firstHour),
      max: Math.min(24, lastHour),
      sunrise,
      sunset,
    };
  }, [forecast]);

  const { startHour, endHour } = sailingWindow;
  const range = Math.max(1, bounds.max - bounds.min);

  function changeStart(value: number) {
    const start = Math.min(value, bounds.max - MIN_WINDOW_HOURS);
    setWindow({
      startHour: start,
      endHour: Math.min(bounds.max, Math.max(endHour, start + MIN_WINDOW_HOURS)),
    });
  }

  function changeEnd(value: number) {
    const end = Math.max(value, bounds.min + MIN_WINDOW_HOURS);
    setWindow({
      startHour: Math.max(bounds.min, Math.min(startHour, end - MIN_WINDOW_HOURS)),
      endHour: end,
    });
  }

  const left = ((Math.max(startHour, bounds.min) - bounds.min) / range) * 100;
  const width = ((Math.min(endHour, bounds.max) - Math.max(startHour, bounds.min)) / range) * 100;

  const time = (value: number) => {
    const h = Math.floor(value);
    const m = Math.round((value - h) * 60);
    return `${h}:${String(m).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-3 py-2">
      <span className="text-xs text-ink-muted">
        Segelzeit{" "}
        <span className="font-semibold text-accent">
          {startHour}–{endHour} Uhr
        </span>
      </span>

      {/* Schiene mit hervorgehobener Auswahl; die Regler liegen darüber. */}
      <div className="relative h-7 min-w-[10rem] flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-inset" />
        <div
          className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent/70"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        <input
          type="range"
          aria-label="Beginn der Segelzeit"
          min={bounds.min}
          max={bounds.max - MIN_WINDOW_HOURS}
          value={startHour}
          onChange={(e) => changeStart(Number(e.target.value))}
          className="range-thumb absolute inset-x-0 top-1/2 w-full -translate-y-1/2"
        />
        <input
          type="range"
          aria-label="Ende der Segelzeit"
          min={bounds.min + MIN_WINDOW_HOURS}
          max={bounds.max}
          value={endHour}
          onChange={(e) => changeEnd(Number(e.target.value))}
          className="range-thumb absolute inset-x-0 top-1/2 w-full -translate-y-1/2"
        />
      </div>

      <span
        className="flex items-center gap-1 text-[11px] text-ink-soft"
        title="Die Grenzen des Reglers folgen Sonnenauf- und -untergang."
      >
        <Sunrise className="h-3.5 w-3.5" />
        {time(bounds.sunrise.getHours() + bounds.sunrise.getMinutes() / 60)}
        <Sunset className="ml-1 h-3.5 w-3.5" />
        {time(bounds.sunset.getHours() + bounds.sunset.getMinutes() / 60)}
      </span>

      {isCustomWindow && (
        <button
          type="button"
          onClick={resetWindow}
          aria-label="Segelzeit zurücksetzen"
          title="Zurücksetzen"
          className="flex items-center justify-center rounded-lg border border-line p-1.5 text-ink-muted transition hover:text-ink"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
