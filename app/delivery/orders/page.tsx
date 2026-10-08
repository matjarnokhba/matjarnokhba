"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Package,
  MapPin,
  Phone,
  ChevronLeft,
  Clock,
  CheckCircle2,
} from "lucide-react";

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  customerName: string;
  customerPhone: string | null;
  city: string | null;
  street: string | null;
  itemsCount: number;
  assignedAt: string;
};

type Filter = "ACTIVE" | "COMPLETED";

export default function DeliveryOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/orders?status=${filter}`);
        const data = await res.json();
        if (data.success) setOrders(data.orders);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filter]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">طلباتي</h1>
        <p className="mt-1 text-sm text-gray-500">
          الطلبات المُسندة إليك
        </p>
      </div>

      {/* فلاتر */}
      <div className="mb-5 flex gap-2">
        <button
          onClick={() => setFilter("ACTIVE")}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
            filter === "ACTIVE"
              ? "bg-green-500 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          النشطة
        </button>
        <button
          onClick={() => setFilter("COMPLETED")}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
            filter === "COMPLETED"
              ? "bg-green-500 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          المكتملة
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {filter === "ACTIVE" ? "لا توجد طلبات نشطة" : "لا توجد طلبات مكتملة"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/delivery/orders/${o.id}`}
              className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black">
                      {o.orderNumber}
                    </span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {o.customerName} · {o.itemsCount} منتج
                  </div>
                  {o.city && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
                      <MapPin className="h-3 w-3" />
                      {o.city}
                    </div>
                  )}
                  {o.customerPhone && (
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                      <Phone className="h-3 w-3" />
                      <span dir="ltr">{o.customerPhone}</span>
                    </div>
                  )}
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

function StatusBadge({ status }: { status: string }) {
  const info: Record<string, { label: string; cls: string }> = {
    PROCESSING: { label: "قيد التجهيز", cls: "bg-blue-100 text-blue-700" },
    SHIPPED: { label: "تم الشحن", cls: "bg-purple-100 text-purple-700" },
    DELIVERED: { label: "تم التسليم", cls: "bg-green-100 text-green-700" },
    RETURNED: { label: "مُرتجع", cls: "bg-red-100 text-red-700" },
    CANCELLED: { label: "ملغى", cls: "bg-gray-100 text-gray-700" },
  };
  const s = info[status] || { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
}