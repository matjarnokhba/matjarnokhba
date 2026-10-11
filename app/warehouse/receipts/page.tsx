"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Package, Store, MapPin } from "lucide-react";

type Task = {
  orderId: number;
  orderNumber: string;
  seller: { id: number; storeName: string; city: string | null };
  itemsCount: number;
  status: string;
};

export default function WarehouseReceiptsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "ALL" | "IN_TRANSIT_TO_WAREHOUSE" | "RECEIVED" | "VERIFIED"
  >("ALL");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/warehouse/tasks");
        const data = await res.json();
        if (data.success) {
          setTasks([
            ...(data.incoming || []),
            ...(data.received || []),
            ...(data.ready || []),
          ]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered =
    filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">الاستلامات</h1>
        <p className="mt-1 text-sm text-gray-500">{filtered.length} طرد</p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { key: "ALL", label: "الكل" },
          { key: "IN_TRANSIT_TO_WAREHOUSE", label: "في الطريق" },
          { key: "RECEIVED", label: "بانتظار الفحص" },
          { key: "VERIFIED", label: "تم الفحص" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === f.key
                ? "bg-teal-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا توجد استلامات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <div
              key={t.orderId}
              className="rounded-xl bg-white p-4 shadow-sm"
            >
              <div className="font-mono text-sm font-black">
                {t.orderNumber}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                <Store className="h-3 w-3" />
                {t.seller.storeName}
              </div>
              {t.seller.city && (
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                  <MapPin className="h-3 w-3" />
                  {t.seller.city}
                </div>
              )}
              <div className="mt-1 text-[11px] text-gray-500">
                {t.itemsCount} منتج
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}