"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  Shield,
  QrCode,
  ScanLine,
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
  source: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: string;
  shippingCost: string;
  discount: string;
  total: string;
  sellerPayout: string | null;
  createdAt: string;
  deliveredAt: string | null;
  deliveryToken: string | null;
  shippingAddressSnapshot: AddressSnapshot | null;
  customerSnapshot: any | null;
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
  { key: "SHIPPED", label: "جاهز/مشحون", icon: Truck },
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
  PARTIALLY_DELIVERED: {
    label: "تسليم جزئي",
    color: "text-indigo-700",
    bg: "bg-indigo-50",
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

export default function SellerOrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  // Modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

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

  async function handleTransition(nextStatus: string, note?: string) {
    setChanging(true);
    try {
      const res = await fetch(`/api/seller/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, note }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "فشل التحديث");
        return;
      }

      setShowApproveModal(false);
      setShowRejectModal(false);
      setRejectReason("");
      await loadOrder();
    } catch {
      alert("فشل الاتصال");
    } finally {
      setChanging(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

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
  const isInStore = order.source === "IN_STORE";
  const showPII = isInStore && !!address;

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
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <span>
                {new Date(order.createdAt).toLocaleDateString("ar-MA", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {isInStore ? "بيع في المتجر" : "طلب إلكتروني"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start">
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

      {/* ═══ قسم الإجراء (حسب الحالة) ═══ */}

      {/* NEW → قبول / رفض */}
      {order.status === "NEW" && (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
              <Clock className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <div className="text-base font-black text-blue-900">
                طلب جديد بانتظار قرارك
              </div>
              <p className="mt-1 text-xs text-blue-700">
                راجع المنتجات والكميات، ثم اقبل الطلب لبدء التجهيز أو ارفضه بسبب واضح.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowApproveModal(true)}
              disabled={changing}
              className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-5 w-5" />
              قبول الطلب
            </button>

            <button
              onClick={() => setShowRejectModal(true)}
              disabled={changing}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle className="h-5 w-5" />
              رفض الطلب
            </button>
          </div>
        </div>
      )}

      {/* PROCESSING → الملصق + الماسح */}
      {order.status === "PROCESSING" && (
        <>
          <div className="mt-4 rounded-2xl border-2 border-[#ff5c00] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <QrCode className="h-5 w-5 text-[#ff5c00]" />
              <h2 className="text-base font-black">ملصق الطلبية</h2>
            </div>

            <p className="mb-4 text-xs text-gray-600">
              اطبع الملصق وضعه على الطرد. يحتوي على رمز QR المرتبط بالطلبية.
            </p>

            <div className="mb-4 flex items-center justify-between rounded-xl bg-[#fff4ed] px-4 py-3">
              <span className="text-xs font-bold text-gray-700">
                المبلغ المطلوب من العميل
              </span>
              <span className="text-lg font-black text-[#ff5c00]">
                {Number(order.total).toFixed(2)} {CURRENCY}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/seller/orders/${orderId}/label`}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#ff5c00] bg-white py-3 text-sm font-bold text-[#ff5c00] transition hover:bg-[#fff4ed]"
              >
                <Printer className="h-4 w-4" />
                طباعة الملصق
              </Link>

              <Link
                href={`/seller/orders/${orderId}/invoice`}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-gray-300 bg-white py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                <Printer className="h-4 w-4" />
                الفاتورة
              </Link>
            </div>
          </div>

          {/* زر الماسح */}
          <div className="mt-4 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50 p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100">
                <ScanLine className="h-5 w-5 text-purple-700" />
              </div>
              <div>
                <div className="text-base font-black text-purple-900">
                  عند اكتمال التجهيز
                </div>
                <p className="mt-1 text-xs text-purple-700">
                  امسح ملصق الطلبية لإبلاغ النظام بأنها جاهزة للشحن.
                </p>
              </div>
            </div>

            <Link
              href={`/seller/scanner?orderToken=${order.deliveryToken || ""}&orderId=${orderId}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-purple-700"
            >
              <ScanLine className="h-5 w-5" />
              فتح الماسح لإكمال التجهيز
            </Link>
          </div>
        </>
      )}

      {/* SHIPPED → بانتظار الجامع */}
      {order.status === "SHIPPED" && (
        <div className="mt-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100">
              <Truck className="h-5 w-5 text-indigo-700" />
            </div>
            <div>
              <div className="text-base font-black text-indigo-900">
                بانتظار جمع الطرد
              </div>
              <p className="mt-1 text-xs text-indigo-700">
                تم تجهيز طلبك. سيأتي مسؤول الجمع المعيّن من المستودع لاستلامه.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ أرباحك ═══ */}
      {order.status === "DELIVERED" && (
        <div className="mt-4 rounded-2xl bg-gradient-to-l from-green-500 to-emerald-500 p-5 text-white shadow-md">
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

      {/* ═══ بيانات العميل ═══ */}
      {showPII && address ? (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-black">
            <MapPin className="h-4 w-4 text-[#ff5c00]" />
            بيانات العميل
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
      ) : (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <div className="text-sm font-black text-blue-900">
                بيانات العميل محمية
              </div>
              <p className="mt-1 text-xs text-blue-800">
                لأسباب أمنية وخصوصية، لا تتوفر بيانات الشحن الإلكترونية
                للتاجر. تُعرض فقط للطلبات المُسجَّلة في المتجر.
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* ═══ Modal: قبول ═══ */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <h3 className="mt-4 text-lg font-black">تأكيد قبول الطلب</h3>
            <p className="mt-2 text-sm text-gray-600">
              سيتم تحويل الطلب إلى <strong>قيد التجهيز</strong>، وسيظهر لك
              الملصق والماسح.
            </p>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => handleTransition("PROCESSING")}
                disabled={changing}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {changing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                نعم، اقبل
              </button>
              <button
                onClick={() => setShowApproveModal(false)}
                disabled={changing}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal: رفض ═══ */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-red-700">
                رفض الطلب
              </h3>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-800">
              ⚠️ سيُلغى الطلب وتُرجع الكميات إلى المخزون، وسيُبلّغ العميل
              بالسبب.
            </div>

            <label className="mb-2 block text-xs font-bold text-gray-700">
              سبب الرفض (إجباري)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="مثال: المنتج غير متوفر، العميل خارج التغطية، إلخ."
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:bg-white"
              autoFocus
            />
            <div className="mt-1 text-[10px] text-gray-500">
              {rejectReason.trim().length} / 5 حرفًا على الأقل
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => handleTransition("CANCELLED", rejectReason)}
                disabled={changing || rejectReason.trim().length < 5}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {changing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                تأكيد الرفض
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
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