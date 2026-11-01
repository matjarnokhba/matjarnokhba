"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Package, Truck, CheckCircle2, XCircle, Clock, DollarSign, User, MapPin, Save } from "lucide-react";

type OrderItem = {
  id: number;
  productName: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  master: { id: number; name: string; brand: string | null; images: string[] };
  masterVariant: { id: number; sku: string | null; barcode: string | null; options: any };
};

type HistoryEntry = { id: number; fromStatus: string | null; toStatus: string; notes: string | null; createdAt: string; changedByUser: { id: number; name: string } };

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  total: number;
  currency: string;
  notes: string | null;
  trackingNumber: string | null;
  shippingCarrier: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  acceptedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  createdAt: string;
  buyerBusiness: { id: number; name: string; slug: string; city: string; logo: string | null; type: string };
  sellerBusiness: { id: number; name: string; slug: string; city: string; logo: string | null; type: string };
  buyerUser: { id: number; name: string; email: string };
  items: OrderItem[];
  statusHistory: HistoryEntry[];
};

type Payment = { id: number; amount: number; status: string; notes: string | null; createdAt: string; createdBy: { id: number; name: string } };
type PaymentsData = { payments: Payment[]; summary: { total: number; totalPaid: number; remaining: number } };

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "مسودة", color: "bg-gray-100 text-gray-700" },
  PENDING: { label: "بانتظار القبول", color: "bg-amber-100 text-amber-700" },
  ACCEPTED: { label: "مقبول", color: "bg-blue-100 text-blue-700" },
  PREPARING: { label: "قيد التجهيز", color: "bg-indigo-100 text-indigo-700" },
  SHIPPED: { label: "تم الشحن", color: "bg-purple-100 text-purple-700" },
  DELIVERED: { label: "تم التسليم", color: "bg-green-100 text-green-700" },
  COMPLETED: { label: "مكتمل", color: "bg-green-200 text-green-800" },
  REJECTED: { label: "مرفوض", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "ملغى", color: "bg-gray-200 text-gray-700" },
};

export default function OrderDetailPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const bizId = parseInt(params.id as string);
  const orderId = parseInt(params.orderId as string);
  const side = (search.get("side") || "buyer") as "buyer" | "seller";

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<PaymentsData | null>(null);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [oRes, pRes] = await Promise.all([
        fetch(`/api/business/${bizId}/orders/${orderId}`),
        fetch(`/api/business/${bizId}/orders/${orderId}/payments`),
      ]);
      const oData = await oRes.json();
      if (oData.success) setOrder(oData.order);
      else setError(oData.message);
      const pData = await pRes.json();
      if (pData.success) setPayments(pData);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [bizId, orderId]);

  async function handleAction(action: string, payload: any = {}) {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/business/${bizId}/orders/${orderId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const d = await res.json();
      if (d.success) await load();
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setActionLoading(false); }
  }

  async function handlePayment() {
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) return setError("أدخل مبلغًا صحيحًا");
    setRecordingPayment(true);
    setError("");
    try {
      const res = await fetch(`/api/business/${bizId}/orders/${orderId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, notes: paymentNotes || null }),
      });
      const d = await res.json();
      if (d.success) {
        setPaymentAmount("");
        setPaymentNotes("");
        await load();
      } else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setRecordingPayment(false); }
  }

  function renderActions() {
    if (!order) return null;
    const s = order.status;

    if (side === "seller") {
      if (s === "PENDING") return (
        <div className="space-y-2">
          <button onClick={() => handleAction("accept")} disabled={actionLoading} className="w-full rounded-lg bg-green-600 text-white px-4 py-2.5 hover:bg-green-700 flex items-center justify-center gap-2">
            {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />} قبول الطلب
          </button>
          <button onClick={() => {
            const r = prompt("سبب الرفض (اختياري):");
            if (r !== null) handleAction("reject", { reason: r || null });
          }} disabled={actionLoading} className="w-full rounded-lg border border-red-300 text-red-600 px-4 py-2.5 hover:bg-red-50 flex items-center justify-center gap-2">
            <XCircle className="h-4 w-4" /> رفض الطلب
          </button>
        </div>
      );
      if (s === "ACCEPTED") return (
        <button onClick={() => handleAction("prepare")} disabled={actionLoading} className="w-full rounded-lg bg-blue-600 text-white px-4 py-2.5 hover:bg-blue-700 flex items-center justify-center gap-2">
          {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />} <Package className="h-4 w-4" /> بدء التجهيز
        </button>
      );
      if (s === "PREPARING") return (
        <div className="space-y-2">
          <input id="tracking" placeholder="رقم التتبع (اختياري)" className="w-full rounded-lg border p-2 text-sm" />
          <input id="carrier" placeholder="شركة الشحن (اختياري)" className="w-full rounded-lg border p-2 text-sm" />
          <button onClick={() => {
            const tn = (document.getElementById("tracking") as HTMLInputElement).value;
            const sc = (document.getElementById("carrier") as HTMLInputElement).value;
            handleAction("ship", { trackingNumber: tn || null, shippingCarrier: sc || null });
          }} disabled={actionLoading} className="w-full rounded-lg bg-purple-600 text-white px-4 py-2.5 hover:bg-purple-700 flex items-center justify-center gap-2">
            {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />} <Truck className="h-4 w-4" /> تم الشحن
          </button>
        </div>
      );
    }

    if (side === "buyer") {
      if (s === "SHIPPED") return (
        <button onClick={() => handleAction("deliver")} disabled={actionLoading} className="w-full rounded-lg bg-green-600 text-white px-4 py-2.5 hover:bg-green-700 flex items-center justify-center gap-2">
          {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />} <CheckCircle2 className="h-4 w-4" /> تأكيد الاستلام
        </button>
      );
      if (s === "DELIVERED") return (
        <button onClick={() => handleAction("complete")} disabled={actionLoading} className="w-full rounded-lg bg-green-700 text-white px-4 py-2.5 hover:bg-green-800 flex items-center justify-center gap-2">
          {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />} <CheckCircle2 className="h-4 w-4" /> إكمال الطلب
        </button>
      );
      if (["PENDING", "ACCEPTED", "PREPARING"].includes(s)) return (
        <button onClick={() => {
          const r = prompt("سبب الإلغاء (اختياري):");
          if (r !== null) handleAction("cancel", { reason: r || null });
        }} disabled={actionLoading} className="w-full rounded-lg border border-red-300 text-red-600 px-4 py-2.5 hover:bg-red-50 flex items-center justify-center gap-2">
          <XCircle className="h-4 w-4" /> إلغاء الطلب
        </button>
      );
    }
    return <p className="text-sm text-gray-500 text-center">لا توجد إجراءات متاحة</p>;
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
  if (!order) return <div className="max-w-5xl mx-auto p-6"><div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">{error || "الطلب غير موجود"}</div></div>;

  const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/business/${bizId}/orders?side=${side}`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">طلب {order.orderNumber}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs ${st.color}`}>{st.label}</span>
          </div>
          <p className="text-sm text-gray-600">{new Date(order.createdAt).toLocaleString("ar-MA")}</p>
        </div>
      </div>

      {order.rejectionReason && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700"><strong>سبب الرفض:</strong> {order.rejectionReason}</div>}
      {order.cancellationReason && <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700"><strong>سبب الإلغاء:</strong> {order.cancellationReason}</div>}
      {order.trackingNumber && <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-sm text-purple-700"><strong>رقم التتبع:</strong> {order.trackingNumber}{order.shippingCarrier && ` (${order.shippingCarrier})`}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl bg-white border p-5">
            <h2 className="font-semibold mb-3">المنتجات ({order.items.length})</h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-3 border-b pb-3 last:border-b-0 last:pb-0">
                  <div className="h-16 w-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {item.master.images?.[0] ? <img src={item.master.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="h-full w-full text-gray-300 p-2" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.productName}</p>
                    {item.masterVariant.options && <p className="text-xs text-gray-500">{Object.entries(item.masterVariant.options).map(([k, v]) => `${k}: ${v}`).join(" / ")}</p>}
                    <p className="text-xs text-gray-500 mt-1">{item.quantity} × {item.unitPrice} = <span className="font-semibold">{item.subtotal} د.م</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white border p-5">
            <h2 className="font-semibold mb-3">الملخص المالي</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>المجموع الفرعي</span><span>{order.subtotal} د.م</span></div>
              {order.shippingCost > 0 && <div className="flex justify-between"><span>الشحن</span><span>+ {order.shippingCost} د.م</span></div>}
              {order.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>خصم</span><span>- {order.discountAmount} د.م</span></div>}
              <div className="flex justify-between border-t pt-2 font-bold text-base"><span>الإجمالي</span><span className="text-orange-600">{order.total} {order.currency}</span></div>
            </div>
          </div>

          {payments && (
            <div className="rounded-xl bg-white border p-5">
              <h2 className="font-semibold mb-3">المدفوعات</h2>
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div className="rounded bg-gray-50 p-2"><p className="text-xs text-gray-500">الإجمالي</p><p className="font-bold">{payments.summary.total}</p></div>
                <div className="rounded bg-green-50 p-2"><p className="text-xs text-gray-600">مدفوع</p><p className="font-bold text-green-700">{payments.summary.totalPaid}</p></div>
                <div className={`rounded p-2 ${payments.summary.remaining > 0 ? "bg-amber-50" : "bg-green-50"}`}><p className="text-xs text-gray-600">متبقٍ</p><p className={`font-bold ${payments.summary.remaining > 0 ? "text-amber-700" : "text-green-700"}`}>{payments.summary.remaining}</p></div>
              </div>
              {payments.payments.length > 0 && (
                <div className="space-y-2 mb-4">
                  {payments.payments.map((p) => (
                    <div key={p.id} className="flex justify-between text-sm border-b pb-2 last:border-b-0">
                      <div><p className="font-medium">{p.amount} د.م</p><p className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString("ar-MA")} · {p.createdBy.name}</p></div>
                      <span className={`text-xs px-2 py-0.5 rounded ${p.status === "CONFIRMED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{p.status}</span>
                    </div>
                  ))}
                </div>
              )}
              {side === "buyer" && payments.summary.remaining > 0 && ["DELIVERED", "COMPLETED"].includes(order.status) && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-sm font-medium">تسجيل دفعة جديدة</p>
                  <input type="number" step="0.01" max={payments.summary.remaining} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="المبلغ" className="w-full rounded-lg border p-2 text-sm" />
                  <input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="ملاحظات (اختياري)" className="w-full rounded-lg border p-2 text-sm" />
                  <button onClick={handlePayment} disabled={recordingPayment} className="w-full rounded-lg bg-green-600 text-white px-4 py-2 hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {recordingPayment && <Loader2 className="h-4 w-4 animate-spin" />} <DollarSign className="h-4 w-4" /> تسجيل الدفعة
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-white border p-5">
            <h2 className="font-semibold mb-3">الإجراءات</h2>
            {renderActions()}
          </div>

          <div className="rounded-xl bg-white border p-5">
            <h2 className="font-semibold mb-3">الأطراف</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><User className="h-4 w-4 text-gray-500" /><span className="text-gray-500">المشتري:</span> <span className="font-medium">{order.buyerBusiness.name}</span></div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-500" /><span className="text-gray-500">{order.buyerBusiness.city}</span></div>
              <div className="border-t pt-2 flex items-center gap-2"><User className="h-4 w-4 text-gray-500" /><span className="text-gray-500">البائع:</span> <span className="font-medium">{order.sellerBusiness.name}</span></div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-500" /><span className="text-gray-500">{order.sellerBusiness.city}</span></div>
            </div>
          </div>

          <div className="rounded-xl bg-white border p-5">
            <h2 className="font-semibold mb-3">سجل الحالة</h2>
            <div className="space-y-2">
              {order.statusHistory.map((h) => (
                <div key={h.id} className="text-xs border-r-2 border-orange-300 pr-2">
                  <p className="font-medium">{STATUS_CONFIG[h.toStatus]?.label || h.toStatus}</p>
                  <p className="text-gray-500">{new Date(h.createdAt).toLocaleString("ar-MA")}</p>
                  <p className="text-gray-500">{h.changedByUser.name}</p>
                  {h.notes && <p className="text-gray-600 mt-1">{h.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
    </div>
  );
}