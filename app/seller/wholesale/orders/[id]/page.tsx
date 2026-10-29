"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Package, User, MapPin, Phone, Mail,
  CheckCircle2, XCircle, Truck, AlertCircle, Clock,
} from "lucide-react";

type OrderDetail = {
  id: number; orderNumber: string; status: string;
  subtotal: number; total: number;
  notes: string | null; rejectionReason: string | null;
  createdAt: string;
  acceptedAt: string | null; rejectedAt: string | null;
  completedAt: string | null; cancelledAt: string | null;
  buyer: { id: number; name: string; email: string; phone: string | null };
  supplier: { id: number; displayName: string; slug: string; city: string; activityType: string; isVerified: boolean };
  items: Array<{ id: number; productName: string; qty: number; unitPrice: number; total: number; sourceName: string; variantSku: string | null; variantOptions: any }>;
};

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  PENDING: { label: "جديد — بانتظار قرارك", color: "bg-amber-100 text-amber-700" },
  ACCEPTED: { label: "مقبول", color: "bg-blue-100 text-blue-700" },
  REJECTED: { label: "مرفوض", color: "bg-red-100 text-red-700" },
  PREPARING: { label: "قيد التجهيز", color: "bg-indigo-100 text-indigo-700" },
  READY: { label: "جاهز للاستلام", color: "bg-purple-100 text-purple-700" },
  COMPLETED: { label: "مكتمل", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "ملغى", color: "bg-gray-100 text-gray-700" },
};

export default function SupplierOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = parseInt(params.id as string);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function load() {
    try {
      const res = await fetch(`/api/wholesale/orders/${orderId}`);
      if (res.status === 401) { router.push("/login"); return; }
      const d = await res.json();
      if (!d.success) { setError(d.message); return; }
      setOrder(d.order);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orderId]);

  async function doAction(action: string, reason?: string) {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/wholesale/orders/${orderId}/action`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const d = await res.json();
      if (!d.success) { setError(d.message); return; }
      await load();
      setShowRejectModal(false);
      setRejectReason("");
    } catch { setError("خطأ في الاتصال"); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" /></div>;
  if (error && !order) return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-md rounded-xl bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
        <p className="mt-3 text-sm font-bold text-red-700">{error}</p>
        <Link href="/seller/wholesale/orders" className="mt-4 inline-block rounded-lg bg-[#ff5c00] px-4 py-2 text-sm font-bold text-white">عودة</Link>
      </div>
    </div>
  );
  if (!order) return null;

  const info = STATUS_INFO[order.status] || STATUS_INFO.PENDING;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-3xl">
        <Link href="/seller/wholesale/orders" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]">
          <ArrowLeft className="h-3.5 w-3.5" /> عودة للطلبات
        </Link>

        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-lg font-black">{order.orderNumber}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${info.color}`}>{info.label}</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">{new Date(order.createdAt).toLocaleString("ar-MA")}</div>
          </div>
          <div className="text-left">
            <div className="text-2xl font-black text-[#ff5c00]">{order.total.toFixed(2)}</div>
            <div className="text-[10px] text-gray-500">د.م</div>
          </div>
        </div>

        {/* Buyer info */}
        <div className="mb-4 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black"><User className="h-4 w-4 text-[#ff5c00]" /> المشتري</h2>
          <div className="space-y-1.5 text-xs">
            <div><strong>الاسم:</strong> {order.buyer.name}</div>
            <div dir="ltr" className="text-left"><strong>البريد:</strong> {order.buyer.email}</div>
            {order.buyer.phone && <div dir="ltr" className="text-left"><strong>الهاتف:</strong> {order.buyer.phone}</div>}
          </div>
        </div>

        {/* Items */}
        <div className="mb-4 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black"><Package className="h-4 w-4 text-[#ff5c00]" /> المنتجات ({order.items.length})</h2>
          <div className="space-y-2">
            {order.items.map((i) => (
              <div key={i.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{i.productName}</div>
                  {i.variantSku && <div className="text-[10px] text-gray-500">{i.variantSku}</div>}
                  {i.sourceName && <div className="text-[10px] text-gray-500">المصدر: {i.sourceName}</div>}
                </div>
                <div className="text-left text-xs">
                  <div className="text-gray-500">{i.qty} × {i.unitPrice.toFixed(2)} د.م</div>
                  <div className="mt-1 font-black text-[#ff5c00]">{i.total.toFixed(2)} د.م</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {order.notes && (
          <div className="mb-4 rounded-xl bg-blue-50 p-4 text-xs text-blue-800">
            <strong>ملاحظة المشتري:</strong> {order.notes}
          </div>
        )}

        {order.rejectionReason && (
          <div className="mb-4 rounded-xl bg-red-50 p-4 text-xs text-red-800">
            <strong>سبب الرفض:</strong> {order.rejectionReason}
          </div>
        )}

        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}

        {/* Actions */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-black">الإجراءات</h2>
          {order.status === "PENDING" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={() => doAction("accept")} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} قبول الطلب
              </button>
              <button onClick={() => setShowRejectModal(true)} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
                <XCircle className="h-4 w-4" /> رفض
              </button>
            </div>
          )}
          {order.status === "ACCEPTED" && (
            <button onClick={() => doAction("prepare")} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
              <Package className="h-4 w-4" /> بدء التجهيز
            </button>
          )}
          {order.status === "PREPARING" && (
            <button onClick={() => doAction("ready")} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-2.5 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-50">
              <Package className="h-4 w-4" /> جاهز للاستلام
            </button>
          )}
          {order.status === "READY" && (
            <button onClick={() => doAction("complete")} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" /> إكمال الطلب
            </button>
          )}
          {["COMPLETED", "REJECTED", "CANCELLED"].includes(order.status) && (
            <div className="rounded-lg bg-gray-50 p-3 text-center text-xs text-gray-500">
              <Clock className="mx-auto mb-1 h-4 w-4" />
              الطلب {order.status === "COMPLETED" ? "مكتمل" : order.status === "REJECTED" ? "مرفوض" : "ملغى"} — لا توجد إجراءات متاحة
            </div>
          )}
        </div>

        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowRejectModal(false)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="mb-3 text-lg font-black">رفض الطلب</h2>
              <label className="mb-1 block text-xs font-bold">سبب الرفض</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]" placeholder="سيُعلم المشتري بالسبب" />
              <div className="mt-4 flex gap-2">
                <button onClick={() => setShowRejectModal(false)} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-bold">إلغاء</button>
                <button onClick={() => doAction("reject", rejectReason)} disabled={busy || !rejectReason.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} تأكيد الرفض
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}