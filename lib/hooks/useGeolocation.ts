"use client";

import { useEffect, useRef, useState } from "react";

export type GeoPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export type GeoErrorCode =
  | "UNSUPPORTED"
  | "PERMISSION_DENIED"
  | "POSITION_UNAVAILABLE"
  | "TIMEOUT"
  | "UNKNOWN";

export type UseGeolocationResult = {
  position: GeoPosition | null;
  error: GeoErrorCode | null;
  supported: boolean;
  watching: boolean;
};

export function useGeolocation(enabled: boolean): UseGeolocationResult {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<GeoErrorCode | null>(null);
  const [supported, setSupported] = useState(true);
  const [watching, setWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setSupported(false);
      setError("UNSUPPORTED");
      return;
    }

    setWatching(true);
    setSupported(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setError(null);
      },
      (err) => {
        const code: GeoErrorCode =
          err.code === err.PERMISSION_DENIED
            ? "PERMISSION_DENIED"
            : err.code === err.POSITION_UNAVAILABLE
              ? "POSITION_UNAVAILABLE"
              : err.code === err.TIMEOUT
                ? "TIMEOUT"
                : "UNKNOWN";
        setError(code);
        setWatching(false);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 15000,
        timeout: 20000,
      }
    );

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setWatching(false);
    };
  }, [enabled]);

  return { position, error, supported, watching };
}