"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Package,
  User as UserIcon,
  Mail,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";

type ReturnRequest = {
  id: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
  reason: string;
  adminNote: string | null;
  requestedAt: string;
  processedAt: string | null;
  user: { id: number; name: string; email: string };
  order: {
    id: number;
    orderNumber: string;
    total: string;
    subtotal: string;
    discount: string;
    shippingCost: string;
    refundedAmount: string;
    paymentStatus: string;
  };
  items: {
    id: number;
    quantity: number;
    refundAmount: string;
    orderItem: {
      id: number;
      productName: string;
      variantName: string | null;
      imageUrl: string | null;
      quantity: number;
      unitPrice: string;
    };
  }[];
};

const STATUS_INFO: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  PENDING: { label: "قيد المراجعة", color: "text-amber-700", bg: "bg-amber-100" },
  APPROVED: { label: "تمت الموافقة", color: "text-blue-700", bg: "bg-blue-100" },
  REJECTED: { label: "مرفوض", color: "text-red-700", bg: "bg-red-100" },
  COMPLETED: { label: "مكتمل", color: "text-green-700", bg: "bg-green-100" },
};

const CURRENCY = "د.م";

export default function AdminReturnDetailPage() {
  const params = useParams();
  const returnId = params.id as string;

  const [ret, setRet] = useState<ReturnRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [adminNote, setAdminNote] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/returns/${returnId}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "طلب الإرجاع غير موجود");
        return;
      }
      setRet(data.returnRequest);
    } catch (err) {
      console.error(err);
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (returnId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnId]);

  async function handleAction(action: "approve" | "reject" | "complete") {
    setActionLoading(true);
    try {
      const body: any = { action };
      if (action === "reject") body.adminNote = adminNote.trim() || undefined;

      const res = await fetch(`/api/admin/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "فشل الإجراء");
        return;
      }

      setShowRejectModal(false);
      setAdminNote("");
      await loadData();
    } catch (err) {
      console.error(err);
      alert("فشل الاتصال");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (error || !ret) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl">😕</div>
        <h1 className="mt-4 text-2xl font-black text-gray-900">{error}</h1>
        <Link
          href="/admin/returns"
          className="mt-6 rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
        >
          عودة إلى الإرجاع
        </Link>
      </div>
    );
  }

  const info = STATUS_INFO[ret.status];
  const totalRefund = ret.items.reduce((s, i) => s + Number(i.refundAmount), 0);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/admin/returns"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع إلى الإرجاع
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">
            طلب إرجاع #{ret.id}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {new Date(ret.requestedAt).toLocaleDateString("ar-MA", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <span
          className={`rounded-full px-4 py-2 text-sm font-bold ${info.bg} ${info.color}`}
        >
          {info.label}
        </span>
      </div>

      <div className="mb-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-black">معلومات العميل</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-gray-400" />
            <span className="font-bold">{ret.user.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">{ret.user.email}</span>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-black">الطلب الأصلي</h2>
          <Link
            href={`/admin/orders/${ret.order.id}`}
            className="text-xs font-bold text-[#ff5c00] hover:underline"
          >
            عرض الطلب ←
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div>
            <div className="text-gray-500">رقم الطلب</div>
            <div className="mt-0.5 font-mono font-bold">
              {ret.order.orderNumber}
            </div>
          </div>
          <div>
            <div className="text-gray-500">الإجمالي</div>
            <div className="mt-0.5 font-bold">
              {ret.order.total} {CURRENCY}
            </div>
          </div>
          <div>
            <div className="text-gray-500">المُسترجع سابقاً</div>
            <div className="mt-0.5 font-bold text-green-600">
              {ret.order.refundedAmount} {CURRENCY}
            </div>
          </div>
          <div>
            <div className="text-gray-500">حالة الدفع</div>
            <div className="mt-0.5 font-bold">{ret.order.paymentStatus}</div>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-black">سبب الإرجاع</h2>
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
          {ret.reason}
        </p>
        {ret.adminNote && (
          <div className="mt-3">
            <div className="mb-1 text-xs font-bold text-gray-700">
              ملاحظة الإدارة:
            </div>
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {ret.adminNote}
            </p>
          </div>
        )}
      </div>

      <div className="mb-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-black">
          المنتجات ({ret.items.length})
        </h2>
        <div className="space-y-3">
          {ret.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {item.orderItem.imageUrl ? (
                  <img
                    src={item.orderItem.imageUrl}
                    alt={item.orderItem.productName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">
                    <Package className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-sm font-bold">
                  {item.orderItem.productName}
                </div>
                {item.orderItem.variantName && (
                  <div className="mt-0.5 text-[10px] text-gray-500">
                    {item.orderItem.variantName}
                  </div>
                )}
                <div className="mt-1 text-[10px] text-gray-500">
                  الكمية المرتجعة: <strong>{item.quantity}</strong> من{" "}
                  {item.orderItem.quantity}
                </div>
              </div>
              <div className="shrink-0 text-left">
                <div className="text-[10px] text-gray-500">قيمة الإرجاع</div>
                <div className="text-sm font-black text-green-600">
                  {item.refundAmount} {CURRENCY}
                </div>
              </div>
            </div>
          ))}
        </div>
        {totalRefund > 0 && (
          <div className="mt-4 flex justify-between border-t border-dashed border-gray-200 pt-3 text-sm">
            <span className="font-bold">مجموع الإرجاع</span>
            <span className="text-lg font-black text-green-600">
              {totalRefund.toFixed(2)} {CURRENCY}
            </span>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-black">الإجراءات</h2>

        {ret.status === "PENDING" && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleAction("approve")}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              موافقة
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              رفض
            </button>
          </div>
        )}

        {ret.status === "APPROVED" && (
          <div>
            <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              💡 عند الإكمال: سيرجع المخزون، وتُحسب قيمة الاسترداد، ويُحدَّث
              حالة الطلب.
            </p>
            <button
              onClick={() => handleAction("complete")}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              إكمال الإرجاع
            </button>
          </div>
        )}

        {(ret.status === "COMPLETED" || ret.status === "REJECTED") && (
          <p className="text-sm text-gray-500">
            هذا الطلب {ret.status === "COMPLETED" ? "مكتمل" : "مرفوض"} — لا
            توجد إجراءات إضافية.
          </p>
        )}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-7 w-7 text-red-600" />
            </div>
            <h3 className="mt-4 text-center text-lg font-black">
              رفض طلب الإرجاع
            </h3>
            <p className="mt-2 text-center text-sm text-gray-600">
              اكتب سبب الرفض (اختياري) ليظهر للعميل.
            </p>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
              maxLength={500}
              disabled={actionLoading}
              placeholder="مثال: المنتج مستعمل، أو خارج مدة الإرجاع..."
              className="mt-4 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleAction("reject")}
                disabled={actionLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                تأكيد الرفض
              </button>
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={actionLoading}
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