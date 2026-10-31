"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Package, CheckCircle2, AlertCircle } from "lucide-react";

type Draft = {
  id: number;
  name: string;
  slug: string;
  status: string;
  images: string[];
  variants: Array<{ id: number; sku: string; price: number; barcode: string | null }>;
};

type Data = { order: { id: number; orderNumber: string; status: string }; drafts: Draft[] };

export default function ImportPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = parseInt(params.id as string);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/seller/wholesale/orders/${orderId}/import`);
        const d = await res.json();
        if (d.success) setData(d);
        else setError(d.message || "فشل التحميل");
      } catch {
        setError("خطأ في الاتصال");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  async function handleActivate() {
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`/api/seller/wholesale/orders/${orderId}/activate`, { method: "POST" });
      const d = await res.json();
      if (d.success) router.push(`/seller/wholesale/orders/${orderId}`);
      else { setError(d.message || "فشل النشر"); setSubmitting(false); }
    } catch { setError("خطأ في الاتصال"); setSubmitting(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
  if (error && !data) return <div className="max-w-3xl mx-auto p-6"><div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">{error}</div></div>;
  if (!data) return null;

  const { order, drafts } = data;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/seller/wholesale/orders/${orderId}`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold">منتجات جاهزة للنشر</h1>
          <p className="text-sm text-gray-600">الطلب {order.orderNumber}</p>
        </div>
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex items-start gap-2">
        <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">منتجاتك في وضع المسودة</p>
          <p className="text-xs mt-1">راجع كل منتج: عدّل السعر، الكمية، الصور — ثم اضغط نشر الكل.</p>
        </div>
      </div>

      <div className="space-y-3">
        {drafts.map((d) => (
          <div key={d.id} className="rounded-lg bg-white border p-4 flex gap-4">
            <div className="h-16 w-16 rounded bg-gray-100 overflow-hidden flex-shrink-0">
              {d.images?.[0] ? (
                <img src={d.images[0]} alt={d.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-400"><Package className="h-6 w-6" /></div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{d.name}</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                {d.variants.length} متغير · {d.variants[0]?.price ?? 0} د.م
              </p>
              <Link href={`/seller/products/${d.id}/edit`} className="mt-2 inline-block text-xs rounded border px-2 py-1 hover:bg-gray-50">
                تعديل السعر والكمية
              </Link>
            </div>
          </div>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      <button
        onClick={handleActivate}
        disabled={submitting}
        className="w-full rounded-lg bg-green-600 px-4 py-3 text-white font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
        {submitting ? "جارٍ النشر..." : "نشر الكل في متجري"}
      </button>
    </div>
  );
}