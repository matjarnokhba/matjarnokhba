"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Package,
  MapPin,
  Store,
  ChevronLeft,
  Map as MapIcon,
  X,
  AlertCircle,
  Navigation,
} from "lucide-react";
import { LiveMap } from "@/components/maps";
import type { MapMarker } from "@/components/maps";

type Task = {
  orderId: number;
  orderNumber: string;
  seller: {
    id: number;
    storeName: string;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  itemsCount: number;
  status: string;
  readyAt: string | null;
  collectedAt: string | null;
};

type MapSeller = {
  id: number;
  storeName: string;
  city: string | null;
  slug: string;
  latitude: number;
  longitude: number;
};

export default function CollectorTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "READY_FOR_COLLECTION" | "COLLECTED">("ALL");

  const [mapOpen, setMapOpen] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapSellers, setMapSellers] = useState<MapSeller[]>([]);
  const [mapError, setMapError] = useState("");
  const [withoutLocation, setWithoutLocation] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/collector/tasks");
        const data = await res.json();
        if (data.success) setTasks(data.tasks || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function openMap() {
    setMapOpen(true);
    setMapError("");
    setMapLoading(true);
    try {
      const res = await fetch("/api/collector/tasks/sellers-map");
      const data = await res.json();
      if (!data.success) { setMapError(data.message || "فشل تحميل المواقع"); return; }
      setMapSellers(data.sellers || []);
      setWithoutLocation(data.withoutLocation || 0);
    } catch { setMapError("خطأ في الاتصال"); }
    finally { setMapLoading(false); }
  }

  function closeMap() { setMapOpen(false); setMapSellers([]); setMapError(""); }

  const filtered = filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter);
  const markers: MapMarker[] = mapSellers.map((s) => ({
    id: s.id, lat: s.latitude, lng: s.longitude,
    label: s.storeName, tooltip: s.city ? `${s.city}` : undefined, color: "#22c55e",
  }));

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">مهام الجمع</h1>
          <p className="mt-1 text-sm text-gray-500">{filtered.length} مهمة</p>
        </div>
        <button onClick={openMap} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700">
          <MapIcon className="h-4 w-4" />
          خريطة المتاجر
        </button>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto">
        {[
          { key: "ALL", label: "الكل" },
          { key: "READY_FOR_COLLECTION", label: "جاهز للاستلام" },
          { key: "COLLECTED", label: "تم استلامه" },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key as any)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${filter === f.key ? "bg-purple-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا توجد مهام</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const hasLocation = t.seller.latitude != null && t.seller.longitude != null;
            return (
              <div key={`${t.orderId}-${t.status}`} className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm font-black">{t.orderNumber}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                      <Store className="h-3 w-3" />{t.seller.storeName}
                    </div>
                    {t.seller.city && (
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                        <MapPin className="h-3 w-3" />{t.seller.city}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-gray-500">{t.itemsCount} منتج</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {hasLocation && (
                      <button onClick={openMap} className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100" title="عرض موقع المتجر">
                        <Navigation className="h-3 w-3" />الموقع
                      </button>
                    )}
                    <Link href={`/collector/scan`} className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:underline">
                      مسح<ChevronLeft className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mapOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={closeMap}>
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapIcon className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-black text-gray-900">خريطة متاجر التكليف</h2>
                {mapSellers.length > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{mapSellers.length} متجر</span>
                )}
                {withoutLocation > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">{withoutLocation} بدون موقع</span>
                )}
              </div>
              <button onClick={closeMap} className="rounded-lg p-1.5 hover:bg-gray-100" aria-label="إغلاق">
                <X className="h-5 w-5" />
              </button>
            </div>

            {mapLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
            ) : mapError ? (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />{mapError}
              </div>
            ) : mapSellers.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-12 text-center">
                <MapIcon className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">لا توجد متاجر بموقع محدد في مهامك الحالية</p>
                {withoutLocation > 0 && (
                  <p className="mt-2 text-xs text-amber-600">({withoutLocation} متجر بدون موقع — يرجى الطلب من الإدارة تحديدها)</p>
                )}
              </div>
            ) : (
              <>
                <div className="mb-2 flex-1"><LiveMap markers={markers} height={500} fitBounds={true} /></div>
                <p className="text-[11px] text-gray-500">اضغط على أي علامة لعرض اسم المتجر والمدينة.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}