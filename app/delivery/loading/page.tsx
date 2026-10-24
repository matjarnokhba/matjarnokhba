"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import {
  Scan,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Package,
  Truck,
} from "lucide-react";

type OrderItem = {
  orderId: number;
  orderNumber: string;
  isScanned: boolean;
};

function LoadingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shipmentId = searchParams.get("shipmentId");

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [shipmentVerified, setShipmentVerified] = useState(false);
  const [shipmentNumber, setShipmentNumber] = useState("");

  const controlsRef = useRef<any>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scannerDivId = "qr-reader";

  useEffect(() => {
    async function loadShipment() {
      if (!shipmentId) return;
      try {
        const res = await fetch(`/api/delivery/shipments/${shipmentId}`);
        const data = await res.json();
        if (data.success) {
          setShipmentNumber(data.shipment.shipmentNumber);
          const initialOrders = data.shipment.orders.map((o: any) => ({
            orderId: o.orderId,
            orderNumber: o.orderNumber,
            isScanned: data.shipment.status === "OUT_FOR_DELIVERY",
          }));
          setOrders(initialOrders);

          if (data.shipment.status === "OUT_FOR_DELIVERY") {
            setShipmentVerified(true);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadShipment();
  }, [shipmentId]);

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
              if (now - lastScanTimeRef.current < 1500) return;
              lastScanTimeRef.current = now;
              handleScanResult(result.getText());
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

  function playSound(type: "success" | "error") {
    try {
      const ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
      if (navigator.vibrate) {
        navigator.vibrate(type === "success" ? 100 : [100, 50, 100]);
      }
    } catch (e) {}
  }

  async function handleScanResult(text: string) {
    let token = text.trim();
    let isShipmentToken = false;

    if (token.includes("/sd/")) {
      const match = token.match(/\/sd\/([A-Za-z0-9_-]+)/);
      if (match) token = match[1];
      isShipmentToken = true;
    } else if (token.includes("/d/")) {
      const match = token.match(/\/d\/([A-Za-z0-9_-]+)/);
      if (match) token = match[1];
    }

    if (loading) return;
    setLoading(true);
    setError("");

    try {
      // ═══════════════════════════════════════════
      // 1. QR الشحنة → يُعلِّم كل الطلبات كـ "مستلمة"
      // ═══════════════════════════════════════════
      if (isShipmentToken) {
        const shipmentRes = await fetch(
          `/api/delivery/shipments/by-token/${token}`
        );
        const shipmentData = await shipmentRes.json();

        if (!shipmentRes.ok || !shipmentData.success) {
          playSound("error");
          setError(shipmentData.message || "QR الشحنة غير صحيح");
          return;
        }

        if (shipmentData.shipment.id !== Number(shipmentId)) {
          playSound("error");
          setError("هذا QR شحنة أخرى، ليست الشحنة المفتوحة حالياً");
          return;
        }

        playSound("success");
        setOrders((prev) =>
          prev.map((o) => ({ ...o, isScanned: true }))
        );
        setShipmentVerified(true);
        setError("");
        return;
      }

      // ═══════════════════════════════════════════
      // 2. QR طرد فردي → تعليمه فقط
      // ═══════════════════════════════════════════
      const res = await fetch(`/api/delivery/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          shipmentId: Number(shipmentId),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        playSound("error");
        setError(data.message || "هذا الطرد لا ينتمي لشحنتك");
        return;
      }

      const scannedOrderId = data.order.id;
      const isAlreadyScanned = orders.find(
        (o) => o.orderId === scannedOrderId
      )?.isScanned;

      if (isAlreadyScanned) {
        playSound("success");
        setError("هذا الطرد تم مسحه مسبقاً");
        return;
      }

      playSound("success");
      setError("");
      setOrders((prev) =>
        prev.map((o) =>
          o.orderId === scannedOrderId ? { ...o, isScanned: true } : o
        )
      );
    } catch (err) {
      console.error(err);
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  async function completeLoading() {
    if (!shipmentId) {
      setError("الشحنة غير محددة");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/shipments/${shipmentId}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "picked_up" }),
        }
      );

      if (res.ok) {
        router.push(`/delivery/shipments`);
      } else {
        setError("فشل تحديث حالة الشحنة");
      }
    } catch (err) {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  const totalItems = orders.length;
  const scannedItems = orders.filter((o) => o.isScanned).length;
  const isComplete = totalItems > 0 && scannedItems === totalItems;

  return (
    <div className="p-4 pt-16 pb-24 lg:p-8 lg:pt-8 min-h-screen bg-gray-50" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Package className="h-6 w-6 text-[#ff5c00]" />
          تجهيز الشحنة للخروج
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          امسح QR الشحنة لتأكيد استلام كل الطرود دفعة واحدة.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-4">
        {/* بطاقة تأكيد الشحنة */}
        {shipmentVerified && (
          <div className="rounded-2xl bg-green-50 border-2 border-green-300 p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
              <div>
                <h3 className="font-black text-green-900">
                  تم التحقق من الشحنة {shipmentNumber}
                </h3>
                <p className="text-xs text-green-700 mt-1">
                  كل الطرود ({totalItems}) جاهزة للتحميل. يمكنك الخروج للتوزيع الآن.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* شريط التقدم */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 font-bold mb-1">تم مسح</div>
            <div className="text-2xl font-black">
              <span className="text-green-600">{scannedItems}</span> /{" "}
              {totalItems}
            </div>
          </div>
          <div className="w-1/2 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{
                width: `${
                  totalItems === 0 ? 0 : (scannedItems / totalItems) * 100
                }%`,
              }}
            />
          </div>
        </div>

        {/* زر المسح */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          {!scanning ? (
            <button
              onClick={startScanner}
              disabled={loading || isComplete}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5c00] py-4 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50"
            >
              <Scan className="h-5 w-5" />
              {shipmentVerified ? "مسح طرد إضافي (اختياري)" : "مسح QR الشحنة"}
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-red-50 py-4 text-sm font-bold text-red-600 hover:bg-red-100"
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
              <p className="mt-3 text-center text-xs font-bold text-gray-500 animate-pulse">
                جاري المسح...
              </p>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-100 p-3 text-sm text-red-700 font-bold">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          )}
        </div>

        {/* قائمة الطرود */}
        <div className="grid gap-3 sm:grid-cols-2">
          {orders.map((o) => (
            <div
              key={o.orderId}
              className={`p-4 rounded-xl border-2 transition-colors flex items-center justify-between ${
                o.isScanned
                  ? "bg-green-50 border-green-200"
                  : "bg-orange-50 border-orange-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {o.isScanned ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Package className="h-5 w-5 text-orange-500" />
                )}
                <span
                  className={`font-mono font-bold ${
                    o.isScanned ? "text-green-800" : "text-orange-800"
                  }`}
                >
                  {o.orderNumber}
                </span>
              </div>
              {o.isScanned && (
                <span className="text-xs font-bold text-green-600">
                  تم المسح
                </span>
              )}
            </div>
          ))}
        </div>

        {/* زر التأكيد */}
        {isComplete && (
          <button
            onClick={completeLoading}
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 py-5 text-lg font-black text-white shadow-lg hover:bg-green-700 transition animate-bounce"
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Truck className="h-6 w-6" />
            )}
            تأكيد الاستلام والخروج للتوزيع
          </button>
        )}
      </div>
    </div>
  );
}

export default function DeliveryLoadingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="animate-spin h-8 w-8 text-[#ff5c00]" />
        </div>
      }
    >
      <LoadingContent />
    </Suspense>
  );
}