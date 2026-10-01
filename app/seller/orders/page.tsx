"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ShoppingCart,
  Search,
  ChevronLeft,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  itemsCount: number;
  customerName: string;
  customerPhone: string | null;
  customerCity: string | null;
  items: {
    productName: string;
    imageUrl: string | null;
    quantity: number;
  }[];
};

type Stats = {
  NEW: number;
  PROCESSING: number;
  SHIPPED: number;
  DELIVERED: number;
  CANCELLED: number;
  RETURNED: number;
  total: number;
};

const STATUS_INFO: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  NEW: {
    label: "جديد",
    color: "text-blue-700",
    bg: "bg-blue-100",
    icon: Clock,
  },
  PROCESSING: {
    label: "قيد التجهيز",
    color: "text-amber-700",
    bg: "bg-amber-100",
    icon: Package,
  },
  SHIPPED: {
    label: "تم الشحن",
    color: "text-purple-700",
    bg: "bg-purple-100",
    icon: Truck,
  },
  DELIVERED: {
    label: "تم التوصيل",
    color: "text-green-700",
    bg: "bg-green-100",
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: "ملغى",
    color: "text-red-700",
    bg: "bg-red-100",
    icon: XCircle,
  },
  RETURNED: {
    label: "مُرتجع",
    color: "text-gray-700",
    bg: "bg-gray-100",
    icon: RotateCcw,
  },
};

const CURRENCY = "د.م";

type Filter = "ALL" | "NEW" | "PROCESSING" | "SHIPPED" | "DELIVERED";

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({
    NEW: 0,
    PROCESSING: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    CANCELLED: 0,
    RETURNED: 0,
    total: 0,
  });
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("status", filter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/seller/orders?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
        setStats(data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== "") loadData();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">طلباتي</h1>
        <p className="mt-1 text-sm text-gray-500">
          {loading ? "جاري التحميل..." : `${stats.total} طلب`}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          onClick={() => setFilter("NEW")}
          className={`rounded-xl border p-4 text-right shadow-sm transition ${
            filter === "NEW"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-100 bg-white hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <Clock className="h-5 w-5 text-blue-600" />
            <span className="text-xl font-black text-blue-700">
              {stats.NEW}
            </span>
          </div>
          <div className="mt-1 text-xs font-bold text-gray-600">
            طلبات جديدة
          </div>
        </button>

        <button
          onClick={() => setFilter("PROCESSING")}
          className={`rounded-xl border p-4 text-right shadow-sm transition ${
            filter === "PROCESSING"
              ? "border-amber-500 bg-amber-50"
              : "border-gray-100 bg-white hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <Package className="h-5 w-5 text-amber-600" />
            <span className="text-xl font-black text-amber-700">
              {stats.PROCESSING}
            </span>
          </div>
          <div className="mt-1 text-xs font-bold text-gray-600">
            قيد التجهيز
          </div>
        </button>

        <button
          onClick={() => setFilter("SHIPPED")}
          className={`rounded-xl border p-4 text-right shadow-sm transition ${
            filter === "SHIPPED"
              ? "border-purple-500 bg-purple-50"
              : "border-gray-100 bg-white hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <Truck className="h-5 w-5 text-purple-600" />
            <span className="text-xl font-black text-purple-700">
              {stats.SHIPPED}
            </span>
          </div>
          <div className="mt-1 text-xs font-bold text-gray-600">تم الشحن</div>
        </button>

        <button
          onClick={() => setFilter("DELIVERED")}
          className={`rounded-xl border p-4 text-right shadow-sm transition ${
            filter === "DELIVERED"
              ? "border-green-500 bg-green-50"
              : "border-gray-100 bg-white hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="text-xl font-black text-green-700">
              {stats.DELIVERED}
            </span>
          </div>
          <div className="mt-1 text-xs font-bold text-gray-600">
            تم التوصيل
          </div>
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
            placeholder="ابحث برقم الطلب..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00]"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["ALL", "الكل"],
            ["NEW", "جديدة"],
            ["PROCESSING", "قيد التجهيز"],
            ["SHIPPED", "تم الشحن"],
            ["DELIVERED", "تم التوصيل"],
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

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <ShoppingCart className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="mt-5 text-lg font-black">لا توجد طلبات</h3>
          <p className="mt-2 text-sm text-gray-500">
            {filter === "ALL"
              ? "لم يصل أي طلب بعد"
              : "لا توجد طلبات بهذه الحالة"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const info = STATUS_INFO[order.status] || STATUS_INFO.NEW;
            const Icon = info.icon;

            return (
              <Link
                key={order.id}
                href={`/seller/orders/${order.id}`}
                className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-4">
                  {/* صور المنتجات */}
                  <div className="flex -space-x-3 rtl:space-x-reverse">
                    {order.items.slice(0, 3).map((item, i) => (
                      <div
                        key={i}
                        className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 border-white bg-gray-100"
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-300">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                    ))}
                    {order.itemsCount > 3 && (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-white bg-gray-100 text-xs font-bold text-gray-500">
                        +{order.itemsCount - 3}
                      </div>
                    )}
                  </div>

                  {/* المعلومات */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black text-gray-900">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${info.bg} ${info.color}`}
                      >
                        <Icon className="h-3 w-3" />
                        {info.label}
                      </span>
                    </div>

                    <div className="mt-1 text-[11px] text-gray-500">
                      {order.customerName}
                      {order.customerCity && ` · ${order.customerCity}`}
                    </div>

                    <div className="mt-0.5 text-[10px] text-gray-400">
                      {new Date(order.createdAt).toLocaleDateString("ar-MA", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {order.itemsCount} منتج
                    </div>
                  </div>

                  {/* السعر + السهم */}
                  <div className="flex items-center gap-2">
                    <div className="text-left">
                      <div className="text-lg font-black text-[#ff5c00]">
                        {order.total.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {CURRENCY}
                      </div>
                    </div>
                    <ChevronLeft className="h-5 w-5 text-gray-300" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}