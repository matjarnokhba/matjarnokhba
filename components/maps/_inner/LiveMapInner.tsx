"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import { createDotIcon } from "./leaflet-setup";
import type { LiveMapProps, MapMarker } from "../types";

function BoundsFitter({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 15);
      return;
    }
    const bounds = markers.map((m) => [m.lat, m.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [markers, map]);
  return null;
}

export default function LiveMapInner({
  markers,
  height = 480,
  fitBounds = true,
}: LiveMapProps) {
  const iconCache = useMemo(() => {
    const cache = new Map<string, L.DivIcon>();
    for (const m of markers) {
      const key = `${m.color || "green"}:${m.label || ""}`;
      if (!cache.has(key)) {
        cache.set(key, createDotIcon(m.color || "#22c55e", m.label));
      }
    }
    return cache;
  }, [markers]);

  const defaultCenter: [number, number] = markers.length > 0
    ? [markers[0].lat, markers[0].lng]
    : [31.7917, -7.0926];
  const defaultZoom = markers.length > 0 ? 12 : 6;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
      style={{ height }}
    >
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {fitBounds && <BoundsFitter markers={markers} />}
        {markers.map((m) => {
          const key = `${m.color || "green"}:${m.label || ""}`;
          const icon = iconCache.get(key) || createDotIcon("#22c55e", m.label);
          return (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={icon}>
              {(m.tooltip || m.label) && (
                <Popup>
                  <div className="text-xs">
                    {m.label && <p className="font-bold">{m.label}</p>}
                    {m.tooltip && <p className="text-gray-600">{m.tooltip}</p>}
                  </div>
                </Popup>
              )}
            </Marker>
          );
        })}
      </MapContainer>
      {markers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-gray-500">
          لا توجد مواقع لعرضها
        </div>
      )}
    </div>
  );
}