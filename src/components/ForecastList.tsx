import {
  degToCardinal,
  formatKnots,
  formatShortDate,
  formatWeekday,
  ratingLabel,
} from "@/lib/format";
import type { DailyForecast } from "@/lib/types";
import { Star, Wind, Gauge } from "lucide-react";
import clsx from "clsx";

interface ForecastListProps {
  forecast: DailyForecast[];
  bestDayIndex: number | null;
}

const RATING_STYLES: Record<string, string> = {
  top: "border-emerald-400/50 bg-emerald-400/10",
  gut: "border-sky-400/40 bg-sky-400/10",
  maessig: "border-amber-400/40 bg-amber-400/10",
  wenig_wind: "border-slate-500/40 bg-slate-500/10",
  zu_stark: "border-rose-400/40 bg-rose-400/10",
  schlecht: "border-rose-500/40 bg-rose-500/10",
};

export default function ForecastList({ forecast, bestDayIndex }: ForecastListProps) {
  if (!forecast.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-300">
        Keine Vorhersagedaten verfügbar.
      </div>
    );
  }

  const bestDay = bestDayIndex != null ? forecast[bestDayIndex] : null;

  return (
    <div className="space-y-4">
      {bestDay && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-5 py-4">
          <Star className="h-5 w-5 shrink-0 text-emerald-300" fill="currentColor" />
          <p className="text-sm text-emerald-100">
            <span className="font-semibold">
              Bester Segeltag: {formatWeekday(bestDay.date)}, {formatShortDate(bestDay.date)}
            </span>{" "}
            — {formatKnots(bestDay.windSpeedAvgKmh)} aus {degToCardinal(bestDay.windDirectionDeg)},
            Böen bis {formatKnots(bestDay.windGustMaxKmh)}.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {forecast.map((day, idx) => (
          <div
            key={day.date}
            className={clsx(
              "relative rounded-xl border p-4 transition hover:scale-[1.02]",
              RATING_STYLES[day.rating] ?? "border-white/10 bg-white/5",
              idx === bestDayIndex && "ring-2 ring-emerald-400/70",
            )}
          >
            {idx === bestDayIndex && (
              <Star
                className="absolute right-3 top-3 h-4 w-4 text-emerald-300"
                fill="currentColor"
              />
            )}
            <p className="text-sm font-semibold text-slate-100">
              {formatWeekday(day.date)}
            </p>
            <p className="text-xs text-slate-400">{formatShortDate(day.date)}</p>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-200">
                <Wind className="h-3.5 w-3.5 text-sky-300" />
                <span className="text-sm font-medium">
                  {formatKnots(day.windSpeedAvgKmh)}
                </span>
                <span className="text-xs text-slate-400">
                  {degToCardinal(day.windDirectionDeg)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Gauge className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-xs">
                  Böen bis {formatKnots(day.windGustMaxKmh)}
                </span>
              </div>
            </div>

            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
              {ratingLabel(day.rating)}
            </p>
            {day.precipitationSumMm > 0 && (
              <p className="mt-1 text-[11px] text-slate-400">
                {day.precipitationSumMm.toFixed(1)} mm Regen
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
