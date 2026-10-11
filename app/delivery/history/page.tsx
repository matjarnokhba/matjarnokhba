"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, History, CheckCircle2 } from "lucide-react";

type Shipment = {
  id: number;
  shipmentNumber: string;
  status: string;
  totalCOD: number;
  totalOrders: number;
  customer: {
    id: number;
    name: string;
  } | null;
  city: string | null;
  completedAt: string | null;
};

export default function DeliveryHistoryPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/delivery/shipments?status=COMPLETED");
        const data = await res.json();
        if (data.success) setShipments(data.shipments || []);
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
          <History className="h-6 w-6 text-green-600" />
          سجل التوصيلات
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {shipments.length} شحنة مكتملة
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      ) : shipments.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <History className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            لا توجد توصيلات مكتملة بعد
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shipments.map((s) => (
            <Link
              key={s.id}
              href={`/delivery/shipments/${s.id}`}
              className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  s.status === "DELIVERED"
                    ? "bg-green-100 text-green-600"
                    : "bg-red-100 text-red-600"
                }`}
              >
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black">
                    {s.shipmentNumber}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      s.status === "DELIVERED"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {s.status === "DELIVERED" ? "تم التسليم" : s.status}
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] text-gray-500">
                  {s.customer?.name || "—"} · {s.city || "—"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}