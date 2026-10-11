"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Package,
  CheckCircle2,
  Truck,
  MapPin,
  Phone,
  ChevronLeft,
} from "lucide-react";

type Shipment = {
  id: number;
  shipmentNumber: string;
  status: string;
  totalCOD: number;
  totalOrders: number;
  customer: {
    id: number;
    name: string;
    phone: string | null;
  } | null;
  city: string | null;
  ordersCount: number;
  assignedAt: string | null;
};

export default function DeliveryDashboard() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/delivery/shipments?status=ACTIVE");
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Truck className="h-6 w-6 text-green-600" />
          لوحة السائق
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          لديك {shipments.length} شحنة نشطة
        </p>
      </div>

      {/* أزرار سريعة */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Link
          href="/delivery/scan"
          className="flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white shadow-lg transition hover:shadow-xl"
        >
          <Package className="h-8 w-8" />
          <span className="text-sm font-black">مسح QR الشحنة</span>
        </Link>
        <Link
          href="/delivery/shipments"
          className="flex flex-col items-center gap-2 rounded-2xl bg-white p-6 text-gray-900 shadow-md transition hover:shadow-lg"
        >
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <span className="text-sm font-black">كل الشحنات</span>
        </Link>
      </div>

      {/* الشحنات النشطة */}
      <h2 className="mb-3 text-base font-black">الشحنات النشطة</h2>

      {shipments.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="text-5xl">✅</div>
          <p className="mt-3 text-sm text-gray-500">
            لا توجد شحنات نشطة حالياً
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shipments.map((s) => (
            <Link
              key={s.id}
              href={`/delivery/shipments/${s.id}`}
              className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-black text-gray-900">
                    {s.shipmentNumber}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {s.customer?.name || "—"} · {s.totalOrders} طلب
                  </div>
                  {s.city && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
                      <MapPin className="h-3 w-3" />
                      {s.city}
                    </div>
                  )}
                  {s.customer?.phone && (
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                      <Phone className="h-3 w-3" />
                      <span dir="ltr">{s.customer.phone}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                    {s.status === "ASSIGNED"
                      ? "مُسندة"
                      : s.status === "PICKED_UP"
                        ? "تم الاستلام"
                        : s.status === "OUT_FOR_DELIVERY"
                          ? "قيد التوصيل"
                          : s.status}
                  </div>
                  <ChevronLeft className="h-4 w-4 text-gray-300" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}