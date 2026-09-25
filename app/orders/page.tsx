"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  ChevronLeft,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

// ═══════ أنواع ═══════
type OrderItem = {
  id: number;
  productName: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: string;
  total: string;
};

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  total: string;
  createdAt: string;
  items: OrderItem[];
};

// ═══════ الحالات ═══════
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  NEW: {
    label: "قيد المراجعة",
    color: "text-blue-700",
    bg: "bg-blue-50",
    icon: Clock,
  },
  PROCESSING: {
    label: "قيد التجهيز",
    color: "text-amber-700",
    bg: "bg-amber-50",
    icon: Package,
  },
  SHIPPED: {
    label: "تم الشحن",
    color: "text-purple-700",
    bg: "bg-purple-50",
    icon: Truck,
  },
  DELIVERED: {
    label: "تم التوصيل",
    color: "text-green-700",
    bg: "bg-green-50",
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: "ملغى",
    color: "text-red-700",
    bg: "bg-red-50",
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadOrders() {
      try {
        setLoading(true);
        const res = await fetch("/api/orders");
        const data = await res.json();

        if (!res.ok || !data.success) {
          if (res.status === 401) {
            setError("يجب تسجيل الدخول لعرض طلباتك");
          } else {
            setError(data.message || "فشل تحميل الطلبات");
          }
          setLoading(false);
          return;
        }

        setOrders(data.orders);
      } catch (err) {
        console.error(err);
        setError("فشل الاتصال بالخادم");
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
      <TopBar />
      <Header
        search={search}
        onSearchChange={setSearch}
        cartCount={0}
        onCartClick={() => {}}
      />

      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-2xl font-black">طلباتي</h1>
          <Link
            href="/"
            className="text-xs font-bold text-[#ff5c00] hover:underline"
          >
            ← متابعة التسوق
          </Link>
        </div>

        {/* ═══════ التحميل ═══════ */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
            <p className="mt-3 text-sm text-[#6b7280]">جاري تحميل الطلبات...</p>
          </div>
        )}

        {/* ═══════ خطأ ═══════ */}
        {!loading && error && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">😕</div>
            <h2 className="mt-4 text-lg font-black">{error}</h2>
            {error.includes("تسجيل") && (
              <Link
                href="/login"
                className="mt-5 inline-block rounded-full bg-[#ff5c00] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00]"
              >
                تسجيل الدخول
              </Link>
            )}
          </div>
        )}

        {/* ═══════ لا توجد طلبات ═══════ */}
        {!loading && !error && orders.length === 0 && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="text-6xl">📦</div>
            <h2 className="mt-4 text-lg font-black">لا توجد طلبات بعد</h2>
            <p className="mt-2 text-sm text-[#6b7280]">
              ابدأ التسوق واكتشف منتجاتنا المميزة
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-full bg-[#ff5c00] px-8 py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00]"
            >
              تسوق الآن
            </Link>
          </div>
        )}

        {/* ═══════ قائمة الطلبات ═══════ */}
        {!loading && !error && orders.length > 0 && (
          <div className="space-y-3">
            {orders.map((order) => {
              const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.NEW;
              const Icon = config.icon;
              const itemCount = order.items.reduce(
                (sum, item) => sum + item.quantity,
                0
              );
              const totalItems = order.items.length;
              const firstItems = order.items.slice(0, 4);

              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  {/* رأس البطاقة */}
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-[#6b7280]">رقم الطلب</div>
                      <div className="mt-0.5 truncate font-mono text-sm font-black text-[#111827]">
                        {order.orderNumber}
                      </div>
                    </div>

                    <div
                      className={`flex items-center gap-1 rounded-full px-3 py-1 ${config.bg}`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                      <span className={`text-xs font-bold ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>

                  {/* الصور */}
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex -space-x-3 rtl:space-x-reverse">
                      {firstItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 border-white bg-gray-100"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-400">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                      ))}
                      {totalItems > 4 && (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-white bg-gray-100 text-xs font-black text-[#6b7280]">
                          +{totalItems - 4}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-[#6b7280]">
                        {itemCount} منتج
                      </div>
                      <div className="mt-0.5 text-xs text-[#6b7280]">
                        {new Date(order.createdAt).toLocaleDateString("ar-MA", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>

                  {/* الإجمالي */}
                  <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-[#6b7280]">الإجمالي:</span>
                      <span className="text-lg font-black text-[#ff5c00]">
                        {order.total} {CURRENCY}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-bold text-[#ff5c00]">
                      عرض التفاصيل
                      <ChevronLeft className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}