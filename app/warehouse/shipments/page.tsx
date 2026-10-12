"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Truck,
  MapPin,
  User,
  Package,
  ChevronLeft,
  Search,
  AlertCircle,
} from "lucide-react";

const CURRENCY = "د.م";

type Shipment = {
  id: number;
  shipmentNumber: string;
  status: string;
  totalCOD: number;
  totalOrders: number;
  itemsCount: number;
  city: string | null;
  district: string | null;
  customer: { name: string; phone: string | null } | null;
  deliveryPerson: { name: string; phone: string | null } | null;
  assignedAt: string | null;
  createdAt: string;
};

export default function WarehouseShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "COMPLETED">(
    "ACTIVE"
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/warehouse/shipments?status=${statusFilter}`
        );
        const data = await res.json();
        if (data.success) setShipments(data.shipments || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [statusFilter]);

  // ═══ Available cities ═══
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    shipments.forEach((s) => {
      if (s.city) set.add(s.city);
    });
    return Array.from(set).sort();
  }, [shipments]);

  // ═══ Filtered ═══
  const filtered = useMemo(() => {
    let list = [...shipments];

    if (cityFilter !== "ALL") {
      list = list.filter((s) => s.city === cityFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.shipmentNumber.toLowerCase().includes(q) ||
          s.customer?.name.toLowerCase().includes(q) ||
          s.deliveryPerson?.name.toLowerCase().includes(q)
      );
    }

    return list;
  }, [shipments, cityFilter, search]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Truck className="h-6 w-6 text-teal-600" />
          الشحنات
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {filtered.length} شحنة
        </p>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setStatusFilter("ACTIVE")}
          className={`rounded-full px-4 py-2 text-xs font-bold transition ${
            statusFilter === "ACTIVE"
              ? "bg-teal-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          النشطة
        </button>
        <button
          onClick={() => setStatusFilter("COMPLETED")}
          className={`rounded-full px-4 py-2 text-xs font-bold transition ${
            statusFilter === "COMPLETED"
              ? "bg-teal-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          المكتملة
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث برقم الشحنة أو اسم العميل..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-xs outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Cities */}
      {availableCities.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCityFilter("ALL")}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${
              cityFilter === "ALL"
                ? "bg-teal-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            🌍 الكل
          </button>
          {availableCities.map((c) => (
            <button
              key={c}
              onClick={() => setCityFilter(c)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${
                cityFilter === c
                  ? "bg-teal-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              📍 {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Truck className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا توجد شحنات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/warehouse/shipments/${s.id}`}
              className="block rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-black">
                      {s.shipmentNumber}
                    </span>
                    <StatusBadge status={s.status} />
                  </div>

                  {s.city && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-600">
                      <MapPin className="h-3 w-3" />
                      {s.city}
                      {s.district && ` — ${s.district}`}
                    </div>
                  )}

                  {s.customer && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
                      <User className="h-3 w-3" />
                      {s.customer.name}
                    </div>
                  )}

                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 font-bold text-gray-700">
                      {s.totalOrders} طلب
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 font-bold text-gray-700">
                      {s.itemsCount} عنصر
                    </span>
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 font-bold text-teal-700">
                      {s.totalCOD.toFixed(2)} {CURRENCY}
                    </span>
                  </div>

                  {s.deliveryPerson ? (
                    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700">
                      <Truck className="h-3 w-3" />
                      {s.deliveryPerson.name}
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                      <AlertCircle className="h-3 w-3" />
                      بانتظار الإسناد
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
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "مسودة", cls: "bg-gray-100 text-gray-700" },
    READY: { label: "جاهزة", cls: "bg-blue-100 text-blue-700" },
    ASSIGNED: { label: "مُسندة", cls: "bg-indigo-100 text-indigo-700" },
    PICKED_UP: { label: "استُلمت", cls: "bg-purple-100 text-purple-700" },
    OUT_FOR_DELIVERY: {
      label: "قيد التوصيل",
      cls: "bg-orange-100 text-orange-700",
    },
    DELIVERED: { label: "تم التسليم", cls: "bg-green-100 text-green-700" },
    PARTIALLY_DELIVERED: {
      label: "تسليم جزئي",
      cls: "bg-emerald-100 text-emerald-700",
    },
    REFUSED: { label: "مرفوضة", cls: "bg-red-100 text-red-700" },
    RETURNED: { label: "مُرتجعة", cls: "bg-gray-100 text-gray-700" },
    POSTPONED: { label: "مؤجلة", cls: "bg-amber-100 text-amber-700" },
  };
  const info = map[status] || { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${info.cls}`}>
      {info.label}
    </span>
  );
}