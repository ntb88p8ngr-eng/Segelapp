"use client";

import { Clock, RotateCcw } from "lucide-react";
import {
  MIN_WINDOW_HOURS,
  WINDOW_BOUNDS,
  useForecast,
} from "./ForecastProvider";

/**
 * Zwei getrennte Regler statt eines Doppelgriffs: Ein echter Doppelgriff
 * bräuchte eigene Zeiger-Behandlung und wäre mit der Tastatur schwerer zu
 * bedienen. Zwei native Regler sind sofort barrierefrei.
 */
export default function SailingWindowSlider() {
  const { window: sailingWindow, setWindow, resetWindow, isCustomWindow } =
    useForecast();

  const { startHour, endHour } = sailingWindow;

  function changeStart(value: number) {
    // Ende mitschieben, damit die Spanne nie unter drei Stunden fällt.
    const start = Math.min(value, WINDOW_BOUNDS.max - MIN_WINDOW_HOURS);
    setWindow({
      startHour: start,
      endHour: Math.max(endHour, start + MIN_WINDOW_HOURS),
    });
  }

  function changeEnd(value: number) {
    const end = Math.max(value, WINDOW_BOUNDS.min + MIN_WINDOW_HOURS);
    setWindow({
      startHour: Math.min(startHour, end - MIN_WINDOW_HOURS),
      endHour: end,
    });
  }

  const span = endHour - startHour;
  const left =
    ((startHour - WINDOW_BOUNDS.min) / (WINDOW_BOUNDS.max - WINDOW_BOUNDS.min)) *
    100;
  const width = (span / (WINDOW_BOUNDS.max - WINDOW_BOUNDS.min)) * 100;

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <Clock className="h-4 w-4 text-accent" />
          Segelzeit
          <span className="font-semibold text-accent">
            {startHour}–{endHour} Uhr
          </span>
          <span className="text-xs font-normal text-ink-muted">
            ({span} Std.)
          </span>
        </p>

        {isCustomWindow && (
          <button
            type="button"
            onClick={resetWindow}
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1 text-xs text-ink-muted transition hover:text-ink touch:min-h-11"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Zurücksetzen
          </button>
        )}
      </div>

      <p className="mt-1 text-xs text-ink-muted">
        Bewertung und Zeitempfehlung beziehen sich nur auf diese Spanne.
      </p>

      {/* Schiene mit hervorgehobener Auswahl; die Regler liegen darüber. */}
      <div className="relative mt-4 h-10">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-inset" />
        <div
          className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent/70"
          style={{ left: `${left}%`, width: `${width}%` }}
        />

        <input
          type="range"
          aria-label="Beginn der Segelzeit"
          min={WINDOW_BOUNDS.min}
          max={WINDOW_BOUNDS.max - MIN_WINDOW_HOURS}
          value={startHour}
          onChange={(e) => changeStart(Number(e.target.value))}
          className="range-thumb absolute inset-x-0 top-1/2 w-full -translate-y-1/2"
        />
        <input
          type="range"
          aria-label="Ende der Segelzeit"
          min={WINDOW_BOUNDS.min + MIN_WINDOW_HOURS}
          max={WINDOW_BOUNDS.max}
          value={endHour}
          onChange={(e) => changeEnd(Number(e.target.value))}
          className="range-thumb absolute inset-x-0 top-1/2 w-full -translate-y-1/2"
        />
      </div>

      <div className="flex justify-between text-[11px] text-ink-soft">
        <span>{WINDOW_BOUNDS.min} Uhr</span>
        <span>{WINDOW_BOUNDS.max} Uhr</span>
      </div>
    </div>
  );
}
