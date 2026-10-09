"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Warehouse,
  Truck,
  CheckCircle2,
  Package,
  XCircle,
  AlertTriangle,
  Store,
  RefreshCw,
  ChevronLeft,
} from "lucide-react";

type Item = {
  id: number;
  status: string;
  quantity: number;
  sellerId: number;
  sellerName: string;
  sellerCity: string | null;
  orderId: number;
  orderNumber: string;
  customerId: number;
  productName: string;
  variantName: string | null;
  sku: string;
  imageUrl: string | null;
  departedAt: string | null;
  warehouseReceivedAt: string | null;
  verifiedAt: string | null;
  latestReceipt: {
    id: number;
    receiptNumber: string;
    status: string;
    quantity: number;
    damagedQuantity: number;
  } | null;
};

type Stats = {
  inTransit: number;
  received: number;
  verified: number;
  available: number;
};

type Tab = "INCOMING" | "DAMAGED";

const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  IN_TRANSIT_TO_WAREHOUSE: {
    label: "في الطريق",
    cls: "bg-indigo-100 text-indigo-700",
  },
  RECEIVED: { label: "مستلم", cls: "bg-cyan-100 text-cyan-700" },
  VERIFIED: { label: "متحقق", cls: "bg-teal-100 text-teal-700" },
  AVAILABLE_FOR_SHIPMENT: {
    label: "متاح للشحن",
    cls: "bg-green-100 text-green-700",
  },
  RETURNED: { label: "مُرجع", cls: "bg-red-100 text-red-700" },
};

export default function AdminWarehousePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats>({
    inTransit: 0,
    received: 0,
    verified: 0,
    available: 0,
  });
  const [tab, setTab] = useState<Tab>("INCOMING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/warehouse/incoming?tab=${tab}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }

      setItems(data.items);
      setStats(data.stats);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
            <Warehouse className="h-6 w-6 text-[#ff5c00]" />
            المستودع
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            استلام المنتجات من السائقين والتحقق منها
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          تحديث
        </button>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="في الطريق"
          value={stats.inTransit}
          color="indigo"
          icon={<Truck className="h-5 w-5" />}
        />
        <StatCard
          label="مستلم"
          value={stats.received}
          color="cyan"
          icon={<Package className="h-5 w-5" />}
        />
        <StatCard
          label="متحقق"
          value={stats.verified}
          color="teal"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="متاح للشحن"
          value={stats.available}
          color="green"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        <button
          onClick={() => setTab("INCOMING")}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
            tab === "INCOMING"
              ? "bg-[#ff5c00] text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          الوارد للمستودع
        </button>
        <button
          onClick={() => setTab("DAMAGED")}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
            tab === "DAMAGED"
              ? "bg-red-500 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          المرتجعات
        </button>
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
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Warehouse className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-black">لا يوجد عناصر</h3>
          <p className="mt-2 text-sm text-gray-500">
            {tab === "INCOMING"
              ? "لا يوجد شحنات واردة حالياً"
              : "لا يوجد مرتجعات"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const info = STATUS_INFO[item.status] || STATUS_INFO.RECEIVED;

            return (
              <Link
                key={item.id}
                href={`/admin/warehouse/${item.id}`}
                className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-4">
                  {/* Image */}
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <Package className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="line-clamp-1 text-sm font-black text-gray-900">
                        {item.productName}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${info.cls}`}
                      >
                        {info.label}
                      </span>
                    </div>

                    {item.variantName && (
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        {item.variantName}
                      </div>
                    )}

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Store className="h-3 w-3" />
                        {item.sellerName}
                      </span>
                      <span>·</span>
                      <span className="font-mono">{item.orderNumber}</span>
                      <span>·</span>
                      <span>
                        الكمية: <strong>{item.quantity}</strong>
                      </span>
                    </div>

                    {item.latestReceipt && (
                      <div className="mt-1 text-[10px] text-gray-400">
                        إيصال: {item.latestReceipt.receiptNumber}
                        {item.latestReceipt.damagedQuantity > 0 && (
                          <span className="ml-2 text-orange-600">
                            تالف: {item.latestReceipt.damagedQuantity}
                          </span>
                        )}
                      </div>
                    )}
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

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: "indigo" | "cyan" | "teal" | "green";
  icon: React.ReactNode;
}) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    cyan: "bg-cyan-50 text-cyan-600",
    teal: "bg-teal-50 text-teal-600",
    green: "bg-green-50 text-green-600",
  };
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${colors[color]}`}
      >
        {icon}
      </div>
      <div className="mt-2 text-2xl font-black text-gray-900">{value}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}