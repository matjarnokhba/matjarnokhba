"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Package,
  Store,
  X,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  Truck,
  RefreshCw,
} from "lucide-react";
import QRCode from "qrcode";

type SellerPending = {
  sellerId: number;
  storeName: string;
  city: string | null;
  totalQuantity: number;
  itemsCount: number;
  items: Array<{
    shipmentItemId: number;
    orderNumber: string;
    productName: string;
    variantName: string | null;
    imageUrl: string | null;
    quantity: number;
  }>;
};

type ActiveBatch = {
  id: number;
  batchNumber: string;
  status: string;
  totalQuantity: number;
  itemsCount: number;
  createdAt: string;
  seller: { storeName: string; city: string | null };
};

export default function WarehouseSellerReturnsPage() {
  const [pendingSellers, setPendingSellers] = useState<SellerPending[]>([]);
  const [activeBatches, setActiveBatches] = useState<ActiveBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSeller, setSelectedSeller] = useState<SellerPending | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [batchInfo, setBatchInfo] = useState<{ batchNumber: string; totalQuantity: number; itemsCount: number } | null>(null);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [error, setError] = useState("");

  // عرض QR لدفعة موجودة
  const [viewingBatch, setViewingBatch] = useState<ActiveBatch | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);

  async function load() {
    try {
      const [pendingRes, activeRes] = await Promise.all([
        fetch("/api/warehouse/seller-returns/pending"),
        fetch("/api/warehouse/seller-returns/active"),
      ]);
      const pendingData = await pendingRes.json();
      const activeData = await activeRes.json();

      if (pendingData.success) setPendingSellers(pendingData.sellers);
      if (activeData.success) setActiveBatches(activeData.batches);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleGenerateQR() {
    if (!selectedSeller) return;
    setQrGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/warehouse/seller-returns/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: selectedSeller.sellerId }),
      });
      const data = await res.json();
      if (data.success) {
        const url = await QRCode.toDataURL(data.qrToken, { width: 400, margin: 1 });
        setQrImage(url);
        setBatchInfo({
          batchNumber: data.batchNumber,
          totalQuantity: data.totalQuantity,
          itemsCount: data.itemsCount,
        });
        await load();
      } else {
        setError(data.message || "فشل التوليد");
      }
    } catch {
      setError("فشل الاتصال");
    } finally {
      setQrGenerating(false);
    }
  }

  async function showExistingQR(batch: ActiveBatch) {
    setViewingBatch(batch);
    setLoadingQR(true);
    setError("");
    try {
      const res = await fetch(`/api/warehouse/seller-returns/${batch.id}/qr`);
      const data = await res.json();
      if (data.success) {
        const url = await QRCode.toDataURL(data.qrToken, { width: 400, margin: 1 });
        setQrImage(url);
        setBatchInfo({
          batchNumber: batch.batchNumber,
          totalQuantity: batch.totalQuantity,
          itemsCount: batch.itemsCount,
        });
      } else {
        setError(data.message || "فشل تحميل QR");
      }
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoadingQR(false);
    }
  }

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-teal-600" />
      </div>
    );

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
            <Package className="h-6 w-6 text-teal-600" />
            مرتجعات بانتظار إرجاعها للتجار
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            إدارة دفعات المرتجعات من المستودع إلى التجار.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold hover:bg-gray-200"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          تحديث
        </button>
      </div>

      {/* ═══ دفعات نشطة (تم إنشاؤها) ═══ */}
      {activeBatches.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-black text-gray-800 mb-3 flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            دفعات نشطة ({activeBatches.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeBatches.map((b) => (
              <button
                key={b.id}
                onClick={() => showExistingQR(b)}
                className="text-right bg-white rounded-xl p-4 shadow-sm border-2 border-blue-100 hover:border-blue-400 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-mono text-sm font-black text-gray-900">
                    {b.batchNumber}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      b.status === "PENDING"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {b.status === "PENDING" ? "بانتظار الجامع" : "في الطريق"}
                  </span>
                </div>
                <div className="text-xs font-bold text-gray-700 mb-1">
                  {b.seller.storeName}
                </div>
                <div className="text-[11px] text-gray-500">
                  {b.totalQuantity} منتج · {b.itemsCount} عنصر
                </div>
                <div className="mt-2 text-[10px] font-bold text-blue-700 text-center">
                  اضغط لعرض QR
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ تجار بانتظار إنشاء دفعة ═══ */}
      <div>
        <h2 className="text-lg font-black text-gray-800 mb-3 flex items-center gap-2">
          <Package className="h-5 w-5 text-teal-600" />
          تجار لديهم مرتجعات ({pendingSellers.length})
        </h2>

        {pendingSellers.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-3" />
            <p className="font-bold text-lg text-gray-900">
              لا توجد مرتجعات جديدة
            </p>
            <p className="text-sm text-gray-500">
              كل المرتجعات تم إرسالها للتجار.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingSellers.map((s) => (
              <button
                key={s.sellerId}
                onClick={() => {
                  setSelectedSeller(s);
                  setQrImage("");
                  setBatchInfo(null);
                  setError("");
                }}
                className="text-right bg-white rounded-2xl p-5 shadow-sm border-2 border-teal-100 hover:border-teal-400 transition"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                    <Store className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 truncate">
                      {s.storeName}
                    </div>
                    {s.city && (
                      <div className="text-xs text-gray-500">📍 {s.city}</div>
                    )}
                  </div>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 border border-blue-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-700">
                    منتجات للتاجر:
                  </span>
                  <span className="text-xl font-black text-blue-600">
                    {s.totalQuantity}
                  </span>
                </div>
                <div className="mt-2 text-[10px] text-gray-500 text-center">
                  {s.itemsCount} عنصر · اضغط للتفاصيل
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Modal: إنشاء دفعة جديدة ═══ */}
      {selectedSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black">
                مرتجعات {selectedSeller.storeName}
              </h2>
              <button
                onClick={() => setSelectedSeller(null)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {!qrImage ? (
              <>
                <div className="mb-4 space-y-2">
                  {selectedSeller.items.map((item) => (
                    <div
                      key={item.shipmentItemId}
                      className="flex items-center gap-3 rounded-lg bg-gray-50 p-2.5 border border-gray-100"
                    >
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-200">
                          <Package className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">
                          {item.productName}
                        </div>
                        {item.variantName && (
                          <div className="text-[10px] text-gray-500">
                            {item.variantName}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-500 font-mono">
                          {item.orderNumber}
                        </div>
                      </div>
                      <div className="text-sm font-black text-teal-600">
                        ×{item.quantity}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-blue-50 p-3 mb-4 text-xs text-blue-800 border border-blue-200">
                  ℹ️ سيتم إنشاء "دفعة إرجاع" مع QR للجامع. عند مسحه، تُسلّم البضاعة.
                </div>

                {error && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded mb-3 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                <button
                  onClick={handleGenerateQR}
                  disabled={qrGenerating}
                  className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {qrGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4" />
                  )}
                  إنشاء دفعة إرجاع + QR
                </button>
              </>
            ) : (
              <div className="text-center">
                {batchInfo && (
                  <div className="bg-teal-50 p-3 rounded-lg mb-4 border border-teal-200">
                    <div className="text-xs text-teal-700 font-bold">رقم الدفعة:</div>
                    <div className="text-lg font-mono font-black text-teal-900">
                      {batchInfo.batchNumber}
                    </div>
                  </div>
                )}
                <div className="bg-teal-50 text-teal-700 p-3 rounded-lg text-xs font-bold mb-4">
                  الرجاء مطالبة الجامع بمسح الرمز لاستلام البضاعة.
                </div>
                <div className="mx-auto w-64 h-64 bg-white p-2 rounded-xl border-2 border-teal-600">
                  <img src={qrImage} alt="QR" className="w-full h-full object-contain" />
                </div>
                <button
                  onClick={() => {
                    setSelectedSeller(null);
                    setQrImage("");
                    setBatchInfo(null);
                    load();
                  }}
                  className="mt-6 w-full rounded-lg border-2 border-gray-200 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  إغلاق (الدفعة محفوظة في الأعلى)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Modal: عرض QR لدفعة موجودة ═══ */}
      {viewingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black">دفعة {viewingBatch.batchNumber}</h2>
              <button
                onClick={() => {
                  setViewingBatch(null);
                  setQrImage("");
                  setBatchInfo(null);
                }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {loadingQR ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin h-8 w-8 text-teal-600" />
              </div>
            ) : qrImage ? (
              <div className="text-center">
                <div className="bg-blue-50 p-3 rounded-lg mb-4 text-xs text-blue-800 font-bold">
                  {viewingBatch.seller.storeName} — {viewingBatch.totalQuantity} منتج
                </div>
                <div className="mx-auto w-64 h-64 bg-white p-2 rounded-xl border-2 border-teal-600">
                  <img src={qrImage} alt="QR" className="w-full h-full object-contain" />
                </div>
                <button
                  onClick={() => {
                    setViewingBatch(null);
                    setQrImage("");
                  }}
                  className="mt-6 w-full rounded-lg border-2 border-gray-200 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <div className="text-red-600 text-center py-8">{error}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}