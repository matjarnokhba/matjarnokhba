"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Package, CheckCircle2, AlertCircle, Info } from "lucide-react";

type OrderItem = {
  id: number;
  productName: string;
  variantName: string | null;
  qty: number;
  importedQty: number | null;
  importedProductId: number | null;
  salePrice: string | number | null;
  purchaseCost: string | number | null;
  unitPrice: string | number;
};

type Draft = {
  id: number;
  name: string;
  slug: string;
  status: string;
  images: string[];
  variants: Array<{ id: number; sku: string; price: string | number; barcode: string | null }>;
};

type Data = { order: { id: number; orderNumber: string; status: string }; items: OrderItem[]; drafts: Draft[] };

type Edit = { salePrice: string; purchaseCost: string; qty: string };

export default function ImportPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = parseInt(params.id as string);
  const [data, setData] = useState<Data | null>(null);
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/seller/wholesale/orders/${orderId}/import`);
        const d = await res.json();
        if (d.success) {
          setData(d);
          const initial: Record<number, Edit> = {};
          for (const item of d.items) {
            initial[item.id] = {
              salePrice: String(item.salePrice ?? ""),
              purchaseCost: String(item.purchaseCost ?? ""),
              qty: String(item.importedQty ?? item.qty),
            };
          }
          setEdits(initial);
        } else {
          setError(d.message || "فشل التحميل");
        }
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [orderId]);

  function setEdit(itemId: number, field: keyof Edit, value: string) {
    setEdits((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  }

  async function handleActivate() {
    if (!data) return;
    setSubmitting(true); setError("");
    try {
      const payload = data.items.map((it) => ({
        orderItemId: it.id,
        salePrice: Number(edits[it.id].salePrice),
        purchaseCost: edits[it.id].purchaseCost ? Number(edits[it.id].purchaseCost) : null,
        qty: Number(edits[it.id].qty),
      }));
      for (const p of payload) {
        if (isNaN(p.salePrice) || p.salePrice <= 0) throw new Error("سعر غير صالح");
        if (isNaN(p.qty) || p.qty <= 0) throw new Error("كمية غير صالحة");
      }
      const res = await fetch(`/api/seller/wholesale/orders/${orderId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      const d = await res.json();
      if (d.success) router.push(`/seller/wholesale/orders/${orderId}`);
      else { setError(d.message || "فشل النشر"); setSubmitting(false); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ في الاتصال");
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
  if (error && !data) return <div className="max-w-3xl mx-auto p-6"><div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">{error}</div></div>;
  if (!data) return null;

  const { order, items, drafts } = data;
  const draftById = new Map(drafts.map((d) => [d.id, d]));

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/seller/wholesale/orders/${orderId}`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold">إعداد منتجاتك قبل النشر</h1>
          <p className="text-sm text-gray-600">الطلب {order.orderNumber} — {items.length} بند</p>
        </div>
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
        <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">حدد لكل منتج: السعر، الكمية، (وسعر الشراء اختياري)</p>
          <p className="text-xs mt-1">سعر الشراء يساعدك على حساب الربح في دفترك. لن يظهر للعملاء.</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((it) => {
          const draft = it.importedProductId ? draftById.get(it.importedProductId) : null;
          const e = edits[it.id];
          const profit = e.purchaseCost && e.salePrice
            ? Number(e.salePrice) - Number(e.purchaseCost)
            : null;
          return (
            <div key={it.id} className="rounded-lg bg-white border p-4">
              <div className="flex gap-3 mb-3">
                <div className="h-14 w-14 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                  {draft?.images?.[0] ? (
                    <img src={draft.images[0]} alt={draft.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-400"><Package className="h-6 w-6" /></div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{it.productName}</h3>
                  {it.variantName && <p className="text-xs text-gray-600">{it.variantName}</p>}
                  <p className="text-xs text-gray-500 mt-0.5">اشتريت: {it.qty} · سعر الجملة: {Number(it.unitPrice)} د.م</p>
                </div>
                {draft && (
                  <Link href={`/seller/products/${draft.id}/edit`} className="text-xs rounded border px-2 py-1 hover:bg-gray-50 self-start">تعديل التفاصيل</Link>
                )}
              </div>

              {e && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">سعر البيع *</label>
                    <input type="number" min="0.01" step="0.01" value={e.salePrice}
                      onChange={(ev) => setEdit(it.id, "salePrice", ev.target.value)}
                      className="w-full rounded border p-2 text-sm" placeholder="120.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">الكمية (≤ {it.qty}) *</label>
                    <input type="number" min="1" max={it.qty} value={e.qty}
                      onChange={(ev) => setEdit(it.id, "qty", ev.target.value)}
                      className="w-full rounded border p-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 flex items-center gap-1">
                      سعر الشراء <span className="text-[10px] text-gray-400">(اختياري)</span>
                    </label>
                    <input type="number" min="0.01" step="0.01" value={e.purchaseCost}
                      onChange={(ev) => setEdit(it.id, "purchaseCost", ev.target.value)}
                      className="w-full rounded border p-2 text-sm" placeholder="90.00" />
                  </div>
                </div>
              )}
              {profit !== null && profit > 0 && (
                <div className="mt-2 text-xs text-green-700 flex items-center gap-1">
                  <Info className="h-3 w-3" /> الربح المتوقع: {profit.toFixed(2)} د.م للوحدة
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      <button
        onClick={handleActivate}
        disabled={submitting}
        className="w-full rounded-lg bg-green-600 px-4 py-3 text-white font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
        {submitting ? "جارٍ النشر..." : `نشر ${items.length} منتج في متجري`}
      </button>
    </div>
  );
}