"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Package, MapPin, Store, ChevronLeft } from "lucide-react";

type Task = {
  orderId: number;
  orderNumber: string;
  seller: { id: number; storeName: string; city: string | null };
  itemsCount: number;
  status: string;
  readyAt: string | null;
  collectedAt: string | null;
};

export default function CollectorTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "READY_FOR_COLLECTION" | "COLLECTED">(
    "ALL"
  );

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

  const filtered =
    filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">مهام الجمع</h1>
        <p className="mt-1 text-sm text-gray-500">{filtered.length} مهمة</p>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto">
        {[
          { key: "ALL", label: "الكل" },
          { key: "READY_FOR_COLLECTION", label: "جاهز للاستلام" },
          { key: "COLLECTED", label: "تم استلامه" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === f.key
                ? "bg-purple-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا توجد مهام</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <Link
              key={`${t.orderId}-${t.status}`}
              href={`/collector/scan`}
              className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
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
                <ChevronLeft className="h-4 w-4 shrink-0 text-gray-300" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}