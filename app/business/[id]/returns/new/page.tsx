"use client";
import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, RotateCcw, Package, AlertCircle } from "lucide-react";

type OrderItem = { id: number; productName: string; quantity: number; unitPrice: number; masterVariant: { options: any; sku: string | null } };
type Order = { id: number; orderNumber: string; status: string; buyerBusiness: { id: number; name: string }; items: OrderItem[] };

const REASONS = [
  { value: "DAMAGED", label: "منتج تالف" },
  { value: "WRONG_PRODUCT", label: "منتج مختلف" },
  { value: "NOT_AS_DESCRIBED", label: "مخالف للوصف" },
  { value: "QUALITY_ISSUE", label: "مشكلة جودة" },
  { value: "OTHER", label: "أخرى" },
];

function NewReturn() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const bizId = parseInt(params.id as string);
  const orderIdParam = search.get("orderId");

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [reason, setReason] = useState("DAMAGED");
  const [reasonDetails, setReasonDetails] = useState("");
  const [itemQuantities, setItemQuantities] = useState<Record<number, string>>({});

  useEffect(() => {
    (async () => {
      if (!orderIdParam) { setError("رقم الطلب مفقود"); setLoading(false); return; }
      try {
        const res = await fetch(`/api/business/${bizId}/orders/${orderIdParam}?side=buyer`);
        const d = await res.json();
        if (d.success) {
          setOrder(d.order);
          const init: Record<number, string> = {};
          for (const it of d.order.items) init[it.id] = "0";
          setItemQuantities(init);
        } else setError(d.message);
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [bizId, orderIdParam]);

  async function handleSubmit() {
    if (!order) return;
    const items = Object.entries(itemQuantities)
      .map(([id, qty]) => ({ orderItemId: parseInt(id), quantity: parseInt(qty) || 0 }))
      .filter((i) => i.quantity > 0);
    if (items.length === 0) return setError("أدخل كمية لبدء واحد على الأقل");

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/business/${bizId}/returns`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, reason, reasonDetails: reasonDetails || null, items }),
      });
      const d = await res.json();
      if (d.success) router.push(`/business/${bizId}/returns/${d.return.id}?side=buyer`);
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
  if (!order) return <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">{error || "الطلب غير موجود"}</div>;

  if (!["DELIVERED", "COMPLETED"].includes(order.status)) {
    return (
      <div className="space-y-4">
        <Link href={`/business/${bizId}/orders/${order.id}`} className="inline-flex items-center gap-1 text-sm text-gray-600"><ArrowLeft className="h-4 w-4" /> عودة للطلب</Link>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">لا يمكن إنشاء مرتجع</p>
            <p className="text-xs mt-1">المرتجعات متاحة فقط للطلبات المسلَّمة أو المكتملة. حالة الطلب الحالية: {order.status}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/business/${bizId}/orders/${order.id}?side=buyer`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><RotateCcw className="h-6 w-6 text-orange-500" /> طلب مرتجع</h1>
          <p className="text-sm text-gray-600">على الطلب <span className="font-mono">{order.orderNumber}</span></p>
        </div>
      </div>

      <div className="rounded-xl bg-white border p-5 space-y-3">
        <h2 className="font-semibold">سبب المرتجع</h2>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border p-2">
          {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <div>
          <label className="block text-sm font-medium mb-1">تفاصيل (اختياري)</label>
          <textarea value={reasonDetails} onChange={(e) => setReasonDetails(e.target.value)} rows={3} className="w-full rounded-lg border p-2 text-sm" placeholder="اشرح المشكلة..." />
        </div>
      </div>

      <div className="rounded-xl bg-white border p-5 space-y-3">
        <h2 className="font-semibold">الكميات المرتجعة</h2>
        <p className="text-xs text-gray-500">أدخل 0 للبنود التي لا تريد إرجاعها</p>
        {order.items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 border-b pb-3 last:border-b-0 last:pb-0">
            <Package className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{it.productName}</p>
              {it.masterVariant.options && <p className="text-xs text-gray-500">{Object.entries(it.masterVariant.options).map(([k, v]) => `${k}: ${v}`).join(" / ")}</p>}
              <p className="text-xs text-gray-500 mt-1">{Number(it.unitPrice).toFixed(2)} د.م/وحدة · الكمية: {it.quantity}</p>
            </div>
            <input
              type="number"
              min="0"
              max={it.quantity}
              value={itemQuantities[it.id] || "0"}
              onChange={(e) => setItemQuantities({ ...itemQuantities, [it.id]: e.target.value })}
              className="w-24 rounded-lg border p-2 text-sm"
            />
          </div>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-3">
        <Link href={`/business/${bizId}/orders/${order.id}?side=buyer`} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">إلغاء</Link>
        <button onClick={handleSubmit} disabled={submitting} className="rounded-lg bg-orange-500 text-white px-6 py-2 text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "جارٍ الإنشاء..." : "إنشاء طلب المرتجع"}
        </button>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>}><NewReturn /></Suspense>;
}