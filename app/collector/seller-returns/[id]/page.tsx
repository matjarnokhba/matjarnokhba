"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  Package,
  AlertCircle,
  Store,
  ArrowRight,
  CheckCircle2,
  QrCode,
} from "lucide-react";
import QRCode from "qrcode";

type BatchDetails = {
  id: number;
  batchNumber: string;
  status: string;
  totalQuantity: number;
  itemsCount: number;
  seller: { storeName: string; city: string | null };
  items: Array<{
    id: number;
    quantity: number;
    reason: string | null;
    orderNumber: string;
    productName: string;
    variantName: string | null;
    imageUrl: string | null;
  }>;
};

export default function CollectorBatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/collector/seller-returns/${batchId}`);
        const data = await res.json();
        if (!data.success) {
          setError(data.message || "فشل التحميل");
          return;
        }
        setBatch(data.batch);

        // جلب QR إذا كانت الدفعة PICKED_UP
        if (data.batch.status === "PICKED_UP") {
          const qrRes = await fetch(
            `/api/collector/seller-returns/${batchId}/qr`
          );
          const qrData = await qrRes.json();
          if (qrData.success) {
            const url = await QRCode.toDataURL(qrData.qrToken, {
              width: 500,
              margin: 1,
            });
            setQrImage(url);
          }
        }
      } catch {
        setError("فشل الاتصال");
      } finally {
        setLoading(false);
      }
    }
    if (batchId) load();
  }, [batchId]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
      </div>
    );

  if (error && !batch) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-3 text-lg font-black">{error}</h2>
          <button
            onClick={() => router.push("/collector/seller-returns")}
            className="mt-6 rounded-full bg-purple-600 px-6 py-2.5 text-sm font-bold text-white"
          >
            العودة
          </button>
        </div>
      </div>
    );
  }

  if (!batch) return null;

  const isDelivered = batch.status === "CONFIRMED";

  return (
    <div className="p-4 pt-16 pb-24 lg:p-8 lg:pt-8 min-h-screen bg-gray-50" dir="rtl">
      <div className="mx-auto max-w-2xl space-y-4">
        <button
          onClick={() => router.push("/collector/seller-returns")}
          className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-gray-900"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>

        {/* الحالة */}
        <div
          className={`rounded-2xl p-5 shadow-sm border-2 ${
            isDelivered
              ? "bg-green-50 border-green-300"
              : "bg-blue-50 border-blue-300"
          }`}
        >
          <div className="flex items-center gap-3">
            {isDelivered ? (
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            ) : (
              <QrCode className="h-8 w-8 text-blue-600" />
            )}
            <div className="flex-1">
              <div className="font-black text-lg text-gray-900">
                {batch.batchNumber}
              </div>
              <div className="text-sm text-gray-700 mt-0.5">
                {isDelivered
                  ? "✅ تم تسليم الدفعة للتاجر"
                  : "🚚 اعرض QR التالي للتاجر ليمسحه"}
              </div>
            </div>
          </div>
        </div>

        {/* QR للتاجر */}
        {!isDelivered && qrImage && (
          <div className="rounded-2xl bg-white p-5 shadow-sm text-center">
            <h2 className="text-lg font-black text-gray-900 mb-3">
              QR للتاجر
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              اعرض هذا الرمز للتاجر ليمسحه ويستلم المرتجعات
            </p>
            <div className="mx-auto w-72 h-72 bg-white p-3 rounded-2xl border-4 border-purple-600 shadow-lg">
              <img
                src={qrImage}
                alt="QR"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="mt-4 rounded-lg bg-purple-50 p-3 text-xs text-purple-800 font-bold">
              📱 التاجر: {batch.seller.storeName}
              {batch.seller.city && ` (${batch.seller.city})`}
            </div>
          </div>
        )}

        {/* تفاصيل التاجر */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-black mb-3">
            <Store className="h-4 w-4 text-purple-600" />
            التاجر
          </h2>
          <div className="font-bold text-gray-900">{batch.seller.storeName}</div>
          {batch.seller.city && (
            <div className="text-xs text-gray-500 mt-0.5">
              📍 {batch.seller.city}
            </div>
          )}
        </div>

        {/* المنتجات */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-black mb-3">
            <Package className="h-4 w-4 text-purple-600" />
            المرتجعات ({batch.items.length} عنصر · {batch.totalQuantity} منتج)
          </h2>

          <div className="space-y-2">
            {batch.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 border border-gray-100"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    className="h-12 w-12 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-200 shrink-0">
                    <Package className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">
                    {item.productName}
                  </div>
                  {item.variantName && (
                    <div className="text-[11px] text-gray-500">
                      {item.variantName}
                    </div>
                  )}
                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                    {item.orderNumber}
                  </div>
                  {item.reason && (
                    <div className="text-[10px] text-red-600 mt-0.5">
                      سبب الرفض: {item.reason}
                    </div>
                  )}
                </div>
                <div className="text-base font-black text-purple-600 shrink-0">
                  ×{item.quantity}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}