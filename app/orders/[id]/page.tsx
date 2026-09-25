"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Package,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  MapPin,
  Phone,
  User,
  Home,
  ShoppingBag,
} from "lucide-react";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

// ═══════ الأنواع ═══════
type OrderItem = {
  id: number;
  productName: string;
  variantName: string | null;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: string;
  total: string;
};

type AddressSnapshot = {
  fullName: string;
  phone: string;
  city: string;
  street: string;
  postalCode?: string;
};

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: string;
  shippingCost: string;
  discount: string;
  total: string;
  createdAt: string;
  shippingAddressSnapshot: AddressSnapshot;
  items: OrderItem[];
  statusHistory: {
    id: number;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    createdAt: string;
  }[];
};

// ═══════ الحالات ═══════
const STATUS_FLOW = [
  { key: "NEW", label: "قيد المراجعة", icon: Clock },
  { key: "PROCESSING", label: "قيد التجهيز", icon: Package },
  { key: "SHIPPED", label: "تم الشحن", icon: Truck },
  { key: "DELIVERED", label: "تم التوصيل", icon: CheckCircle2 },
];

const STATUS_INFO: Record<
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

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadOrder() {
      try {
        setLoading(true);
        const res = await fetch(`/api/orders/${orderId}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.message || "الطلب غير موجود");
          setLoading(false);
          return;
        }

        setOrder(data.order);
      } catch (err) {
        console.error(err);
        setError("فشل الاتصال بالخادم");
      } finally {
        setLoading(false);
      }
    }

    if (orderId) loadOrder();
  }, [orderId]);

  // ═══════ حالة التحميل ═══════
  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
        <TopBar />
        <Header
          search={search}
          onSearchChange={setSearch}
          cartCount={0}
          onCartClick={() => {}}
        />
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
          <p className="mt-4 text-sm text-[#6b7280]">جاري تحميل الطلب...</p>
        </div>
        <Footer />
      </main>
    );
  }

  // ═══════ خطأ ═══════
  if (error || !order) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
        <TopBar />
        <Header
          search={search}
          onSearchChange={setSearch}
          cartCount={0}
          onCartClick={() => {}}
        />
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
          <div className="text-6xl">😕</div>
          <h1 className="mt-4 text-2xl font-black">{error || "الطلب غير موجود"}</h1>
          <Link
            href="/orders"
            className="mt-6 rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
          >
            عودة إلى طلباتي
          </Link>
        </div>
        <Footer />
      </main>
    );
  }

  const statusInfo = STATUS_INFO[order.status] || STATUS_INFO.NEW;
  const StatusIcon = statusInfo.icon;

  // هل الطلب في مسار التتبع الطبيعي (لا ملغى/مرتجع)؟
  const isTrackingActive = ["NEW", "PROCESSING", "SHIPPED", "DELIVERED"].includes(
    order.status
  );

  // الفهرس الحالي في مسار التتبع
  const currentStepIndex = STATUS_FLOW.findIndex((s) => s.key === order.status);

  const address = order.shippingAddressSnapshot;

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
      <TopBar />
      <Header
        search={search}
        onSearchChange={setSearch}
        cartCount={0}
        onCartClick={() => {}}
      />

      {/* Breadcrumb */}
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2 text-xs text-[#6b7280]">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 font-bold text-[#ff5c00] hover:underline"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            رجوع
          </button>
          <span>/</span>
          <Link href="/orders" className="hover:text-[#ff5c00]">
            طلباتي
          </Link>
          <span>/</span>
          <span className="font-mono">{order.orderNumber}</span>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* ═══════ رأس الصفحة ═══════ */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs text-[#6b7280]">رقم الطلب</div>
              <div className="mt-1 font-mono text-xl font-black text-[#111827]">
                {order.orderNumber}
              </div>
              <div className="mt-1 text-xs text-[#6b7280]">
                {new Date(order.createdAt).toLocaleDateString("ar-MA", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>

            <div
              className={`flex items-center gap-2 self-start rounded-full px-4 py-2 ${statusInfo.bg}`}
            >
              <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
              <span className={`text-sm font-bold ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
          </div>
        </div>

        {/* ═══════ شريط التتبع ═══════ */}
        {isTrackingActive && (
          <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-5 text-base font-black">حالة الطلب</h2>

            <div className="relative">
              {/* خط أفقي */}
              <div className="absolute left-0 right-0 top-5 h-1 bg-gray-100" />
              <div
                className="absolute right-0 top-5 h-1 bg-[#ff5c00] transition-all"
                style={{
                  width: `${(currentStepIndex / (STATUS_FLOW.length - 1)) * 100}%`,
                  right: 0,
                  left: "auto",
                  transform: "scaleX(1)",
                }}
              />

              {/* النقاط */}
              <div className="relative flex justify-between">
                {STATUS_FLOW.map((step, idx) => {
                  const StepIcon = step.icon;
                  const isDone = idx <= currentStepIndex;
                  const isCurrent = idx === currentStepIndex;

                  return (
                    <div key={step.key} className="flex flex-1 flex-col items-center">
                      <div
                        className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${
                          isDone
                            ? "border-[#ff5c00] bg-[#ff5c00] text-white"
                            : "border-gray-200 bg-white text-gray-400"
                        } ${isCurrent ? "ring-4 ring-[#ff5c00]/20" : ""}`}
                      >
                        <StepIcon className="h-5 w-5" />
                      </div>
                      <span
                        className={`mt-2 text-center text-[10px] font-bold sm:text-xs ${
                          isDone ? "text-[#111827]" : "text-gray-400"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ المنتجات ═══════ */}
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-black">
            <ShoppingBag className="h-4 w-4 text-[#ff5c00]" />
            المنتجات ({order.items.length})
          </h2>

          <div className="space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                      <Package className="h-6 w-6" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-bold">
                    {item.productName}
                  </div>
                  {item.variantName && (
                    <div className="mt-0.5 text-xs text-[#6b7280]">
                      {item.variantName}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-[#6b7280]">
                    الكمية: {item.quantity}
                  </div>
                </div>

                <div className="shrink-0 text-left">
                  <div className="text-sm font-black text-[#ff5c00]">
                    {item.total} {CURRENCY}
                  </div>
                  {item.quantity > 1 && (
                    <div className="text-[10px] text-[#6b7280]">
                      {item.unitPrice} × {item.quantity}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════ العنوان ═══════ */}
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-black">
            <MapPin className="h-4 w-4 text-[#ff5c00]" />
            عنوان الشحن
          </h2>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-[#6b7280]" />
              <span className="font-bold">{address.fullName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-[#6b7280]" />
              <span dir="ltr">{address.phone}</span>
            </div>
            <div className="flex items-start gap-2">
              <Home className="mt-0.5 h-4 w-4 shrink-0 text-[#6b7280]" />
              <span>
                {address.street}، {address.city}
                {address.postalCode && ` - ${address.postalCode}`}
              </span>
            </div>
          </div>
        </div>

        {/* ═══════ ملخص الأسعار ═══════ */}
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-black">ملخص الطلب</h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#6b7280]">المجموع الفرعي</span>
              <span className="font-bold">
                {order.subtotal} {CURRENCY}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6b7280]">الشحن</span>
              <span
                className={
                  Number(order.shippingCost) === 0
                    ? "font-bold text-green-600"
                    : "font-bold"
                }
              >
                {Number(order.shippingCost) === 0
                  ? "مجاني"
                  : `${order.shippingCost} ${CURRENCY}`}
              </span>
            </div>
            {Number(order.discount) > 0 && (
              <div className="flex justify-between">
                <span className="text-[#6b7280]">الخصم</span>
                <span className="font-bold text-green-600">
                  -{order.discount} {CURRENCY}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-dashed border-gray-200 pt-3">
              <span className="font-bold">الإجمالي</span>
              <span className="text-xl font-black text-[#ff5c00]">
                {order.total} {CURRENCY}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-[#fff4ed] px-3 py-2 text-xs text-[#6b7280]">
            💵 الدفع عند الاستلام — ادفع نقداً أو بالبطاقة عند وصول طلبك
          </div>
        </div>

        {/* ═══════ سجل الحالة ═══════ */}
        {order.statusHistory.length > 0 && (
          <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-black">سجل الطلب</h2>

            <div className="space-y-3">
              {order.statusHistory.map((h, idx) => {
                const info = STATUS_INFO[h.toStatus] || STATUS_INFO.NEW;
                const Icon = info.icon;

                return (
                  <div key={h.id} className="flex gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${info.bg}`}
                    >
                      <Icon className={`h-4 w-4 ${info.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">{info.label}</div>
                      {h.note && (
                        <div className="mt-0.5 text-xs text-[#6b7280]">
                          {h.note}
                        </div>
                      )}
                      <div className="mt-0.5 text-[10px] text-[#9ca3af]">
                        {new Date(h.createdAt).toLocaleDateString("ar-MA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* زر العودة */}
        <div className="mt-6">
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-[#111827] transition hover:bg-gray-50"
          >
            <ArrowRight className="h-4 w-4" />
            عودة إلى طلباتي
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  );
}