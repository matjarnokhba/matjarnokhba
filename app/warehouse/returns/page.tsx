"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Package,
  Search,
  ChevronLeft,
  Store,
  User,
  AlertCircle,
  CheckCircle2,
  Truck,
} from "lucide-react";

type ReturnRow = {
  id: number;
  returnNumber: string;
  status: string;
  inspectionStatus: string | null;
  createdAt: string;
  pickedUpAt: string | null;
  warehouseReceivedAt: string | null;
  inspectedAt: string | null;
  returnRequest: {
    id: number;
    reason: string;
    order: { id: number; orderNumber: string };
    user: { id: number; name: string; phone: string | null };
    items: Array<{
      id: number;
      quantity: number;
      orderItem: {
        productName: string;
        imageUrl: string | null;
        seller: { storeName: string } | null;
      };
    }>;
  };
  returnDriver: { user: { name: string } } | null;
};

export default function WarehouseReturnsPage() {
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "ACTIVE" | "INSPECTED" | "COMPLETED" | "ALL"
  >("ACTIVE");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/warehouse/returns?status=${filter}`);
      const data = await res.json();
      if (data.success) setReturns(data.returns || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return returns;
    const q = search.trim().toLowerCase();
    return returns.filter(
      (r) =>
        r.returnNumber.toLowerCase().includes(q) ||
        r.returnRequest.order.orderNumber.toLowerCase().includes(q) ||
        r.returnRequest.user.name.toLowerCase().includes(q)
    );
  }, [returns, search]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Package className="h-6 w-6 text-teal-600" />
          إرجاعات
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {filtered.length} مرتجع
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: "ACTIVE", label: "نشطة" },
          { key: "INSPECTED", label: "تم فحصها" },
          { key: "COMPLETED", label: "مكتملة" },
          { key: "ALL", label: "الكل" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === f.key
                ? "bg-teal-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث برقم المرتجع أو الطلب..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-xs outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا توجد مرتجعات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/warehouse/returns/${r.id}`}
              className="block rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-black">
                      {r.returnNumber}
                    </span>
                    <ReturnStatusBadge
                      status={r.status}
                      inspectionStatus={r.inspectionStatus}
                    />
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                    <Store className="h-3 w-3" />
                    <span className="font-mono">
                      {r.returnRequest.order.orderNumber}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                    <User className="h-3 w-3" />
                    {r.returnRequest.user.name}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                    <span>سبب: {r.returnRequest.reason}</span>
                    <span>
                      ·{" "}
                      {r.returnRequest.items.length === 1
                        ? "منتج واحد"
                        : `${r.returnRequest.items.length} منتجات`}
                    </span>
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

function ReturnStatusBadge({
  status,
  inspectionStatus,
}: {
  status: string;
  inspectionStatus: string | null;
}) {
  if (status === "COMPLETED") {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
        ✅ مكتمل
      </span>
    );
  }
  if (status === "INSPECTED") {
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
          inspectionStatus === "INTACT"
            ? "bg-green-100 text-green-700"
            : inspectionStatus === "DAMAGED"
              ? "bg-red-100 text-red-700"
              : "bg-amber-100 text-amber-700"
        }`}
      >
        {inspectionStatus === "INTACT"
          ? "سليم — بانتظار الإرجاع"
          : inspectionStatus === "DAMAGED"
            ? "متضرر"
            : "ناقص"}
      </span>
    );
  }
  if (status === "IN_TRANSIT_TO_WAREHOUSE") {
    return (
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
        🚚 في الطريق
      </span>
    );
  }
  if (status === "IN_TRANSIT_TO_SELLER") {
    return (
      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
        🚚 إلى التاجر
      </span>
    );
  }
  if (status === "DELIVERED_TO_SELLER") {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
        رفض التاجر
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">
      {status}
    </span>
  );
}