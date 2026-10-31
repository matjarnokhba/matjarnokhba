"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, ArrowLeft, ArrowRightLeft, Package, AlertCircle, ShieldCheck,
} from "lucide-react";

type TransferData = {
  id: number;
  master: {
    id: number; name: string; slug: string;
    images: string[]; brand: string | null;
    barcode: string | null; isVerified: boolean;
  };
  wholesalePrice: number;
  retailPrice: number | null;
  claimVerified: boolean;
  isActive: boolean;
  productId: number | null;
  totalStock: number;
  variantsWithStock: number;
};

export default function TransferPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = parseInt(params.id as string);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<{ offer: TransferData; canTransfer: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/seller/wholesale/offers/${offerId}/transfer`);
        const d = await res.json();
        if (d.success) setData(d);
        else setError(d.message || "فشل التحميل");
      } catch {
        setError("خطأ في الاتصال");
      } finally {
        setLoading(false);
      }
    })();
  }, [offerId]);

  async function handleTransfer() {
    if (!data) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/seller/wholesale/offers/${offerId}/transfer`, { method: "POST" });
      const d = await res.json();
      if (d.success) {
        router.push(`/seller/products/${d.productId}`);
      } else {
        setError(d.message || "فشل النقل");
        setSubmitting(false);
      }
    } catch {
      setError("خطأ في الاتصال");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">{error}</div>
      </div>
    );
  }

  if (!data) return null;
  const { offer, canTransfer } = data;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/seller/wholesale/offers/${offerId}`}
          className="rounded-lg border p-2 hover:bg-gray-50"
          aria-label="عودة"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">نقل العرض إلى متجر التجزئة</h1>
          <p className="text-sm text-gray-600">
            سيتم إنشاء منتج جديد في متجرك من هوية العرض
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-white border p-5 space-y-4">
        <div className="flex gap-4">
          <div className="h-20 w-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
            {offer.master.images?.[0] ? (
              <img
                src={offer.master.images[0]}
                alt={offer.master.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-400">
                <Package className="h-8 w-8" />
              </div>
            )}
          </div>
          <div>
            <h2 className="font-semibold text-lg">{offer.master.name}</h2>
            <p className="text-sm text-gray-600">{offer.master.brand || "—"}</p>
            {offer.master.isVerified && (
              <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                <ShieldCheck className="h-4 w-4" /> هوية موثقة
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-gray-600">سعر الجملة</p>
            <p className="font-bold">{offer.wholesalePrice} د.م</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-gray-600">سعر التجزئة</p>
            <p className="font-bold">{offer.retailPrice || offer.wholesalePrice} د.م</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-gray-600">المخزون الكلي</p>
            <p className="font-bold">{offer.totalStock} قطعة</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-gray-600">عدد المتغيرات</p>
            <p className="font-bold">{offer.variantsWithStock}</p>
          </div>
        </div>
      </div>

      {!canTransfer && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              {offer.productId && <p>تم نقل هذا العرض مسبقًا إلى متجرك.</p>}
              {!offer.claimVerified && <p>لا يمكن النقل قبل التحقق من المطالبة.</p>}
              {!offer.isActive && <p>العرض غير نشط.</p>}
              {offer.totalStock === 0 && <p>لا يوجد مخزون للنقل.</p>}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Link
          href={`/seller/wholesale/offers/${offerId}`}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
        >
          إلغاء
        </Link>
        <button
          onClick={handleTransfer}
          disabled={!canTransfer || submitting}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRightLeft className="h-4 w-4" />
          )}
          {submitting ? "جارٍ النقل..." : "تأكيد النقل"}
        </button>
      </div>
    </div>
  );
}