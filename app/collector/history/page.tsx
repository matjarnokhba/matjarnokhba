"use client";

import { useEffect, useState } from "react";
import { Loader2, History, CheckCircle2, XCircle, Package } from "lucide-react";

type Batch = {
  id: number;
  batchNumber: string;
  itemsCount: number;
  totalOrders: number;
  status: string;
  departedAt: string;
  receivedAt: string | null;
};

export default function CollectorHistoryPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/collector/batches/history");
        const data = await res.json();
        if (data.success) setBatches(data.batches || []);
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
          {batches.length} دفعة مكتملة
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : batches.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <History className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا يوجد سجل بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((b) => {
            const isCompleted = b.status === "DELIVERED";
            return (
              <div
                key={b.id}
                className="rounded-xl bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black">
                        {b.batchNumber}
                      </span>
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isCompleted
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {isCompleted ? "مكتملة" : "ملغاة"}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {b.itemsCount} طرد
                      </span>
                      <span>·</span>
                      <span>{b.totalOrders} طلب</span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
                      <span>
                        الانطلاق:{" "}
                        {new Date(b.departedAt).toLocaleString("ar-MA", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      {b.receivedAt && (
                        <span>
                          الاستلام:{" "}
                          {new Date(b.receivedAt).toLocaleString("ar-MA", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}