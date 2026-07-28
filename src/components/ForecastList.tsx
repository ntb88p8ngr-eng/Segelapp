"use client";

import {
  degToCardinal,
  formatKnots,
  formatShortDate,
  formatWeekday,
  ratingLabel,
} from "@/lib/format";
import type { BestWindow, ClubCalendarEvent, DailyForecast } from "@/lib/types";
import { Star, Wind, Gauge, Clock, CalendarX } from "lucide-react";
import clsx from "clsx";
import { useCalendar } from "./CalendarProvider";

interface ForecastListProps {
  forecast: DailyForecast[];
  bestDayIndex: number | null;
}

// Tints auf 500er-Basis, damit die Karten in hellem wie dunklem Design lesbar bleiben.
const RATING_STYLES: Record<string, string> = {
  top: "border-emerald-500/50 bg-emerald-500/15",
  gut: "border-sky-500/45 bg-sky-500/15",
  maessig: "border-amber-500/45 bg-amber-500/15",
  wenig_wind: "border-line bg-surface",
  zu_stark: "border-rose-500/45 bg-rose-500/15",
  schlecht: "border-rose-600/50 bg-rose-600/15",
};

function formatWindow(window: BestWindow): string {
  return `${window.startHour}–${window.endHour} Uhr`;
}

export default function ForecastList({ forecast, bestDayIndex }: ForecastListProps) {
  const { eventsByDate, configured } = useCalendar();

  if (!forecast.length) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center text-ink-muted">
        Keine Vorhersagedaten verfügbar.
      </div>
    );
  }

  const bestDay = bestDayIndex != null ? forecast[bestDayIndex] : null;

  return (
    <div className="space-y-4">
      {bestDay && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/50 bg-emerald-500/15 px-5 py-4">
          <Star
            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300"
            fill="currentColor"
          />
          <p className="text-sm text-emerald-900 dark:text-emerald-50">
            <span className="font-semibold">
              Bester Segeltag: {formatWeekday(bestDay.date)}, {formatShortDate(bestDay.date)}
            </span>{" "}
            — {formatKnots(bestDay.windSpeedAvgKmh)} aus{" "}
            {degToCardinal(bestDay.windDirectionDeg)}, Böen bis{" "}
            {formatKnots(bestDay.windGustMaxKmh)}.
            {bestDay.bestWindow && (
              <>
                {" "}
                Beste Zeit:{" "}
                <span className="font-semibold">{formatWindow(bestDay.bestWindow)}</span>{" "}
                mit {formatKnots(bestDay.bestWindow.windSpeedAvgKmh)}.
              </>
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {forecast.map((day, idx) => {
          const dayEvents = eventsByDate.get(day.date) ?? [];
          const isBooked = configured && dayEvents.length > 0;

          return (
            <div
              key={day.date}
              className={clsx(
                "relative rounded-xl border p-4 transition hover:scale-[1.02]",
                isBooked
                  ? "border-rose-500/60 bg-rose-500/15"
                  : (RATING_STYLES[day.rating] ?? "border-line bg-surface"),
                idx === bestDayIndex && !isBooked && "ring-2 ring-emerald-400/70",
                idx === bestDayIndex && isBooked && "ring-2 ring-rose-400/60",
              )}
            >
              {idx === bestDayIndex && (
                <Star
                  className="absolute right-3 top-3 h-4 w-4 text-emerald-600 dark:text-emerald-300"
                  fill="currentColor"
                />
              )}
              <p className="text-sm font-semibold text-ink">
                {formatWeekday(day.date)}
              </p>
              <p className="text-xs text-ink-muted">{formatShortDate(day.date)}</p>

              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-ink">
                  <Wind className="h-3.5 w-3.5 text-sky-600 dark:text-sky-300" />
                  <span className="text-sm font-medium">
                    {formatKnots(day.windSpeedAvgKmh)}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {degToCardinal(day.windDirectionDeg)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-ink-muted">
                  <Gauge className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
                  <span className="text-xs">
                    Böen bis {formatKnots(day.windGustMaxKmh)}
                  </span>
                </div>
                {day.bestWindow && (
                  <div className="flex items-center gap-1.5 text-ink-muted">
                    <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                    <span className="text-xs">
                      {/* An zu windigen Tagen ist das Fenster nicht "gut",
                          sondern schlicht das ruhigste des Tages. */}
                      {day.rating === "zu_stark" ? "Ruhigste Zeit" : "Beste Zeit"}{" "}
                      {formatWindow(day.bestWindow)}
                    </span>
                  </div>
                )}
              </div>

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {ratingLabel(day.rating)}
              </p>
              {day.precipitationSumMm > 0 && (
                <p className="mt-1 text-[11px] text-ink-muted">
                  {day.precipitationSumMm.toFixed(1)} mm Regen
                </p>
              )}

              {isBooked && <BookedBadge events={dayEvents} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookedBadge({ events }: { events: ClubCalendarEvent[] }) {
  const [first] = events;
  const extra = events.length - 1;

  return (
    <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-rose-500/50 bg-rose-500/20 px-2 py-1.5">
      <CalendarX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-300" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-rose-900 dark:text-rose-100">
          Termin belegt
        </p>
        <p
          className="truncate text-[11px] text-rose-800 dark:text-rose-200/90"
          title={first.summary}
        >
          {first.summary}
          {extra > 0 && ` +${extra} weitere`}
        </p>
      </div>
    </div>
  );
}
