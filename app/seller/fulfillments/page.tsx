"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Truck,
  ChevronLeft,
  RefreshCw,
} from "lucide-react";

type Fulfillment = {
  id: number;
  orderId: number;
  orderNumber: string;
  orderSource: string;
  orderStatus: string;
  orderCreatedAt: string;
  productName: string;
  variantName: string | null;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  status: string;
  deadline: string | null;
  preparedAt: string | null;
  readyAt: string | null;
  collectedAt: string | null;
  warehouseReceivedAt: string | null;
  createdAt: string;
  isOverdue: boolean;
};

type Stats = {
  pending: number;
  preparing: number;
  ready: number;
  overdue: number;
  total: number;
};

type Filter = "ACTIVE" | "IN_PROGRESS" | "COMPLETED" | "ALL";

const STATUS_INFO: Record<
  string,
  { label: string; cls: string; icon: any }
> = {
  PENDING: {
    label: "بانتظار التجهيز",
    cls: "bg-blue-100 text-blue-700",
    icon: Clock,
  },
  PREPARING: {
    label: "قيد التجهيز",
    cls: "bg-amber-100 text-amber-700",
    icon: Package,
  },
  READY_FOR_COLLECTION: {
    label: "جاهز للجمع",
    cls: "bg-purple-100 text-purple-700",
    icon: CheckCircle2,
  },
  COLLECTED: {
    label: "تم الجمع",
    cls: "bg-indigo-100 text-indigo-700",
    icon: Truck,
  },
  IN_TRANSIT_TO_WAREHOUSE: {
    label: "في الطريق للمستودع",
    cls: "bg-indigo-100 text-indigo-700",
    icon: Truck,
  },
  RECEIVED: {
    label: "في المستودع",
    cls: "bg-cyan-100 text-cyan-700",
    icon: Package,
  },
  VERIFIED: {
    label: "تم التحقق",
    cls: "bg-teal-100 text-teal-700",
    icon: CheckCircle2,
  },
  AVAILABLE_FOR_SHIPMENT: {
    label: "متاح للشحن",
    cls: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
  ALLOCATED: {
    label: "في شحنة",
    cls: "bg-green-100 text-green-700",
    icon: Truck,
  },
  SHIPPED: {
    label: "تم الشحن",
    cls: "bg-green-100 text-green-700",
    icon: Truck,
  },
  DELIVERED: {
    label: "تم التسليم",
    cls: "bg-green-200 text-green-800",
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: "ملغى",
    cls: "bg-gray-100 text-gray-600",
    icon: AlertTriangle,
  },
  RETURNED: {
    label: "مُرجع",
    cls: "bg-red-100 text-red-700",
    icon: AlertTriangle,
  },
};

export default function SellerFulfillmentsPage() {
  const [items, setItems] = useState<Fulfillment[]>([]);
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    preparing: 0,
    ready: 0,
    overdue: 0,
    total: 0,
  });
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/seller/fulfillments?status=${filter}`
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }

      setItems(data.fulfillments);
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
  }, [filter]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
            <Package className="h-6 w-6 text-[#ff5c00]" />
            تجهيزاتي
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            جهّز المنتجات وأعلن جاهزيتها للجمع
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

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="بانتظار التجهيز"
          value={stats.pending}
          color="blue"
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          label="قيد التجهيز"
          value={stats.preparing}
          color="amber"
          icon={<Package className="h-5 w-5" />}
        />
        <StatCard
          label="جاهز للجمع"
          value={stats.ready}
          color="purple"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="متأخر"
          value={stats.overdue}
          color="red"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ["ACTIVE", "النشطة"],
            ["IN_PROGRESS", "قيد المعالجة"],
            ["COMPLETED", "المكتملة"],
            ["ALL", "الكل"],
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
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <Package className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="mt-5 text-lg font-black">لا يوجد عناصر</h3>
          <p className="mt-2 text-sm text-gray-500">
            {filter === "ACTIVE"
              ? "لا توجد عناصر بانتظار التجهيز"
              : "لا توجد عناصر بهذه الحالة"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const info = STATUS_INFO[item.status] || STATUS_INFO.PENDING;
            const Icon = info.icon;

            return (
              <Link
                key={item.id}
                href={`/seller/fulfillments/${item.id}`}
                className={`block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md ${
                  item.isOverdue ? "ring-2 ring-red-300" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-4">
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

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="line-clamp-1 text-sm font-black text-gray-900">
                        {item.productName}
                      </span>
                      {item.isOverdue && (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          متأخر
                        </span>
                      )}
                    </div>
                    {item.variantName && (
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        {item.variantName}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                      <span className="font-mono">
                        {item.orderNumber}
                      </span>
                      <span>·</span>
                      <span>
                        الكمية: <strong>{item.quantity}</strong>
                      </span>
                    </div>

                    {item.deadline &&
                      ["PENDING", "PREPARING"].includes(item.status) && (
                        <div
                          className={`mt-1 flex items-center gap-1 text-[10px] ${
                            item.isOverdue
                              ? "text-red-600 font-bold"
                              : "text-gray-500"
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          المهلة:{" "}
                          {new Date(item.deadline).toLocaleString("ar-MA", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                  </div>

                  <div className="shrink-0">
                    <span
                      className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-bold ${info.cls}`}
                    >
                      <Icon className="h-3 w-3" />
                      {info.label}
                    </span>
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
  color: "blue" | "amber" | "purple" | "red";
  icon: React.ReactNode;
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
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