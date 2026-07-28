import CompassRose from "./CompassRose";
import { formatKnots } from "@/lib/format";
import type { WindObservation } from "@/lib/types";
import { Wind, Gauge, Thermometer, Droplets } from "lucide-react";

interface WindDashboardProps {
  current: WindObservation | null;
  locationName: string;
}

export default function WindDashboard({ current, locationName }: WindDashboardProps) {
  if (!current) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-300">
        Aktuelle Winddaten konnten nicht geladen werden.
      </div>
    );
  }

  const gustDelta =
    current.windGustKmh != null && current.windSpeedKmh != null
      ? current.windGustKmh - current.windSpeedKmh
      : null;

  return (
    <div className="grid grid-cols-1 gap-6 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 p-6 shadow-xl backdrop-blur sm:grid-cols-[auto_1fr] sm:p-8">
      <div className="flex justify-center pb-8 sm:pb-0 sm:pr-8">
        <CompassRose directionDeg={current.windDirectionDeg ?? 0} />
      </div>
      <div className="flex flex-col justify-center gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-sky-300/80">
            Aktuell am {locationName}
          </p>
          <p className="text-sm text-slate-400">
            {new Date(current.timestamp).toLocaleString("de-DE", {
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            Uhr
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            icon={<Wind className="h-4 w-4" />}
            label="Wind"
            value={
              current.windSpeedKmh != null
                ? formatKnots(current.windSpeedKmh)
                : "–"
            }
            sub={
              current.windSpeedKmh != null
                ? `${current.windSpeedKmh.toFixed(0)} km/h`
                : undefined
            }
          />
          <Stat
            icon={<Gauge className="h-4 w-4" />}
            label="Böen"
            value={
              current.windGustKmh != null
                ? formatKnots(current.windGustKmh)
                : "–"
            }
            sub={
              current.windGustKmh != null
                ? `${current.windGustKmh.toFixed(0)} km/h${
                    gustDelta != null ? ` · +${gustDelta.toFixed(0)} km/h` : ""
                  }`
                : undefined
            }
            highlight={gustDelta != null && gustDelta > 20}
          />
          <Stat
            icon={<Thermometer className="h-4 w-4" />}
            label="Temperatur"
            value={
              current.temperatureC != null
                ? `${current.temperatureC.toFixed(0)}°C`
                : "–"
            }
          />
          <Stat
            icon={<Droplets className="h-4 w-4" />}
            label="Niederschlag"
            value={
              current.precipitationMm != null
                ? `${current.precipitationMm.toFixed(1)} mm`
                : "–"
            }
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight
          ? "border-amber-400/40 bg-amber-400/10"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex items-center gap-1.5 text-slate-400">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold text-slate-50">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
