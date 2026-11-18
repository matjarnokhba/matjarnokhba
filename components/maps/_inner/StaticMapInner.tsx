"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { createPinIcon } from "./leaflet-setup";
import type { StaticMapProps } from "../types";

const PIN_ICON = createPinIcon("#ff5c00");

export default function StaticMapInner({
  lat,
  lng,
  label,
  height = 240,
  zoom = 16,
}: StaticMapProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
      style={{ height }}
    >
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        dragging={true}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={PIN_ICON}>
          {label && <Popup>{label}</Popup>}
        </Marker>
      </MapContainer>
    </div>
  );
}