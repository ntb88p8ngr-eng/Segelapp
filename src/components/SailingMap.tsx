"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import { AMMERSEE_LOCATION } from "@/lib/locations";
import { degToCardinal, formatKnots } from "@/lib/format";
import WindParticles from "./WindParticles";
import { useTheme } from "./ThemeProvider";
import "leaflet/dist/leaflet.css";

interface SailingMapProps {
  windDirectionDeg: number;
  windSpeedKmh: number;
  gustKmh?: number | null;
}

export default function SailingMap({
  windDirectionDeg,
  windSpeedKmh,
  gustKmh,
}: SailingMapProps) {
  const { theme } = useTheme();
  // Helle Striche auf der abgedunkelten Karte, dunkle auf der hellen.
  const streakColor = theme === "dark" ? "186, 230, 253" : "12, 74, 110";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line shadow-xl">
      <MapContainer
        center={[AMMERSEE_LOCATION.lat, AMMERSEE_LOCATION.lon]}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: 460, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> Mitwirkende'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </MapContainer>

      {/* Strömungsanimation über der Karte. pointer-events:none, damit Zoom
          und Verschieben der Karte unverändert funktionieren. */}
      <div className="pointer-events-none absolute inset-0 z-[400]">
        <WindParticles
          directionDeg={windDirectionDeg}
          windSpeedKmh={windSpeedKmh}
          gustKmh={gustKmh}
          streakColor={streakColor}
        />
      </div>

      {/* Rechts oben, damit die Leaflet-Zoombuttons links oben frei bleiben. */}
      <div className="pointer-events-none absolute right-4 top-4 z-[401] rounded-xl border border-line bg-surface-strong px-4 py-3 backdrop-blur">
        <p className="text-[11px] uppercase tracking-widest text-accent">Wind aus</p>
        <p className="text-2xl font-semibold leading-tight text-ink">
          {degToCardinal(windDirectionDeg)}
        </p>
        <p className="text-sm text-ink-muted">
          {formatKnots(windSpeedKmh)}
          {gustKmh != null && <span> · Böen {formatKnots(gustKmh)}</span>}
        </p>
      </div>
    </div>
  );
}
