"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  QrCode,
  Package,
  MapPin,
  Store,
  ChevronLeft,
  Clock,
} from "lucide-react";

type Task = {
  orderId: number;
  orderNumber: string;
  seller: {
    id: number;
    storeName: string;
    city: string | null;
  };
  itemsCount: number;
  status: "READY_FOR_COLLECTION" | "COLLECTED" | "IN_TRANSIT_TO_WAREHOUSE";
  readyAt: string | null;
  collectedAt: string | null;
};

export default function CollectorDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
      </div>
    );
  }

  const readyCount = tasks.filter(
    (t) => t.status === "READY_FOR_COLLECTION"
  ).length;
  const collectedCount = tasks.filter(
    (t) => t.status === "COLLECTED"
  ).length;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">لوحة الجمع</h1>
        <p className="mt-1 text-sm text-gray-500">
          {readyCount} جاهز للاستلام · {collectedCount} بانتظار التسليم
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Link
          href="/collector/scan"
          className="flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 p-6 text-white shadow-lg transition hover:shadow-xl"
        >
          <QrCode className="h-8 w-8" />
          <span className="text-sm font-black">مسح QR</span>
        </Link>
        <Link
          href="/collector/tasks"
          className="flex flex-col items-center gap-2 rounded-2xl bg-white p-6 text-gray-900 shadow-md transition hover:shadow-lg"
        >
          <Package className="h-8 w-8 text-purple-600" />
          <span className="text-sm font-black">كل المهام</span>
        </Link>
      </div>

      <h2 className="mb-3 text-base font-black">مهام اليوم</h2>

      {tasks.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="text-5xl">📦</div>
          <p className="mt-3 text-sm text-gray-500">
            لا توجد مهام جمع حالياً
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.slice(0, 10).map((t) => (
            <Link
              key={`${t.orderId}-${t.status}`}
              href={`/collector/scan?token=${encodeURIComponent(t.orderNumber)}`}
              className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-gray-900">
                      {t.orderNumber}
                    </span>
                    <TaskBadge status={t.status} />
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

function TaskBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    READY_FOR_COLLECTION: {
      label: "جاهز للاستلام",
      cls: "bg-amber-100 text-amber-700",
    },
    COLLECTED: {
      label: "تم الاستلام — بالطريق",
      cls: "bg-blue-100 text-blue-700",
    },
    IN_TRANSIT_TO_WAREHOUSE: {
      label: "في الطريق للمستودع",
      cls: "bg-indigo-100 text-indigo-700",
    },
  };
  const info = map[status] || { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${info.cls}`}>
      {info.label}
    </span>
  );
}