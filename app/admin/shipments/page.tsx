"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Package,
  Loader2,
  Truck,
  User,
  ChevronLeft,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  MapPin,
} from "lucide-react";

type Shipment = {
  id: number;
  shipmentNumber: string;
  status: string;
  totalCOD: number;
  totalOrders: number;
  totalItems: number;
  customer: { id: number; name: string; phone: string | null } | null;
  deliveryPerson: { name: string; phone: string } | null;
  createdAt: string;
  assignedAt: string | null;
};

type Filter = "ALL" | "DRAFT" | "READY" | "ASSIGNED" | "IN_TRANSIT" | "DELIVERED";

const STATUS_INFO: Record<
  string,
  { label: string; cls: string; icon: any }
> = {
  DRAFT: {
    label: "مسودة",
    cls: "bg-gray-100 text-gray-700",
    icon: Clock,
  },
  READY: {
    label: "جاهزة",
    cls: "bg-blue-100 text-blue-700",
    icon: Package,
  },
  ASSIGNED: {
    label: "مُسندة",
    cls: "bg-purple-100 text-purple-700",
    icon: Truck,
  },
  IN_TRANSIT: {
    label: "مع السائق",
    cls: "bg-amber-100 text-amber-700",
    icon: Truck,
  },
  DELIVERED: {
    label: "تم التسليم",
    cls: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
  PARTIALLY_DELIVERED: {
    label: "تسليم جزئي",
    cls: "bg-orange-100 text-orange-700",
    icon: CheckCircle2,
  },
  POSTPONED: {
    label: "مؤجل",
    cls: "bg-yellow-100 text-yellow-700",
    icon: Clock,
  },
  REFUSED: {
    label: "مرفوض",
    cls: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  RETURNED: {
    label: "مُرجع",
    cls: "bg-red-100 text-red-700",
    icon: RotateCcw,
  },
  CANCELLED: {
    label: "ملغى",
    cls: "bg-gray-100 text-gray-500",
    icon: XCircle,
  },
};

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const url =
        filter === "ALL"
          ? "/api/admin/shipments"
          : `/api/admin/shipments?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }
      setShipments(data.shipments);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
            <Truck className="h-6 w-6 text-[#ff5c00]" />
            الشحنات
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            إدارة شحنات التوصيل المجمّعة
          </p>
        </div>
        <Link
          href="/admin/shipments/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
        >
          <Plus className="h-4 w-4" />
          شحنة جديدة
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ["ALL", "الكل"],
            ["DRAFT", "مسودة"],
            ["READY", "جاهزة"],
            ["ASSIGNED", "مُسندة"],
            ["IN_TRANSIT", "مع السائق"],
            ["DELIVERED", "تم التسليم"],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === f
                ? "bg-[#ff5c00] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 p-8 text-center text-red-700">
          {error}
        </div>
      ) : shipments.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Truck className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-black">لا توجد شحنات</h3>
          <p className="mt-2 text-sm text-gray-500">
            {filter === "ALL"
              ? "ابدأ بإنشاء أول شحنة"
              : "لا توجد شحنات بهذه الحالة"}
          </p>
          <Link
            href="/admin/shipments/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
          >
            <Plus className="h-4 w-4" />
            شحنة جديدة
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {shipments.map((s) => {
            const info = STATUS_INFO[s.status] || STATUS_INFO.DRAFT;
            const Icon = info.icon;

            return (
              <Link
                key={s.id}
                href={`/admin/shipments/${s.id}`}
                className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-4">
                  {/* Icon */}
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${info.cls}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black text-gray-900">
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

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                      <span>{s.totalOrders} طلب</span>
                      <span>·</span>
                      <span>{s.totalItems} عنصر</span>
                      {s.deliveryPerson && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            {s.deliveryPerson.name}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="mt-1 text-[10px] text-gray-400">
                      {new Date(s.createdAt).toLocaleDateString("ar-MA", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="shrink-0 text-left">
                    <div className="text-lg font-black text-[#ff5c00]">
                      {s.totalCOD.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-gray-500">د.م</div>
                  </div>

                  <ChevronLeft className="h-5 w-5 shrink-0 text-gray-300" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}