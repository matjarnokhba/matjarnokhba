"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import { Crosshair, Loader2, MapPin } from "lucide-react";
import { createPinIcon, L } from "./leaflet-setup";
import type { MapPickerProps, MapCoords } from "../types";

const PIN_ICON = createPinIcon("#ff5c00");

function ClickHandler({ onPick }: { onPick: (c: MapCoords) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function Recenter({ coords }: { coords: MapCoords | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView([coords.lat, coords.lng], map.getZoom());
  }, [coords, map]);
  return null;
}

export default function MapPickerInner({
  initial,
  height = 380,
  readOnly = false,
  showMyLocation = true,
  onChange,
  onConfirm,
}: MapPickerProps) {
  const [coords, setCoords] = useState<MapCoords | null>(initial ?? null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string>("");
  const markerRef = useRef<L.Marker | null>(null);

  // Default center: initial, or Morocco center
  const defaultCenter: [number, number] = initial
    ? [initial.lat, initial.lng]
    : [31.7917, -7.0926];
  const defaultZoom = initial ? 15 : 6;

  function pick(next: MapCoords) {
    if (readOnly) return;
    setCoords(next);
    setLocError("");
    onChange?.(next);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocError("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        pick(next);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocError("تم رفض الوصول للموقع — اسمح بالوصول من إعدادات المتصفح");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocError("تعذر تحديد موقعك — تأكد من تشغيل GPS");
        } else if (err.code === err.TIMEOUT) {
          setLocError("انتهت مهلة تحديد الموقع");
        } else {
          setLocError("تعذر تحديد الموقع");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  return (
    <div className="space-y-2">
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
          {!readOnly && <ClickHandler onPick={pick} />}
          <Recenter coords={coords} />
          {coords && (
            <Marker
              position={[coords.lat, coords.lng]}
              icon={PIN_ICON}
              draggable={!readOnly}
              ref={markerRef}
              eventHandlers={
                readOnly
                  ? undefined
                  : {
                      dragend: () => {
                        const m = markerRef.current;
                        if (m) {
                          const p = m.getLatLng();
                          pick({ lat: p.lat, lng: p.lng });
                        }
                      },
                    }
              }
            />
          )}
        </MapContainer>
        
        {/* Use my location button — overlay */}
        {showMyLocation && !readOnly && (
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-lg hover:bg-gray-50 disabled:opacity-50"
            style={{ zIndex: 1000 }}
          >
            {locating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Crosshair className="h-3.5 w-3.5 text-[#ff5c00]" />
            )}
            {locating ? "جارٍ التحديد..." : "موقعي"}
          </button>
        )}
      </div>
      
      {locError && (
        <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{locError}</div>
      )}
      
      {coords && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-gray-600">
            <MapPin className="h-3.5 w-3.5 text-[#ff5c00]" />
            <span className="font-mono">
              {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </span>
          </span>
          {onConfirm && !readOnly && (
            <button
              type="button"
              onClick={() => onConfirm(coords)}
              className="rounded-lg bg-[#ff5c00] px-3 py-1 text-xs font-bold text-white hover:bg-[#e64a00]"
            >
              تأكيد الموقع
            </button>
          )}
        </div>
      )}
      
      {!coords && !readOnly && (
        <p className="text-xs text-gray-500">
          اضغط على الخريطة أو استخدم زر &quot;موقعي&quot; لتحديد موقع المتجر
        </p>
      )}
    </div>
  );
}