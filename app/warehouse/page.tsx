"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  QrCode,
  Package,
  Truck,
  Store,
  MapPin,
} from "lucide-react";

type Task = {
  orderId: number;
  orderNumber: string;
  seller: { id: number; storeName: string; city: string | null };
  itemsCount: number;
  status: string;
  readyAt: string | null;
};

export default function WarehouseDashboard() {
  const [incoming, setIncoming] = useState<Task[]>([]);
  const [received, setReceived] = useState<Task[]>([]);
  const [ready, setReady] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/warehouse/tasks");
        const data = await res.json();
        if (data.success) {
          setIncoming(data.incoming || []);
          setReceived(data.received || []);
          setReady(data.ready || []);
        }
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
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">لوحة المستودع</h1>
        <p className="mt-1 text-sm text-gray-500">
          {incoming.length} في الطريق · {received.length} بانتظار الفحص ·{" "}
          {ready.length} جاهز للشحن
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Link
          href="/warehouse/scan"
          className="flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 p-6 text-white shadow-lg transition hover:shadow-xl"
        >
          <QrCode className="h-8 w-8" />
          <span className="text-sm font-black">مسح QR</span>
        </Link>
        <Link
          href="/warehouse/receipts"
          className="flex flex-col items-center gap-2 rounded-2xl bg-white p-6 text-gray-900 shadow-md transition hover:shadow-lg"
        >
          <Package className="h-8 w-8 text-teal-600" />
          <span className="text-sm font-black">الاستلامات</span>
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <TaskColumn
          title="🚚 في الطريق للمستودع"
          count={incoming.length}
          colorClass="text-blue-700"
          items={incoming}
          emptyText="لا توجد طرود في الطريق"
        />
        <TaskColumn
          title="📥 بانتظار الفحص"
          count={received.length}
          colorClass="text-amber-700"
          items={received}
          emptyText="لا توجد استلامات حديثة"
        />
        <TaskColumn
          title="✅ جاهز للشحن"
          count={ready.length}
          colorClass="text-green-700"
          items={ready}
          emptyText="لا توجد طرود جاهزة"
        />
      </div>
    </div>
  );
}

function TaskColumn({
  title,
  count,
  colorClass,
  items,
  emptyText,
}: {
  title: string;
  count: number;
  colorClass: string;
  items: Task[];
  emptyText: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className={`text-sm font-black ${colorClass}`}>{title}</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
          {count}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg bg-gray-50 py-6 text-center text-[11px] text-gray-500">
          {emptyText}
        </div>
      ) : (
        <div className="max-h-[400px] space-y-2 overflow-y-auto">
          {items.slice(0, 10).map((t) => (
            <div
              key={t.orderId}
              className="rounded-lg border border-gray-100 p-3"
            >
              <div className="font-mono text-xs font-black">
                {t.orderNumber}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                <Store className="h-3 w-3" />
                {t.seller.storeName}
              </div>
              {t.seller.city && (
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                  <MapPin className="h-3 w-3" />
                  {t.seller.city}
                </div>
              )}
              <div className="mt-1 text-[10px] text-gray-500">
                {t.itemsCount} منتج
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}