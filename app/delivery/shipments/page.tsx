"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Package,
  Truck,
  ChevronLeft,
  User,
  MapPin,
  Clock,
  CheckCircle2,
} from "lucide-react";

type Shipment = {
  id: number;
  shipmentNumber: string;
  status: string;
  totalCOD: number;
  totalOrders: number;
  totalItems: number;
  customer: { name: string; phone: string | null } | null;
  assignedAt: string | null;
  createdAt: string;
};

type Filter = "ACTIVE" | "COMPLETED";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ASSIGNED: { label: "مُسندة", cls: "bg-purple-100 text-purple-700" },
  IN_TRANSIT: { label: "مع السائق", cls: "bg-amber-100 text-amber-700" },
  DELIVERED: { label: "تم التسليم", cls: "bg-green-100 text-green-700" },
  PARTIALLY_DELIVERED: {
    label: "تسليم جزئي",
    cls: "bg-orange-100 text-orange-700",
  },
  POSTPONED: { label: "مؤجل", cls: "bg-yellow-100 text-yellow-700" },
  REFUSED: { label: "مرفوض", cls: "bg-red-100 text-red-700" },
  RETURNED: { label: "مُرجع", cls: "bg-red-100 text-red-700" },
  CANCELLED: { label: "ملغى", cls: "bg-gray-100 text-gray-500" },
};

export default function DeliveryShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/shipments?status=${filter}`);
        const data = await res.json();
        if (data.success) setShipments(data.shipments);
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
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Truck className="h-6 w-6 text-green-600" />
          شحناتي
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          الشحنات المُسندة إليك
        </p>
      </div>

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
      ) : shipments.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Truck className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {filter === "ACTIVE"
              ? "لا توجد شحنات نشطة"
              : "لا توجد شحنات مكتملة"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shipments.map((s) => {
            const info = STATUS_LABELS[s.status] || STATUS_LABELS.ASSIGNED;
            return (
              <Link
                key={s.id}
                href={`/delivery/shipments/${s.id}`}
                className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black">
                        {s.shipmentNumber}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${info.cls}`}
                      >
                        {info.label}
                      </span>
                    </div>

                    {s.customer && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                        <User className="h-3 w-3" />
                        {s.customer.name}
                        {s.customer.phone && (
                          <>
                            <span>·</span>
                            <span dir="ltr">{s.customer.phone}</span>
                          </>
                        )}
                      </div>
                    )}

                    <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {s.totalOrders} طلب · {s.totalItems} عنصر
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div className="text-lg font-black text-[#ff5c00]">
                      {s.totalCOD.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-gray-500">د.م</div>
                  </div>

                  <ChevronLeft className="h-4 w-4 shrink-0 text-gray-300" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}