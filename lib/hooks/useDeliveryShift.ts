"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoPosition } from "./useGeolocation";

export type ShiftState = "IDLE" | "STARTING" | "ONLINE" | "STOPPING" | "ERROR";

export type UseDeliveryShiftOptions = {
  assignmentId?: number | null;
  pingIntervalMs?: number;
};

export type UseDeliveryShiftResult = {
  state: ShiftState;
  isOnline: boolean;
  startedAt: Date | null;
  lastPingAt: Date | null;
  pingCount: number;
  lastError: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

const DEFAULT_PING_INTERVAL_MS = 15000;
const STATUS_CHECK_DELAY_MS = 200;

export function useDeliveryShift(
  position: GeoPosition | null,
  options: UseDeliveryShiftOptions = {}
): UseDeliveryShiftResult {
  const pingIntervalMs = options.pingIntervalMs ?? DEFAULT_PING_INTERVAL_MS;
  const [state, setState] = useState<ShiftState>("IDLE");
  const [isOnline, setIsOnline] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [lastPingAt, setLastPingAt] = useState<Date | null>(null);
  const [pingCount, setPingCount] = useState(0);
  const [lastError, setLastError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionRef = useRef<GeoPosition | null>(null);
  const sendingRef = useRef(false);

  // Keep latest position in ref (avoid stale closures in interval)
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Initial status check (persist across reloads)
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/delivery/location/status");
        const d = await res.json();
        if (cancelled) return;
        if (d.success && d.isOnline) {
          setIsOnline(true);
          setState("ONLINE");
          if (d.lastLocationAt) setLastPingAt(new Date(d.lastLocationAt));
        }
      } catch {
        /* silent */
      }
    }, STATUS_CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const sendPing = useCallback(
    async (pos: GeoPosition) => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      try {
        const res = await fetch("/api/delivery/location/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: pos.latitude,
            longitude: pos.longitude,
            accuracy: pos.accuracy,
            assignmentId: options.assignmentId ?? null,
          }),
        });
        const d = await res.json();
        if (d.success) {
          setLastPingAt(new Date());
          if (!d.skipped) setPingCount((c) => c + 1);
        } else if (d.code === "NOT_ONLINE") {
          setIsOnline(false);
          setState("IDLE");
        }
      } catch {
        /* silent */
      } finally {
        sendingRef.current = false;
      }
    },
    [options.assignmentId]
  );

  // Interval loop while online
  useEffect(() => {
    if (!isOnline) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      if (positionRef.current) {
        void sendPing(positionRef.current);
      }
    }, pingIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOnline, pingIntervalMs, sendPing]);

  const start = useCallback(async () => {
    if (state === "STARTING" || state === "ONLINE") return;
    setState("STARTING");
    setLastError("");
    try {
      const res = await fetch("/api/delivery/location/start", {
        method: "POST",
      });
      const d = await res.json();
      if (!d.success) {
        setLastError(d.message || "فشل بدء النوبة");
        setState("ERROR");
        return;
      }
      setIsOnline(true);
      setStartedAt(new Date());
      setState("ONLINE");
      // Immediate first ping
      if (positionRef.current) {
        void sendPing(positionRef.current);
      }
    } catch {
      setLastError("خطأ في الاتصال");
      setState("ERROR");
    }
  }, [state, sendPing]);

  const stop = useCallback(async () => {
    if (state === "STOPPING") return;
    setState("STOPPING");
    setLastError("");
    try {
      await fetch("/api/delivery/location/stop", { method: "POST" });
      setIsOnline(false);
      setStartedAt(null);
      setPingCount(0);
      setState("IDLE");
    } catch {
      setLastError("خطأ في الاتصال");
      setState("ERROR");
    }
  }, [state]);

  return {
    state,
    isOnline,
    startedAt,
    lastPingAt,
    pingCount,
    lastError,
    start,
    stop,
  };
}