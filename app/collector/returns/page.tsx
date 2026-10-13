"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  RotateCcw,
  Package,
  Search,
  ChevronLeft,
  User,
  Clock,
  CheckCircle2,
} from "lucide-react";

export default function CollectorReturnsPage() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"PENDING" | "PICKED_UP" | "ALL">(
    "PENDING"
  );
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/collector/returns?status=${filter}`);
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

  const filtered = search.trim()
    ? returns.filter(
        (r) =>
          r.returnNumber.toLowerCase().includes(search.toLowerCase()) ||
          r.returnRequest.order.orderNumber
            .toLowerCase()
            .includes(search.toLowerCase())
      )
    : returns;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <RotateCcw className="h-6 w-6 text-orange-600" />
          المرتجعات
        </h1>
        <p className="mt-1 text-sm text-gray-500">{filtered.length} مرتجع</p>
      </div>

      <div className="mb-4 flex gap-2">
        {[
          { key: "PENDING", label: "بانتظار الاستلام" },
          { key: "PICKED_UP", label: "تم استلامها" },
          { key: "ALL", label: "الكل" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === f.key
                ? "bg-orange-600 text-white"
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
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-xs outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <RotateCcw className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا توجد مرتجعات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/r/${r.pickupRawToken || r.pickupTokenPreview}`}
              className="block rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-black">
                      {r.returnNumber}
                    </span>
                    <ReturnBadge status={r.status} />
                  </div>

                  <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                    <User className="h-3 w-3" />
                    {r.returnRequest.user.name}
                  </div>

                  <div className="mt-1 text-[11px] text-gray-500">
                    طلب:{" "}
                    <span className="font-mono">
                      {r.returnRequest.order.orderNumber}
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

function ReturnBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING_PICKUP: {
      label: "بانتظار الاستلام",
      cls: "bg-amber-100 text-amber-700",
    },
    PICKED_UP: { label: "تم الاستلام", cls: "bg-blue-100 text-blue-700" },
    IN_TRANSIT_TO_WAREHOUSE: {
      label: "في الطريق",
      cls: "bg-indigo-100 text-indigo-700",
    },
  };
  const info = map[status] || {
    label: status,
    cls: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${info.cls}`}
    >
      {info.label}
    </span>
  );
}