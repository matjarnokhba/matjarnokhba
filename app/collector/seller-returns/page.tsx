"use client";

import { useEffect, useState, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import {
  Scan,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Store,
  Truck,
  Package,
  Clock,
  RefreshCw,
} from "lucide-react";

type HistoryBatch = {
  id: number;
  batchNumber: string;
  status: string;
  totalQuantity: number;
  itemsCount: number;
  pickedUpAt: string | null;
  confirmedAt: string | null;
  seller: { storeName: string };
};

export default function CollectorSellerReturnsPage() {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{
    batchNumber: string;
    storeName: string;
    totalQuantity: number;
  } | null>(null);

  const [history, setHistory] = useState<HistoryBatch[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const controlsRef = useRef<any>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scannerDivId = "qr-reader";

  async function loadHistory() {
    try {
      const res = await fetch("/api/collector/seller-returns/history");
      const data = await res.json();
      if (data.success) setHistory(data.batches);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function startScanner() {
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
              const now = Date.now();
              if (now - lastScanTimeRef.current < 2000) return;
              lastScanTimeRef.current = now;
              try {
                if (navigator.vibrate) navigator.vibrate(100);
              } catch {}
              await pickup(result.getText());
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
  }

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  async function pickup(token: string) {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/collector/seller-returns/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل الاستلام");
        return;
      }
      await stopScanner();
      setSuccessData({
        batchNumber: data.batchNumber,
        storeName: data.storeName,
        totalQuantity: data.totalQuantity,
      });
      await loadHistory();
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  if (successData) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8 flex justify-center" dir="rtl">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg border border-green-100">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">
            تم استلام الدفعة
          </h1>
          <div className="mt-6 space-y-2">
            <div className="rounded-lg bg-gray-50 p-3 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-600">
                رقم الدفعة:
              </span>
              <span className="font-mono font-black text-green-600">
                {successData.batchNumber}
              </span>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-600">التاجر:</span>
              <span className="font-bold text-gray-900">
                {successData.storeName}
              </span>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-600">
                عدد المنتجات:
              </span>
              <span className="text-lg font-black text-green-600">
                {successData.totalQuantity}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setSuccessData(null);
              setError("");
            }}
            className="mt-8 w-full rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white hover:bg-[#e64a00]"
          >
            استلام دفعة أخرى
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 pb-24 lg:p-8 lg:pt-8 min-h-screen" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Store className="h-6 w-6 text-purple-600" />
          مرتجعات التجار
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          استلام دفعات المرتجعات من المستودع لتوصيلها للتجار.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
        {/* ═══ الماسح ═══ */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          {!scanning ? (
            <button
              onClick={startScanner}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-3.5 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              <Scan className="h-5 w-5" /> امسح QR دفعة مرتجعات
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-600 hover:bg-red-100"
            >
              <X className="h-5 w-5" /> إيقاف الماسح
            </button>
          )}

          {scanning && (
            <div className="mt-4 overflow-hidden rounded-xl">
              <div
                id={scannerDivId}
                className="relative w-full min-h-[300px] bg-black"
              />
            </div>
          )}

          {loading && (
            <div className="mt-3 text-center text-sm font-bold text-blue-600">
              جاري التحقق...
            </div>
          )}
          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          )}
        </div>

        {/* ═══ سجل الدفعات ═══ */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
            <h2 className="text-base font-black flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-600" />
              سجل الدفعات ({history.length})
            </h2>
            <button
              onClick={loadHistory}
              className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-bold hover:bg-gray-200"
            >
              <RefreshCw className="h-3 w-3" />
              تحديث
            </button>
          </div>

          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-6 w-6 text-purple-600" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm font-bold text-gray-500">
                لم تستلم أي دفعات بعد
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                ستظهر هنا الدفعات التي تستلمها من المستودع.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {history.map((batch) => {
                const isConfirmed = batch.status === "CONFIRMED";
                return (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          isConfirmed
                            ? "bg-green-100 text-green-600"
                            : "bg-blue-100 text-blue-600"
                        }`}
                      >
                        {isConfirmed ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Truck className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <div className="font-mono text-sm font-black text-gray-900">
                          {batch.batchNumber}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {batch.seller.storeName} · {batch.totalQuantity} منتج
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-[10px] font-bold ${
                          isConfirmed ? "text-green-600" : "text-blue-600"
                        }`}
                      >
                        {isConfirmed ? "✅ سلّمت للتاجر" : "🚚 في الطريق للتاجر"}
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(batch.pickedUpAt || "").toLocaleDateString(
                          "ar-MA"
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}