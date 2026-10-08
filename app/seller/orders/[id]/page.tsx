"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Package,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  MapPin,
  Phone,
  User,
  Home,
  ShoppingBag,
  AlertTriangle,
  DollarSign,
  Printer,
} from "lucide-react";

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
  sellerPayout: string | null;
  createdAt: string;
  deliveredAt: string | null;
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

const STATUS_FLOW = [
  { key: "NEW", label: "جديد", icon: Clock },
  { key: "PROCESSING", label: "قيد التجهيز", icon: Package },
  { key: "SHIPPED", label: "تم الشحن", icon: Truck },
  { key: "DELIVERED", label: "تم التوصيل", icon: CheckCircle2 },
];

const STATUS_INFO: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  NEW: {
    label: "جديد",
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

// ═══ التغييرات المسموحة للتاجر ═══
const NEXT_ACTIONS: Record<
  string,
  { next: string; label: string; color: string; icon: any } | null
> = {
  NEW: {
    next: "PROCESSING",
    label: "قبول وبدء التجهيز",
    color: "bg-blue-600 hover:bg-blue-700",
    icon: Package,
  },
  PROCESSING: {
    next: "SHIPPED",
    label: "تم الشحن",
    color: "bg-purple-600 hover:bg-purple-700",
    icon: Truck,
  },
  SHIPPED: {
    next: "DELIVERED",
    label: "تم التوصيل للعميل",
    color: "bg-green-600 hover:bg-green-700",
    icon: CheckCircle2,
  },
  DELIVERED: null,
  CANCELLED: null,
  RETURNED: null,
};

const CURRENCY = "د.م";

export default function SellerOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function loadOrder() {
    try {
      setLoading(true);
      const res = await fetch(`/api/seller/orders/${orderId}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "الطلب غير موجود");
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

  useEffect(() => {
    if (orderId) loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleChangeStatus(nextStatus: string) {
    setChanging(true);
    try {
      const res = await fetch(`/api/seller/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "فشل التحديث");
        return;
      }

      setShowConfirm(false);
      await loadOrder();
    } catch {
      alert("فشل الاتصال");
    } finally {
      setChanging(false);
    }
  }

  // ═══ التحميل ═══
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  // ═══ خطأ ═══
  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h1 className="mt-4 text-xl font-black">{error}</h1>
        <Link
          href="/seller/orders"
          className="mt-6 rounded-full bg-[#ff5c00] px-6 py-2.5 text-sm font-bold text-white"
        >
          عودة إلى طلباتي
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_INFO[order.status] || STATUS_INFO.NEW;
  const StatusIcon = statusInfo.icon;
  const isTrackingActive = ["NEW", "PROCESSING", "SHIPPED", "DELIVERED"].includes(
    order.status
  );
  const currentStepIndex = STATUS_FLOW.findIndex((s) => s.key === order.status);
  const address = order.shippingAddressSnapshot;
  const nextAction = NEXT_ACTIONS[order.status];

  const sellerPayout = order.sellerPayout
    ? Number(order.sellerPayout)
    : Number(order.total);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/seller/orders"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع إلى طلباتي
      </Link>

      {/* ═══ رأس ═══ */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs text-gray-500">رقم الطلب</div>
            <div className="mt-1 font-mono text-xl font-black text-gray-900">
              {order.orderNumber}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {new Date(order.createdAt).toLocaleDateString("ar-MA", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start">
            <Link
              href={`/seller/orders/${orderId}/invoice`}
              className="flex items-center gap-1.5 rounded-full border border-[#ff5c00] bg-white px-3 py-2 text-xs font-bold text-[#ff5c00] transition hover:bg-[#fff4ed]"
            >
              <Printer className="h-3.5 w-3.5" />
              الفاتورة
            </Link>
            <Link
              href={`/seller/orders/${orderId}/label`}
              className="flex items-center gap-1.5 rounded-full border border-[#0a1f44] bg-white px-3 py-2 text-xs font-bold text-[#0a1f44] transition hover:bg-[#0a1f44]/5"
            >
              <Printer className="h-3.5 w-3.5" />
              ملصق الشحن
            </Link>
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-2 ${statusInfo.bg}`}
            >
              <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
              <span className={`text-sm font-bold ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ شريط التتبع ═══ */}
      {isTrackingActive && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-5 text-base font-black">حالة الطلب</h2>

          <div className="relative">
            <div className="absolute left-0 right-0 top-5 h-1 bg-gray-100" />
            <div
              className="absolute right-0 top-5 h-1 bg-[#ff5c00] transition-all"
              style={{
                width: `${(currentStepIndex / (STATUS_FLOW.length - 1)) * 100}%`,
              }}
            />

            <div className="relative flex justify-between">
              {STATUS_FLOW.map((step, idx) => {
                const StepIcon = step.icon;
                const isDone = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div
                    key={step.key}
                    className="flex flex-1 flex-col items-center"
                  >
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
                        isDone ? "text-gray-900" : "text-gray-400"
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

      {/* ═══ زر الإجراء ═══ */}
      {nextAction && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={changing}
            className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white shadow-md transition disabled:opacity-50 ${nextAction.color}`}
          >
            <nextAction.icon className="h-4 w-4" />
            {nextAction.label}
          </button>
        </div>
      )}

      {/* ═══ أرباحك ═══ */}
      {order.status === "DELIVERED" && (
        <div className="mt-4 rounded-2xl bg-gradient-to-l from-green-500 to-emerald-500 p-5 text-white shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs opacity-90">أرباحك من هذا الطلب</div>
                <div className="text-2xl font-black">
                  {sellerPayout.toFixed(2)} {CURRENCY}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ المنتجات ═══ */}
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
                  <div className="mt-0.5 text-xs text-gray-500">
                    {item.variantName}
                  </div>
                )}
                <div className="mt-1 text-xs text-gray-500">
                  الكمية: {item.quantity}
                </div>
              </div>

              <div className="shrink-0 text-left">
                <div className="text-sm font-black text-[#ff5c00]">
                  {item.total} {CURRENCY}
                </div>
                {item.quantity > 1 && (
                  <div className="text-[10px] text-gray-500">
                    {item.unitPrice} × {item.quantity}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ العنوان ═══ */}
      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-black">
          <MapPin className="h-4 w-4 text-[#ff5c00]" />
          عنوان الشحن
        </h2>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            <span className="font-bold">{address.fullName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-gray-400" />
            <span dir="ltr">{address.phone}</span>
          </div>
          <div className="flex items-start gap-2">
            <Home className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <span>
              {address.street}، {address.city}
              {address.postalCode && ` - ${address.postalCode}`}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ ملخص ═══ */}
      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-black">ملخص الطلب</h2>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">المجموع الفرعي</span>
            <span className="font-bold">
              {order.subtotal} {CURRENCY}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">الشحن</span>
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
              <span className="text-gray-500">الخصم</span>
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
      </div>

      {/* ═══ سجل الحالة ═══ */}
      {order.statusHistory.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-black">سجل الطلب</h2>

          <div className="space-y-3">
            {order.statusHistory.map((h) => {
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
                      <div className="mt-0.5 text-xs text-gray-500">
                        {h.note}
                      </div>
                    )}
                    <div className="mt-0.5 text-[10px] text-gray-400">
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

      {/* ═══ Modal تأكيد ═══ */}
      {showConfirm && nextAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${statusInfo.bg}`}
            >
              <nextAction.icon className={`h-7 w-7 ${statusInfo.color}`} />
            </div>
            <h3 className="mt-4 text-lg font-black">تأكيد التحديث</h3>
            <p className="mt-2 text-sm text-gray-600">
              سيتم تحديث حالة الطلب إلى: <strong>{nextAction.label}</strong>
            </p>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => handleChangeStatus(nextAction.next)}
                disabled={changing}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white transition disabled:opacity-50 ${nextAction.color}`}
              >
                {changing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                نعم، حدّث
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={changing}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}