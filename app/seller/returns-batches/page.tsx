"use client";

import { useEffect, useState, useRef } from "react";
import {
  Loader2,
  Package,
  X,
  Scan,
  CheckCircle2,
  AlertCircle,
  Clock,
  Truck,
} from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";

type Batch = {
  id: number;
  batchNumber: string;
  status: string;
  totalQuantity: number;
  itemsCount: number;
  createdAt: string;
  pickedUpAt: string | null;
  items: Array<{
    id: number;
    quantity: number;
    shipmentItem: {
      order: { orderNumber: string };
      orderItem: {
        productName: string;
        variantName: string | null;
        imageUrl: string | null;
      };
    };
  }>;
};

export default function SellerReturnsBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{
    batchNumber: string;
    totalQuantity: number;
  } | null>(null);

  const controlsRef = useRef<any>(null);
  const scannerDivId = "qr-reader-batch";

  async function load() {
    try {
      const res = await fetch("/api/seller/returns-batches");
      const data = await res.json();
      if (data.success) setBatches(data.batches);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function startScanner() {
    setShowScanner(true);
    setError("");
    setScanning(true);
    setTimeout(async () => {
      try {
        const container = document.getElementById(scannerDivId);
        if (!container) return;
        container.innerHTML = "";

        const video = document.createElement("video");
        video.setAttribute("playsinline", "true");
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        container.appendChild(video);

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const codeReader = new BrowserMultiFormatReader(hints);

        const controls = await codeReader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video,
          async (result: any) => {
            if (result) {
              await stopScanner();
              await confirm(result.getText());
            }
          }
        );
        controlsRef.current = controls;
      } catch (err) {
        setError("تعذر فتح الكاميرا");
        setScanning(false);
      }
    }, 300);
  }

  async function stopScanner() {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setScanning(false);
    setShowScanner(false);
  }

  async function confirm(token: string) {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/seller/returns-batches/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل التأكيد");
        return;
      }
      setSuccessData({
        batchNumber: data.batchNumber,
        totalQuantity: data.totalQuantity,
      });
      await load();
    } catch {
      setError("فشل الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "PENDING":
        return {
          label: "بانتظار الجامع",
          class: "bg-amber-100 text-amber-700",
          icon: Clock,
        };
      case "PICKED_UP":
        return {
          label: "في الطريق إليك",
          class: "bg-blue-100 text-blue-700",
          icon: Truck,
        };
      default:
        return {
          label: status,
          class: "bg-gray-100 text-gray-700",
          icon: Package,
        };
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
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Package className="h-6 w-6 text-teal-600" />
          مرتجعاتي من المستودع
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          البضاعة المرفوضة التي ستعود إلى متجرك.
        </p>
      </div>

      {successData && (
        <div className="mb-4 rounded-2xl bg-green-50 border-2 border-green-500 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
            <div className="flex-1">
              <h3 className="font-black text-green-900">
                تم استلام الدفعة {successData.batchNumber}
              </h3>
              <p className="text-sm text-green-700 mt-1">
                {successData.totalQuantity} منتج أُضيفت إلى مخزونك.
              </p>
            </div>
            <button
              onClick={() => setSuccessData(null)}
              className="text-green-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={startScanner}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-4 text-sm font-bold text-white shadow-md hover:bg-teal-700 disabled:opacity-50"
        >
          <Scan className="h-5 w-5" />
          مسح QR لاستلام دفعة مرتجعات
        </button>
      </div>

      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-black">امسح رمز دفعة المرتجعات</h3>
              <button
                onClick={stopScanner}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {scanning && (
              <div className="overflow-hidden rounded-xl">
                <div
                  id={scannerDivId}
                  className="relative w-full min-h-[300px] bg-black"
                />
              </div>
            )}
            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {error && !showScanner && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      <h2 className="mb-3 text-base font-black">دفعات المرتجعات</h2>

      {batches.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-3" />
          <p className="font-bold text-lg text-gray-900">
            لا توجد مرتجعات في الطريق
          </p>
          <p className="text-sm text-gray-500">
            ستظهر هنا المرتجعات عند إرسالها من المستودع.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => {
            const statusBadge = getStatusBadge(batch.status);
            const StatusIcon = statusBadge.icon;
            return (
              <div
                key={batch.id}
                className="rounded-xl bg-white p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-mono text-sm font-black">
                      {batch.batchNumber}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(batch.createdAt).toLocaleDateString("ar-MA")}
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusBadge.class}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusBadge.label}
                  </div>
                </div>

                <div className="space-y-2">
                  {batch.items.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg p-2"
                    >
                      {item.shipmentItem.orderItem.imageUrl ? (
                        <img
                          src={item.shipmentItem.orderItem.imageUrl}
                          alt=""
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-200">
                          <Package className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-bold">
                          {item.shipmentItem.orderItem.productName}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          {item.shipmentItem.order.orderNumber}
                        </div>
                      </div>
                      <div className="font-black text-teal-600">
                        ×{item.quantity}
                      </div>
                    </div>
                  ))}
                  {batch.items.length > 3 && (
                    <div className="text-center text-[10px] text-gray-500">
                      + {batch.items.length - 3} منتجات أخرى
                    </div>
                  )}
                </div>

                <div className="mt-3 flex justify-between text-xs border-t border-gray-100 pt-2">
                  <span className="text-gray-500">
                    {batch.itemsCount} عنصر · {batch.totalQuantity} منتج
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}