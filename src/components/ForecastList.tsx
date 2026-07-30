"use client";

import {
  degToCardinal,
  formatKnots,
  formatShortDate,
  formatWeekday,
  ratingLabel,
} from "@/lib/format";
import type {
  BestWindow,
  ClubCalendarEvent,
  SevereWeatherRisk,
  SkyCover,
} from "@/lib/types";
import {
  Star,
  Wind,
  Gauge,
  Clock,
  CalendarX,
  TriangleAlert,
  Thermometer,
  Sun,
  CloudSun,
  Cloud,
  Snowflake,
} from "lucide-react";
import clsx from "clsx";
import { useCalendar } from "./CalendarProvider";
import { useForecast } from "./ForecastProvider";

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

function SkyIcon({ cover }: { cover: SkyCover }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  if (cover === "sonnig")
    return <Sun className={`${cls} text-amber-500 dark:text-amber-300`} />;
  if (cover === "wechselnd")
    return <CloudSun className={`${cls} text-sky-600 dark:text-sky-300`} />;
  return <Cloud className={`${cls} text-ink-soft`} />;
}

export default function ForecastList() {
  const { eventsByDate, configured } = useCalendar();
  const { forecast, bestDayIndex } = useForecast();

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
                mit {formatKnots(bestDay.bestWindow.windSpeedAvgKmh)}
                {bestDay.bestWindow.temperatureC != null &&
                  ` bei ${bestDay.bestWindow.temperatureC}°C`}
                .
              </>
            )}
          </p>
        </div>
      )}

      {/* Sieben Tage, sieben Spalten. Bei sechs blieb der letzte Tag allein in
          einer zweiten Reihe hängen; Zwischenstufen mit 3, 5 oder 6 Spalten
          erzeugen denselben Bruch und werden deshalb übersprungen. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
        {forecast.map((day, idx) => {
          const dayEvents = eventsByDate.get(day.date) ?? [];
          const isBooked = configured && dayEvents.length > 0;
          const severe = day.severeRisk;

          return (
            <div
              key={day.date}
              className={clsx(
                "relative rounded-xl border p-2.5 transition sm:p-3 sm:hover:scale-[1.02]",
                severe
                  ? "border-rose-600/70 bg-rose-600/20"
                  : isBooked
                    ? "border-rose-500/60 bg-rose-500/15"
                    : (RATING_STYLES[day.rating] ?? "border-line bg-surface"),
                idx === bestDayIndex &&
                  !isBooked &&
                  !severe &&
                  "ring-2 ring-emerald-400/70",
                idx === bestDayIndex &&
                  (isBooked || severe) &&
                  "ring-2 ring-rose-400/60",
              )}
            >
              {idx === bestDayIndex && (
                <Star
                  className="absolute right-2 top-2 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300"
                  fill="currentColor"
                />
              )}

              <p className="pr-4 text-[13px] font-semibold leading-tight text-ink">
                {formatWeekday(day.date)}
              </p>
              <p className="text-[11px] text-ink-muted">{formatShortDate(day.date)}</p>

              {severe && <SevereBadge risk={severe} />}

              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1 text-ink">
                  <Wind className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-300" />
                  <span className="text-[13px] font-semibold">
                    {formatKnots(day.windSpeedAvgKmh)}
                  </span>
                  <span className="text-[11px] text-ink-muted">
                    {degToCardinal(day.windDirectionDeg)}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-ink-muted">
                  <Gauge className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
                  <span className="text-[11px]">
                    Böen {formatKnots(day.windGustMaxKmh)}
                  </span>
                </div>

                {day.temperatureAvgC != null && (
                  <div className="flex items-center gap-1 text-ink-muted">
                    {day.skyCover ? (
                      <SkyIcon cover={day.skyCover} />
                    ) : (
                      <Thermometer className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="text-[11px]">
                      Ø {day.temperatureAvgC}°C
                      {day.temperatureMaxC > day.temperatureAvgC &&
                        ` · max ${day.temperatureMaxC}°`}
                    </span>
                  </div>
                )}

                {day.bestWindow && (
                  <div className="flex items-start gap-1 text-ink-muted">
                    <Clock className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    <span className="text-[11px]">
                      {/* An gefährlichen oder zu windigen Tagen ist das Fenster
                          nicht "gut", sondern das am wenigsten ungünstige. */}
                      {day.rating === "zu_stark" || severe
                        ? "Ruhigste Zeit"
                        : "Beste Zeit"}{" "}
                      {formatWindow(day.bestWindow)}
                      {day.bestWindow.temperatureC != null &&
                        ` · ${day.bestWindow.temperatureC}°C`}
                    </span>
                  </div>
                )}
              </div>

              {day.coolerWindow && <CoolerBadge window={day.coolerWindow} />}

              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                {ratingLabel(day.rating)}
              </p>
              {day.precipitationSumMm > 0 && (
                <p className="text-[10px] text-ink-muted">
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

/** Hinweis auf eine kühlere Ausweichzeit an heissen Tagen. */
function CoolerBadge({ window }: { window: BestWindow }) {
  return (
    <div className="mt-2 flex items-start gap-1 rounded-lg border border-sky-500/50 bg-sky-500/15 px-1.5 py-1">
      <Snowflake className="mt-px h-3 w-3 shrink-0 text-sky-700 dark:text-sky-300" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-sky-900 dark:text-sky-100">
          Kühler
        </p>
        <p className="text-[10px] text-sky-800 dark:text-sky-200/90">
          {formatWindow(window)} · {window.temperatureC}°C bei{" "}
          {formatKnots(window.windSpeedAvgKmh)}
        </p>
      </div>
    </div>
  );
}

function SevereBadge({ risk }: { risk: SevereWeatherRisk }) {
  return (
    <div
      role="alert"
      className="mt-2 flex items-start gap-1 rounded-lg border border-rose-600/60 bg-rose-600/25 px-1.5 py-1"
    >
      <TriangleAlert className="mt-px h-3 w-3 shrink-0 text-rose-700 dark:text-rose-300" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-rose-900 dark:text-rose-100">
          Unwettergefahr
        </p>
        <p className="text-[10px] text-rose-800 dark:text-rose-200/90">
          {risk.reason}
        </p>
      </div>
    </div>
  );
}

function BookedBadge({ events }: { events: ClubCalendarEvent[] }) {
  const [first] = events;
  const extra = events.length - 1;

  return (
    <div className="mt-2 flex items-start gap-1 rounded-lg border border-rose-500/50 bg-rose-500/20 px-1.5 py-1">
      <CalendarX className="mt-px h-3 w-3 shrink-0 text-rose-600 dark:text-rose-300" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-rose-900 dark:text-rose-100">
          Termin belegt
        </p>
        <p
          className="truncate text-[10px] text-rose-800 dark:text-rose-200/90"
          title={first.summary}
        >
          {first.summary}
          {extra > 0 && ` +${extra}`}
        </p>
      </div>
    </div>
  );
}
