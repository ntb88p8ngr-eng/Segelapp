"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
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

/**
 * Auf Touchgeräten würde die Karte jedes Wischen abfangen und man käme beim
 * Scrollen nicht an ihr vorbei. Deshalb dort das Verschieben nur mit zwei
 * Fingern — ein Finger gehört der Seite.
 */
function TouchPanGuard() {
  const map = useMap();

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const container = map.getContainer();
    map.dragging.disable();

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length > 1) map.dragging.enable();
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) map.dragging.disable();
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    container.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [map]);

  return null;
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
    <div className="space-y-2">
      <div className="relative h-[320px] overflow-hidden rounded-2xl border border-line shadow-xl sm:h-[400px] lg:h-[460px]">
        <MapContainer
          center={[AMMERSEE_LOCATION.lat, AMMERSEE_LOCATION.lon]}
          zoom={12}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> Mitwirkende'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <TouchPanGuard />
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
        <div className="pointer-events-none absolute right-3 top-3 z-[401] rounded-xl border border-line bg-surface-strong px-3 py-2 backdrop-blur sm:right-4 sm:top-4 sm:px-4 sm:py-3">
          <p className="text-[10px] uppercase tracking-widest text-accent sm:text-[11px]">
            Wind aus
          </p>
          <p className="text-xl font-semibold leading-tight text-ink sm:text-2xl">
            {degToCardinal(windDirectionDeg)}
          </p>
          <p className="text-xs text-ink-muted sm:text-sm">
            {formatKnots(windSpeedKmh)}
            {gustKmh != null && <span> · Böen {formatKnots(gustKmh)}</span>}
          </p>
        </div>
      </div>

      <p className="text-center text-[11px] text-ink-soft sm:hidden">
        Karte mit zwei Fingern verschieben und zoomen
      </p>
    </div>
  );
}
