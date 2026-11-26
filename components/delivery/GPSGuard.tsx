"use client";

import { useEffect } from "react";
import {
  Navigation,
  Loader2,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
} from "lucide-react";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { useDeliveryShift } from "@/lib/hooks/useDeliveryShift";

function fmtTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString("ar-MA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function GPSHelpScreen({ type }: { type: "PERMISSION_DENIED" | "UNSUPPORTED" | "POSITION_UNAVAILABLE" }) {
  const content =
    type === "UNSUPPORTED"
      ? {
          title: "المتصفح لا يدعم تحديد الموقع",
          steps: ["استخدم Chrome أو Safari حديثاً", "تأكد من أنك على HTTPS"],
        }
      : type === "POSITION_UNAVAILABLE"
        ? {
            title: "تعذر الحصول على موقعك",
            steps: [
              "تأكد من تشغيل GPS في جهازك",
              "اخرج إلى مكان مفتوح (داخل البنايات إشارة GPS أضعف)",
              "أعد تحديث الصفحة",
            ],
          }
        : {
            title: "تم رفض الوصول للموقع",
            steps: [
              "اضغط على أيقونة القفل بجانب الرابط في المتصفح",
              "اختر «الموقع» ثم «السماح»",
              "أعد تحديث الصفحة",
              "على Android: إعدادات → التطبيقات → Chrome → الأذونات → الموقع → السماح",
            ],
          };

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>
        <h2 className="text-center text-lg font-black text-gray-900">
          {content.title}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          لا يمكن استخدام لوحة السائق بدون تفعيل خدمة الموقع.
        </p>
        <ul className="mt-4 space-y-2 rounded-lg bg-gray-50 p-4">
          {content.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 w-full rounded-lg bg-[#ff5c00] px-4 py-3 text-sm font-bold text-white hover:bg-[#e64a00]"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

function StartShiftScreen({
  onStart,
  isStarting,
  error,
  hasPosition,
}: {
  onStart: () => void;
  isStarting: boolean;
  error: string;
  hasPosition: boolean;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Navigation className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <h2 className="text-center text-lg font-black text-gray-900">
          بدء نوبة العمل
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          بمجرد بدء النوبة، سيتم تتبع موقعك أثناء أداء المهام فقط. يمكنك
          إيقافها في أي وقت.
        </p>

        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-gray-50 p-3 text-xs">
          {hasPosition ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-green-700">تم التقاط موقعك بنجاح</span>
            </>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              <span className="text-gray-500">جارٍ التقاط موقعك...</span>
            </>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={onStart}
          disabled={isStarting || !hasPosition}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {isStarting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="h-4 w-4" />
          )}
          {isStarting ? "جارٍ البدء..." : "بدء النوبة الآن"}
        </button>
      </div>
    </div>
  );
}

function ShiftStatusBar({
  state,
  lastPingAt,
  pingCount,
  onStop,
}: {
  state: string;
  lastPingAt: Date | null;
  pingCount: number;
  onStop: () => void;
}) {
  const [now, setNow] = React.useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const secondsAgo = lastPingAt
    ? Math.floor((now - lastPingAt.getTime()) / 1000)
    : null;

  const statusColor =
    secondsAgo === null || secondsAgo > 90
      ? "bg-red-500"
      : secondsAgo > 30
        ? "bg-amber-500"
        : "bg-green-500";
  const statusText =
    secondsAgo === null
      ? "لم يُرسل ping بعد"
      : secondsAgo > 90
        ? "متوقف (>90ث)"
        : secondsAgo > 30
          ? `بطيء (${secondsAgo}ث)`
          : `متصل (${secondsAgo}ث)`;

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs shadow-lg ring-1 ring-gray-200">
      <span className={`h-2 w-2 animate-pulse rounded-full ${statusColor}`} />
      <span className="font-bold text-gray-700">{statusText}</span>
      <span className="text-gray-400">·</span>
      <span className="text-gray-500">{pingCount} ping</span>
      <button
        onClick={onStop}
        disabled={state === "STOPPING"}
        className="ml-1 flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
      >
        {state === "STOPPING" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <PauseCircle className="h-3 w-3" />
        )}
        إيقاف
      </button>
    </div>
  );
}

import * as React from "react";

export default function GPSGuard({ children }: { children: React.ReactNode }) {
  const { position, error: geoError, supported } = useGeolocation(true);
  const shift = useDeliveryShift(position);

  if (!supported) return <GPSHelpScreen type="UNSUPPORTED" />;
  if (geoError === "PERMISSION_DENIED") return <GPSHelpScreen type="PERMISSION_DENIED" />;
  if (geoError === "POSITION_UNAVAILABLE") return <GPSHelpScreen type="POSITION_UNAVAILABLE" />;

  if (shift.state === "ONLINE" || shift.state === "STOPPING") {
    return (
      <>
        {children}
        <ShiftStatusBar
          state={shift.state}
          lastPingAt={shift.lastPingAt}
          pingCount={shift.pingCount}
          onStop={shift.stop}
        />
      </>
    );
  }

  if (shift.state === "ERROR") {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="inline h-4 w-4" /> {shift.lastError || "حدث خطأ"}
        </div>
      </div>
    );
  }

  return (
    <StartShiftScreen
      onStart={shift.start}
      isStarting={shift.state === "STARTING"}
      error={shift.lastError}
      hasPosition={position !== null}
    />
  );
}