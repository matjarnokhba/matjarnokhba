"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Map as MapIcon,
  Users,
  Store,
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Package,
  UserX,
} from "lucide-react";
import { LiveMap } from "@/components/maps";
import type { MapMarker } from "@/components/maps";

type StaffStatus = "ONLINE" | "STALE" | "OFFLINE" | "NEVER";

type Assignment =
  | {
      type: "DELIVERY";
      id: number;
      status: string;
      label: string;
    }
  | {
      type: "COLLECTION";
      id: number;
      status: string;
      label: string;
    }
  | null;

type StaffRow = {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  isOnline: boolean;
  status: StaffStatus;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  lastLocationAt: string | null;
  currentAssignment: Assignment;
};

type Counts = {
  total: number;
  online: number;
  stale: number;
  offline: number;
  never: number;
  withLocation: number;
};

type StoreRow = {
  id: number;
  storeName: string;
  slug: string;
  city: string | null;
  region: string | null;
  latitude: number;
  longitude: number;
  status: string;
  productsCount: number;
  ordersCount: number;
};

type Tab = "staff" | "stores";

function fmtRelative(iso: string | null): string {
  if (!iso) return "أبداً";
  const d = new Date(iso).getTime();
  const seconds = Math.floor((Date.now() - d) / 1000);
  if (seconds < 30) return "الآن";
  if (seconds < 90) return `${seconds}ث`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}د`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}س`;
  return `${Math.floor(seconds / 86400)}ي`;
}

function statusLabel(status: StaffStatus): {
  label: string;
  color: string;
  bg: string;
  dot: string;
} {
  switch (status) {
    case "ONLINE":
      return { label: "متصل", color: "text-green-700", bg: "bg-green-100", dot: "#22c55e" };
    case "STALE":
      return { label: "متوقف", color: "text-amber-700", bg: "bg-amber-100", dot: "#f59e0b" };
    case "OFFLINE":
      return { label: "غير متصل", color: "text-gray-700", bg: "bg-gray-100", dot: "#6b7280" };
    case "NEVER":
      return { label: "لم يُفعّل", color: "text-red-700", bg: "bg-red-100", dot: "#ef4444" };
  }
}

export default function WarehouseTrackingPage() {
  const [tab, setTab] = useState<Tab>("staff");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Staff state
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [staffFilter, setStaffFilter] = useState<StaffStatus | "ALL">("ALL");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Stores state
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storesStats, setStoresStats] = useState<{
    total: number;
    withLocation: number;
    withoutLocation: number;
  } | null>(null);

  const loadStaff = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/warehouse/tracking/live");
      const data = await res.json();
      if (!data.success) {
        if (!silent) setError(data.message || "فشل تحميل السائقين");
        return;
      }
      setStaff(data.staff || []);
      setCounts(data.counts || null);
      setLastRefresh(new Date());
      setError("");
    } catch {
      if (!silent) setError("خطأ في الاتصال");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadStores = useCallback(async () => {
    try {
      const res = await fetch("/api/warehouse/tracking/stores");
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "فشل تحميل المتاجر");
        return;
      }
      setStores(data.stores || []);
      setStoresStats({
        total: data.totalStores || 0,
        withLocation: data.withLocation || 0,
        withoutLocation: data.withoutLocation || 0,
      });
      setError("");
    } catch {
      setError("خطأ في الاتصال");
    }
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadStaff(true), loadStores()]);
      setLoading(false);
    })();
  }, [loadStaff, loadStores]);

  // Auto-refresh staff every 15s (only when staff tab active)
  useEffect(() => {
    if (tab !== "staff") return;
    const timer = setInterval(() => {
      void loadStaff(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [tab, loadStaff]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  const filteredStaff =
    staffFilter === "ALL" ? staff : staff.filter((s) => s.status === staffFilter);

  // Build markers based on tab
  const markers: MapMarker[] =
    tab === "staff"
      ? filteredStaff
          .filter((s) => s.latitude != null && s.longitude != null)
          .map((s) => ({
            id: `staff-${s.id}`,
            lat: s.latitude!,
            lng: s.longitude!,
            label: s.name,
            color: statusLabel(s.status).dot,
            tooltip: `${statusLabel(s.status).label} · ${s.city}${
              s.currentAssignment ? ` · ${s.currentAssignment.label}` : ""
            }`,
          }))
      : stores.map((s) => ({
          id: `store-${s.id}`,
          lat: s.latitude,
          lng: s.longitude,
          label: s.storeName,
          color: "#22c55e",
          tooltip: s.city || undefined,
        }));

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
            <MapIcon className="h-6 w-6 text-[#ff5c00]" />
            الخريطة المركزية
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            متابعة مواقع السائقين والمتاجر على الخريطة
          </p>
        </div>
        <button
          onClick={() => tab === "staff" ? void loadStaff() : void loadStores()}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          تحديث
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex gap-2 rounded-xl bg-white p-1.5 shadow-sm">
        <button
          onClick={() => setTab("staff")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
            tab === "staff" ? "bg-[#ff5c00] text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Users className="h-4 w-4" />
          السائقون ({staff.length})
        </button>
        <button
          onClick={() => setTab("stores")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
            tab === "stores" ? "bg-[#ff5c00] text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Store className="h-4 w-4" />
          المتاجر ({stores.length})
        </button>
      </div>

      {/* Staff tab */}
      {tab === "staff" && (
        <>
          {counts && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard
                label="متصل"
                value={counts.online}
                icon={<Wifi className="h-4 w-4" />}
                color="green"
                active={staffFilter === "ONLINE"}
                onClick={() => setStaffFilter(staffFilter === "ONLINE" ? "ALL" : "ONLINE")}
              />
              <StatCard
                label="متوقف"
                value={counts.stale}
                icon={<Clock className="h-4 w-4" />}
                color="amber"
                active={staffFilter === "STALE"}
                onClick={() => setStaffFilter(staffFilter === "STALE" ? "ALL" : "STALE")}
              />
              <StatCard
                label="غير متصل"
                value={counts.offline}
                icon={<WifiOff className="h-4 w-4" />}
                color="gray"
                active={staffFilter === "OFFLINE"}
                onClick={() => setStaffFilter(staffFilter === "OFFLINE" ? "ALL" : "OFFLINE")}
              />
              <StatCard
                label="لم يُفعّل"
                value={counts.never}
                icon={<UserX className="h-4 w-4" />}
                color="red"
                active={staffFilter === "NEVER"}
                onClick={() => setStaffFilter(staffFilter === "NEVER" ? "ALL" : "NEVER")}
              />
            </div>
          )}

          {lastRefresh && (
            <p className="mb-2 text-xs text-gray-500">
              آخر تحديث: {lastRefresh.toLocaleTimeString("ar-MA")} — يتحدث كل 15 ثانية
            </p>
          )}

          {filteredStaff.filter((s) => s.latitude != null).length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm">
              <MapIcon className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">
                {staffFilter === "ALL"
                  ? "لا توجد مواقع سائقين لعرضها"
                  : "لا توجد سائقون بهذه الحالة"}
              </p>
            </div>
          ) : (
            <div className="mb-4">
              <LiveMap markers={markers} height={420} fitBounds={true} />
            </div>
          )}

          {/* Staff list */}
          <div className="space-y-2">
            {filteredStaff.map((s) => {
              const st = statusLabel(s.status);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: st.dot }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-sm text-gray-900">
                        {s.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {s.phone} · {s.city}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.currentAssignment && (
                      <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        <Package className="h-2.5 w-2.5" />
                        {s.currentAssignment.label}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.bg} ${st.color}`}>
                      {st.label}
                    </span>
                    <span className="text-[10px] text-gray-500 w-12 text-left">
                      {fmtRelative(s.lastLocationAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Stores tab */}
      {tab === "stores" && (
        <>
          {storesStats && (
            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                <p className="text-xs text-gray-500">إجمالي</p>
                <p className="text-2xl font-black text-gray-900">{storesStats.total}</p>
              </div>
              <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                <p className="text-xs text-gray-500">بموقع</p>
                <p className="text-2xl font-black text-green-600">{storesStats.withLocation}</p>
              </div>
              <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                <p className="text-xs text-gray-500">بدون موقع</p>
                <p className="text-2xl font-black text-amber-600">{storesStats.withoutLocation}</p>
              </div>
            </div>
          )}

          {stores.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm">
              <Store className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">لا توجد متاجر بموقع محدد</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <LiveMap markers={markers} height={420} fitBounds={true} />
              </div>
              <div className="space-y-2">
                {stores.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-sm text-gray-900">
                        {s.storeName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {s.city || "—"}
                        {s.region ? ` · ${s.region}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-[10px] text-gray-500">
                      <span>{s.productsCount} منتج</span>
                      <span>·</span>
                      <span>{s.ordersCount} طلب</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "green" | "amber" | "gray" | "red";
  active: boolean;
  onClick: () => void;
}) {
  const colorMap = {
    green: { bg: "bg-green-50", text: "text-green-700", border: "border-green-500" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-500" },
    gray: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-500" },
    red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-500" },
  };
  const c = colorMap[color];

  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 bg-white p-3 text-left transition ${
        active ? `${c.border} ${c.bg}` : "border-gray-100 hover:border-gray-200"
      }`}
    >
      <div className={`flex items-center gap-1 text-xs ${active ? c.text : "text-gray-500"}`}>
        {icon}
        {label}
      </div>
      <p className={`mt-1 text-2xl font-black ${active ? c.text : "text-gray-900"}`}>
        {value}
      </p>
    </button>
  );
}