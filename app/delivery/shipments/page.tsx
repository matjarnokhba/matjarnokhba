"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Truck, MapPin, CheckCircle2, ChevronLeft } from "lucide-react";

type ShipmentSummary = {
  id: number;
  shipmentNumber: string;
  status: string;
  totalCOD: number;
  totalOrders: number;
  city: string | null;
  assignedAt: string;
};

export default function DeliveryShipmentsListPage() {
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/delivery/shipments?status=ACTIVE");
        const data = await res.json();
        if (data.success) {
          setShipments(data.shipments);
        } else {
          setError(data.message || "فشل التحميل");
        }
      } catch (err) {
        setError("فشل الاتصال");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-green-500" /></div>;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-black text-gray-900">
        <Truck className="h-6 w-6 text-green-600" />
        شحناتي النشطة
      </h1>

      {error && <div className="mb-4 bg-red-50 text-red-700 p-3 rounded">{error}</div>}

      {shipments.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-3" />
          <p className="text-lg font-bold text-gray-700">لا توجد شحنات نشطة حالياً</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shipments.map((s) => (
            <Link key={s.id} href={`/delivery/shipments/${s.id}`} className="block bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
              <div className="flex justify-between items-center mb-3">
                <span className="font-mono text-lg font-black">{s.shipmentNumber}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded ${s.status === "OUT_FOR_DELIVERY" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                  {s.status === "ASSIGNED" ? "بانتظار التحميل" : s.status === "OUT_FOR_DELIVERY" ? "قيد التوصيل" : s.status}
                </span>
              </div>
              <div className="text-sm font-bold text-gray-700 mb-1">
                {s.totalOrders} طلبات • {s.totalCOD.toFixed(2)} د.م
              </div>
              <div className="text-xs text-gray-500 flex items-center justify-between">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.city || "غير محدد"}</span>
                <ChevronLeft className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}