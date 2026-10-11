"use client";

import { useEffect, useState } from "react";
import { Loader2, History } from "lucide-react";

export default function CollectorHistoryPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/collector/tasks");
        const data = await res.json();
        if (data.success) {
          // فقط المكتملة (in_transit)
          setTasks(
            (data.tasks || []).filter(
              (t: any) => t.status === "IN_TRANSIT_TO_WAREHOUSE"
            )
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <History className="h-6 w-6 text-purple-600" />
          سجل الجمع
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {tasks.length} عملية مكتملة
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <History className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا يوجد سجل بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <div
              key={t.orderId}
              className="rounded-xl bg-white p-4 shadow-sm"
            >
              <div className="font-mono text-sm font-black">
                {t.orderNumber}
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                {t.seller.storeName} · {t.itemsCount} منتج
              </div>
              {t.collectedAt && (
                <div className="mt-1 text-[10px] text-gray-400">
                  {new Date(t.collectedAt).toLocaleString("ar-MA")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}