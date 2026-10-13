"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Package,
  MapPin,
  User,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  ChevronLeft,
  Send,
} from "lucide-react";

const CURRENCY = "د.م";

type AssemblyItem = {
  id: number;
  expectedQuantity: number;
  receivedAt: string | null;
  includedInShipment: boolean;
  fulfillmentItem: {
    id: number;
    status: string;
    quantity: number;
    sellerId: number;
    orderItem: {
      id: number;
      productName: string;
      variantName: string | null;
      imageUrl: string | null;
      quantity: number;
      sellerId: number | null;
    };
  };
};

type Assembly = {
  id: number;
  assemblyCode: string;
  orderId: number;
  status: string;
  expectedItems: number;
  receivedItems: number;
  shippedItems: number;
  deliveryCity: string | null;
  deliveryDistrict: string | null;
  createdAt: string;
  order: {
    id: number;
    orderNumber: string;
    customerSnapshot: any;
    shippingAddressSnapshot: any;
    total: number;
  };
  user: { id: number; name: string; phone: string | null; email: string };
  items: AssemblyItem[];
};

export default function WarehouseAssemblyPage() {
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    "ACTIVE" | "COMPLETED" | "READY" | "PENDING"
  >("ACTIVE");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      if (cityFilter !== "ALL") params.set("city", cityFilter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/warehouse/assembly?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAssemblies(data.assemblies || []);
        setCities(data.cities || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, cityFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== "") load();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const stats = useMemo(() => {
    return {
      ready: assemblies.filter((a) => a.status === "READY").length,
      pending: assemblies.filter((a) => a.status === "PENDING").length,
      partial: assemblies.filter((a) => a.status === "PARTIALLY_SHIPPED")
        .length,
    };
  }, [assemblies]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Package className="h-6 w-6 text-teal-600" />
          تجميع الطلبات
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {stats.ready} جاهز · {stats.pending} بانتظار · {stats.partial} جزئي
        </p>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: "ACTIVE", label: "الكل النشط" },
          { key: "READY", label: "✅ جاهز للشحن" },
          { key: "PENDING", label: "⏳ بانتظار" },
          { key: "COMPLETED", label: "📦 مكتمل" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key as any)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              statusFilter === f.key
                ? "bg-teal-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث برقم Assembly أو الطلب أو اسم العميل..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-xs outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Cities */}
      {cities.length > 0 && (
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
          {cities.map((c) => (
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
      ) : assemblies.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            لا توجد ملفات تجميع
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assemblies.map((a) => {
            const progress = a.expectedItems
              ? Math.round((a.receivedItems / a.expectedItems) * 100)
              : 0;
            const isReady = a.status === "READY";

            return (
              <Link
                key={a.id}
                href={`/warehouse/assembly/${a.id}`}
                className={`block rounded-2xl border-2 bg-white p-4 shadow-sm transition hover:shadow-md ${
                  isReady
                    ? "border-green-300 bg-green-50/30"
                    : "border-gray-100"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-gray-500">
                        {a.assemblyCode}
                      </span>
                      <StatusBadge status={a.status} />
                    </div>

                    <div className="mt-1 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-sm font-bold">
                        {a.user.name}
                      </span>
                      {a.user.phone && (
                        <span
                          className="text-[11px] text-gray-500"
                          dir="ltr"
                        >
                          · {a.user.phone}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-[11px] text-gray-500">
                      طلب:{" "}
                      <span className="font-mono">{a.order.orderNumber}</span>
                    </div>

                    {a.deliveryCity && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
                        <MapPin className="h-3 w-3" />
                        {a.deliveryCity}
                        {a.deliveryDistrict && ` — ${a.deliveryDistrict}`}
                      </div>
                    )}

                    {/* Progress */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span>
                          {a.receivedItems} / {a.expectedItems} منتج
                        </span>
                        <span>{progress}%</span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full transition-all ${
                            isReady ? "bg-green-500" : "bg-teal-500"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Missing items */}
                    {!isReady && a.expectedItems > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-amber-700">
                        <Clock className="h-3 w-3" />
                        بانتظار {a.expectedItems - a.receivedItems} منتج
                      </div>
                    )}
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: "⏳ بانتظار", cls: "bg-amber-100 text-amber-700" },
    READY: { label: "✅ جاهز", cls: "bg-green-100 text-green-700" },
    PARTIALLY_SHIPPED: {
      label: "🔀 جزئي",
      cls: "bg-orange-100 text-orange-700",
    },
    COMPLETED: { label: "📦 مكتمل", cls: "bg-blue-100 text-blue-700" },
    CANCELLED: { label: "❌ ملغى", cls: "bg-red-100 text-red-700" },
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