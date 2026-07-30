"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { AMMERSEE_LOCATION } from "@/lib/locations";
import { degToCardinal, formatKnots } from "@/lib/format";
import { apiUrl } from "@/lib/basePath";
import type { Waypoint } from "@/lib/types";
import WindParticles, { type MapAnchor } from "./WindParticles";
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

/**
 * Die Strömung liegt über der Karte und muss deren Bewegung mitmachen —
 * sonst bleiben die Striche beim Verschieben im Bildschirm stehen und die
 * Karte rutscht darunter weg.
 *
 * Dafür wird ein fester Punkt der Karte beobachtet: Wandert er auf dem
 * Bildschirm, wandern die Partikel im selben Mass mit.
 */
function WindOverlay({
  windDirectionDeg,
  windSpeedKmh,
  gustKmh,
  streakColor,
}: SailingMapProps & { streakColor: string }) {
  const map = useMap();
  const anchorRef = useRef<L.LatLng | null>(null);

  const getAnchor = useCallback((): MapAnchor | null => {
    // Beim ersten Aufruf festlegen — das geschieht im Animationsbild, nicht
    // während des Renderns.
    anchorRef.current ??= map.getCenter();
    const point = map.latLngToContainerPoint(anchorRef.current);
    return { x: point.x, y: point.y, zoom: map.getZoom() };
  }, [map]);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      // Über den Kacheln (200), aber unter Markern (600), damit Wegpunkte
      // anklickbar bleiben.
      style={{ zIndex: 450 }}
    >
      <WindParticles
        directionDeg={windDirectionDeg}
        windSpeedKmh={windSpeedKmh}
        gustKmh={gustKmh}
        streakColor={streakColor}
        getAnchor={getAnchor}
      />
    </div>
  );
}

const waypointIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:12px;height:12px;border-radius:9999px;
    background:#f59e0b;border:2px solid #78350f;
    box-shadow:0 0 0 3px rgba(245,158,11,.3);
  "></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

/** Gemeinsame Wegpunkte: von allen anlegbar und von allen löschbar. */
function WaypointLayer() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [pending, setPending] = useState<L.LatLng | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/waypoints"));
      const data = await res.json();
      setWaypoints(Array.isArray(data.waypoints) ? data.waypoints : []);
    } catch {
      // Ohne Wegpunkte bleibt die Karte benutzbar — kein Grund zu lärmen.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialer Abruf beim Mounten
    void load();
  }, [load]);

  useMapEvents({
    click(event) {
      setPending(event.latlng);
      setName("");
      setError(null);
    },
  });

  async function create() {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/waypoints"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, lat: pending.lat, lon: pending.lng }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      setWaypoints((current) => [...current, data.waypoint]);
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(apiUrl(`/api/waypoints/${id}`), { method: "DELETE" });
      if (res.ok || res.status === 404) {
        setWaypoints((current) => current.filter((w) => w.id !== id));
      }
    } catch {
      // Beim nächsten Laden ist der Stand wieder richtig.
    }
  }

  return (
    <>
      {waypoints.map((waypoint) => (
        <Marker
          key={waypoint.id}
          position={[waypoint.lat, waypoint.lon]}
          icon={waypointIcon}
        >
          <Popup>
            <strong>{waypoint.name}</strong>
            <br />
            <span style={{ opacity: 0.7 }}>
              {waypoint.lat.toFixed(4)}, {waypoint.lon.toFixed(4)}
            </span>
            <br />
            <button
              type="button"
              onClick={() => remove(waypoint.id)}
              style={{
                marginTop: 6,
                border: 0,
                borderRadius: 6,
                padding: "4px 10px",
                background: "#e11d48",
                color: "#fff",
                cursor: "pointer",
                font: "inherit",
                fontSize: 12,
              }}
            >
              Löschen
            </button>
          </Popup>
        </Marker>
      ))}

      {pending && (
        <Popup
          position={pending}
          eventHandlers={{ remove: () => setPending(null) }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
              Neuer Wegpunkt
            </label>
            <input
              autoFocus
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Bojenfeld Nord"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "4px 6px",
                font: "inherit",
                fontSize: 12,
              }}
            />
            {error && (
              <p style={{ color: "#e11d48", fontSize: 11, margin: "4px 0 0" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !name.trim()}
              style={{
                marginTop: 6,
                border: 0,
                borderRadius: 6,
                padding: "4px 10px",
                background: "#0284c7",
                color: "#fff",
                cursor: "pointer",
                font: "inherit",
                fontSize: 12,
                opacity: busy || !name.trim() ? 0.5 : 1,
              }}
            >
              {busy ? "Speichern…" : "Anlegen"}
            </button>
          </form>
        </Popup>
      )}
    </>
  );
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
          <WaypointLayer />
          <WindOverlay
            windDirectionDeg={windDirectionDeg}
            windSpeedKmh={windSpeedKmh}
            gustKmh={gustKmh}
            streakColor={streakColor}
          />
        </MapContainer>

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

      <p className="text-center text-[11px] text-ink-soft">
        Auf die Karte tippen, um einen Wegpunkt anzulegen — sichtbar für alle.
        <span className="sm:hidden"> Verschieben und zoomen mit zwei Fingern.</span>
      </p>
    </div>
  );
}
