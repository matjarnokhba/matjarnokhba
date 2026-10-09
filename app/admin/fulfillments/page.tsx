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
  RefreshCw,
  Store,
  Search,
  Warehouse,
  ListChecks,
} from "lucide-react";

type Fulfillment = {
  id: number;
  status: string;
  quantity: number;
  deadline: string | null;
  preparedAt: string | null;
  readyAt: string | null;
  collectedAt: string | null;
  warehouseReceivedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  sellerId: number;
  sellerName: string;
  sellerCity: string | null;
  orderId: number;
  orderNumber: string;
  orderSource: string;
  orderStatus: string;
  orderCreatedAt: string;
  productName: string;
  variantName: string | null;
  sku: string;
  imageUrl: string | null;
  isOverdue: boolean;
};

type Stats = {
  pending: number;
  preparing: number;
  ready: number;
  inTransit: number;
  available: number;
  overdue: number;
  total: number;
};

type Seller = {
  id: number;
  storeName: string;
};

type Filter = "ACTIVE" | "IN_TRANSIT" | "COMPLETED" | "OVERDUE" | "ALL";

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
    icon: Warehouse,
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

export default function AdminFulfillmentsPage() {
  const [items, setItems] = useState<Fulfillment[]>([]);
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    preparing: 0,
    ready: 0,
    inTransit: 0,
    available: 0,
    overdue: 0,
    total: 0,
  });
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [sellerFilter, setSellerFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("filter", filter);
      if (sellerFilter) params.set("sellerId", sellerFilter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/admin/fulfillments?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }

      setItems(data.fulfillments);
      setStats(data.stats);
      setSellers(data.sellers);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sellerFilter, search]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
            <ListChecks className="h-6 w-6 text-[#ff5c00]" />
            متابعة التجهيز
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            متابعة عمليات التجهيز لكل التاجر
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

      {/* Filters */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["ACTIVE", "النشطة"],
              ["IN_TRANSIT", "قيد النقل"],
              ["COMPLETED", "المكتملة"],
              ["OVERDUE", "متأخرة"],
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

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم الطلب أو المنتج..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00]"
            />
          </div>

          <select
            value={sellerFilter}
            onChange={(e) => setSellerFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-[#ff5c00]"
          >
            <option value="">كل التجار</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.storeName}
              </option>
            ))}
          </select>
        </div>
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
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <Package className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="mt-5 text-lg font-black">لا يوجد عناصر</h3>
          <p className="mt-2 text-sm text-gray-500">
            لا توجد عمليات تجهيز بهذه الحالة
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const info = STATUS_INFO[item.status] || STATUS_INFO.PENDING;
            const Icon = info.icon;
            const isOnline = item.orderSource === "ONLINE";

            return (
              <div
                key={item.id}
                className={`rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md ${
                  item.isOverdue ? "ring-2 ring-red-300" : ""
                }`}
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
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${info.cls}`}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {info.label}
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
                      <Link
                        href={`/admin/sellers/${item.sellerId}`}
                        className="flex items-center gap-1 font-bold text-[#ff5c00] hover:underline"
                      >
                        <Store className="h-3 w-3" />
                        {item.sellerName}
                      </Link>
                      <span>·</span>
                      <Link
                        href={`/admin/orders/${item.orderId}`}
                        className="font-mono hover:underline"
                      >
                        {item.orderNumber}
                      </Link>
                      <span>·</span>
                      <span>
                        الكمية: <strong>{item.quantity}</strong>
                      </span>
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px]">
                        {isOnline ? "🌐" : "🏪"}
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
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                  </div>
                </div>
              </div>
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