"use client";

import { useEffect, useState } from "react";
import { Loader2, History } from "lucide-react";

export default function WarehouseHistoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/warehouse/tasks");
        const data = await res.json();
        if (data.success) {
          setItems([...(data.received || []), ...(data.ready || [])]);
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
          <History className="h-6 w-6 text-teal-600" />
          سجل المستودع
        </h1>
        <p className="mt-1 text-sm text-gray-500">{items.length} طرد</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <History className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا يوجد سجل</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <div key={t.orderId} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="font-mono text-sm font-black">
                {t.orderNumber}
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                {t.seller.storeName} · {t.itemsCount} منتج
              </div>
              <div className="mt-0.5 text-[10px] font-bold text-teal-700">
                {t.status === "VERIFIED"
                  ? "✅ تم الفحص"
                  : t.status === "RECEIVED"
                    ? "📥 بانتظار الفحص"
                    : t.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}