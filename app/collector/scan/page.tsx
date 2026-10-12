"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  QrCode,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Store,
  Package,
  ArrowRight,
  Wifi,
} from "lucide-react";

type ScannedItem = {
  orderId: number;
  orderNumber: string;
  sellerName: string;
  sellerCity: string | null;
  itemsCount: number;
  scannedAt: Date;
};

export default function CollectorScanPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [successFlash, setSuccessFlash] = useState<string | null>(null);
  const [errorFlash, setErrorFlash] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");

  const scannerRef = useRef<any>(null);
  const scannerDivId = "collector-qr-reader";
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  // ═══ تحميل ما تم مسحه سابقًا (من DB) ═══
  useEffect(() => {
    async function loadScanned() {
      try {
        const res = await fetch("/api/collector/tasks");
        const data = await res.json();
        if (data.success) {
          const collected = (data.tasks || []).filter(
            (t: any) => t.status === "COLLECTED"
          );
          setScannedItems(
            collected.map((t: any) => ({
              orderId: t.orderId,
              orderNumber: t.orderNumber,
              sellerName: t.seller.storeName,
              sellerCity: t.seller.city,
              itemsCount: t.itemsCount,
              scannedAt: new Date(),
            }))
          );
        }
      } catch {}
    }
    loadScanned();
  }, []);

  // ═══ Cleanup ═══
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch {}
      }
    };
  }, []);

  // ═══ تشغيل الماسح (مستمر) ═══
  async function startScanner() {
    setScanError("");
    setScanning(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      await new Promise((r) => setTimeout(r, 150));

      const scanner = new Html5Qrcode(scannerDivId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          // ═══ منع معالجة نفس الكود مرتين متتاليتين ═══
          const now = Date.now();
          if (
            decodedText === lastScanRef.current &&
            now - lastScanTimeRef.current < 2000
          ) {
            return;
          }
          lastScanRef.current = decodedText;
          lastScanTimeRef.current = now;

          // ═══ معالجة بدون إيقاف الماسح ═══
          handleScan(decodedText);
        },
        () => {}
      );
    } catch (err: any) {
      console.error(err);
      setScanError(
        err?.message?.includes("NotAllowedError")
          ? "تم رفض الإذن للكاميرا."
          : "فشل تشغيل الماسح."
      );
      setScanning(false);
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }

  // ═══ معالجة المسح ═══
  async function handleScan(text: string) {
    if (processing) return;

    let token = text.trim();
    if (token.includes("/d/")) {
      const match = token.match(/\/d\/([A-Za-z0-9_-]+)/);
      if (match) token = match[1];
    }

    if (!token || token.length < 20) {
      flashError("رمز غير صحيح");
      return;
    }

    // ═══ فحص محلي: هل ممسوح بالفعل؟ ═══
    setProcessing(true);

    try {
      const res = await fetch(
        `/api/collector/orders/by-token/${token}/collect`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        // ═══ حالة خاصة: ممسوح مسبقًا ═══
        if (data.alreadyCollected) {
          flashError(`⚠️ الطلب ${data.orderNumber} ممسوح بالفعل`);
          return;
        }
        flashError(data.message || "فشل المسح");
        return;
      }

      // ═══ نجاح ═══
      const newItem: ScannedItem = {
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        sellerName: data.sellerName || "—",
        sellerCity: data.sellerCity || null,
        itemsCount: data.itemsCount || 1,
        scannedAt: new Date(),
      };

      setScannedItems((prev) => {
        // تجنب التكرار في الواجهة
        if (prev.some((i) => i.orderId === newItem.orderId)) return prev;
        return [newItem, ...prev];
      });

      flashSuccess(`✅ تم استلام ${data.orderNumber}`);

      // ═══ صوت/اهتزاز (اختياري) ═══
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(80);
      }
    } catch {
      flashError("فشل الاتصال");
    } finally {
      setProcessing(false);
    }
  }

  function flashSuccess(msg: string) {
    setSuccessFlash(msg);
    setTimeout(() => setSuccessFlash(null), 2000);
  }

  function flashError(msg: string) {
    setErrorFlash(msg);
    setTimeout(() => setErrorFlash(null), 2500);
  }

  // ═══ المجموع حسب التاجر ═══
  const bySeller = scannedItems.reduce(
    (acc, item) => {
      const key = item.sellerName;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, ScannedItem[]>
  );

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <QrCode className="h-6 w-6 text-purple-600" />
          مسح الطرود
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          امسح ملصقات الطرود واحدة تلو الأخرى
        </p>
      </div>

      {/* ═══ Success/Error flash ═══ */}
      {successFlash && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700 shadow-sm">
          <CheckCircle2 className="h-5 w-5" />
          {successFlash}
        </div>
      )}
      {errorFlash && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 shadow-sm">
          <AlertCircle className="h-5 w-5" />
          {errorFlash}
        </div>
      )}

      {/* ═══ Scanner ═══ */}
      <div className="mx-auto mb-5 max-w-lg rounded-2xl bg-white p-5 shadow-sm">
        {!scanning ? (
          <button
            onClick={startScanner}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-4 text-sm font-bold text-white transition hover:bg-purple-700"
          >
            <QrCode className="h-5 w-5" />
            فتح الكاميرا
          </button>
        ) : (
          <button
            onClick={stopScanner}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 py-4 text-sm font-bold text-red-600"
          >
            <X className="h-5 w-5" />
            إيقاف الماسح
          </button>
        )}

        {scanning && (
          <div className="mt-4 overflow-hidden rounded-xl">
            <div id={scannerDivId} className="w-full" />
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
              <Wifi className="h-3.5 w-3.5 animate-pulse text-green-600" />
              <span>الماسح يعمل — امسح الطرد التالي</span>
            </div>
          </div>
        )}

        {!scanning && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="mb-2 text-xs font-bold text-gray-700">
              أو إدخال يدوي
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCode.trim()) {
                  handleScan(manualCode.trim());
                  setManualCode("");
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="الصق رمز الطرد..."
                dir="ltr"
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-purple-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={processing}
                className="rounded-lg bg-purple-600 px-4 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "مسح"}
              </button>
            </form>
          </div>
        )}

        {scanError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{scanError}</span>
          </div>
        )}
      </div>

      {/* ═══ Scanned list ═══ */}
      <div className="mx-auto max-w-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900">
            الطرود المستلمة ({scannedItems.length})
          </h2>
          {scannedItems.length > 0 && (
            <button
              onClick={() => router.push("/collector")}
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              لوحة التحكم
            </button>
          )}
        </div>

        {scannedItems.length === 0 ? (
          <div className="rounded-xl bg-white py-12 text-center shadow-sm">
            <Package className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">
              ابدأ بمسح الملصقات
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(bySeller).map(([sellerName, items]) => (
              <div
                key={sellerName}
                className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Store className="h-4 w-4 text-teal-700" />
                  <div className="flex-1">
                    <div className="text-xs font-black text-teal-900">
                      {items[0].sellerCity || "متجر"}
                    </div>
                    <div className="text-sm font-bold text-teal-700">
                      {sellerName}
                    </div>
                  </div>
                  <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {items.length} طرد
                  </span>
                </div>

                <div className="space-y-1.5">
                  {items.map((item) => (
                    <div
                      key={item.orderId}
                      className="flex items-center gap-2 rounded-lg bg-white p-2.5 shadow-sm"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs font-black">
                          {item.orderNumber}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {item.itemsCount} منتج — تم في{" "}
                          {item.scannedAt.toLocaleTimeString("ar-MA", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}