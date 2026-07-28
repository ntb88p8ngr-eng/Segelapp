"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { AMMERSEE_LOCATION, SAILING_CLUBS } from "@/lib/locations";
import { degToCardinal, formatKnots } from "@/lib/format";
import "leaflet/dist/leaflet.css";

interface SailingMapProps {
  windDirectionDeg: number;
  windSpeedKmh: number;
}

const clubIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:14px;height:14px;border-radius:9999px;
    background:#38bdf8;border:2px solid #0c4a6e;
    box-shadow:0 0 0 3px rgba(56,189,248,0.25);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function windIcon(directionDeg: number) {
  return L.divIcon({
    className: "",
    html: `<div style="transform:rotate(${directionDeg}deg);width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
      <svg width="32" height="32" viewBox="0 0 32 32">
        <path d="M16 4 L21 22 L16 18 L11 22 Z" fill="#fbbf24" stroke="#78350f" stroke-width="1"/>
      </svg>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export default function SailingMap({ windDirectionDeg, windSpeedKmh }: SailingMapProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 shadow-xl">
      <MapContainer
        center={[AMMERSEE_LOCATION.lat, AMMERSEE_LOCATION.lon]}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: 420, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> Mitwirkende'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={[AMMERSEE_LOCATION.lat, AMMERSEE_LOCATION.lon]}
          icon={windIcon(windDirectionDeg)}
        >
          <Popup>
            Wind: {formatKnots(windSpeedKmh)} aus {degToCardinal(windDirectionDeg)}
          </Popup>
        </Marker>
        {SAILING_CLUBS.map((club) => (
          <Marker key={club.id} position={[club.lat, club.lon]} icon={clubIcon}>
            <Popup>
              <strong>{club.name}</strong>
              <br />
              {club.description}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
