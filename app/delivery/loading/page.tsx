"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { Scan, X, Loader2, AlertCircle, CheckCircle2, Package } from "lucide-react";

function LoadingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shipmentId = searchParams.get("shipmentId");

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannedOrders, setScannedOrders] = useState<any[]>([]);
  const [shipmentData, setShipmentData] = useState<any>(null);
  
  const controlsRef = useRef<any>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scannerDivId = "qr-reader";

  // جلب بيانات الشحنة لمعرفة العدد الإجمالي
  useEffect(() => {
    async function loadShipment() {
      if (!shipmentId) return;
      try {
        const res = await fetch(`/api/delivery/shipments/${shipmentId}`);
        const data = await res.json();
        if (data.success) setShipmentData(data.shipment);
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
          async (result: any, err: any) => {
            if (result) {
              const now = Date.now();
              if (now - lastScanTimeRef.current < 2000) return;
              lastScanTimeRef.current = now;

              const text = result.getText();
              let token = text;
              if (token.includes("/d/")) {
                const match = token.match(/\/d\/([A-Za-z0-9_-]+)/);
                if (match) token = match[1];
              }

              try {
                if (navigator.vibrate) navigator.vibrate(100);
              } catch (e) {}

              handleScanToken(token);
            }
          }
        );
        controlsRef.current = controls;
      } catch (err) {
        console.error(err);
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

  async function handleScanToken(token: string) {
    if (loading) return;

    // منع التكرار في الواجهة
    if (scannedOrders.some(o => o.token === token)) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/delivery/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل قراءة الطرد");
        return;
      }

      // إضافة للقائمة الممسوحة
      setScannedOrders(prev => [
        ...prev,
        { token, orderNumber: data.order.orderNumber, id: data.order.id }
      ]);

    } catch (err) {
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  async function completeLoading() {
    if (!shipmentId) return;
    setLoading(true);
    try {
      // تغيير حالة الشحنة إلى "قيد التوصيل"
      const res = await fetch(`/api/delivery/shipments/${shipmentId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "picked_up" }) // سنفترض وجود هذا الإجراء، أو نغيره لـ delivered لاحقاً
      });
      
      // التوجيه لصفحة التوصيل
      router.push(`/delivery/shipments/${shipmentId}`);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  // التحقق من اكتمال المسح
  const totalItems = shipmentData?.itemsCount || 0;
  const isComplete = totalItems > 0 && scannedOrders.length >= totalItems;

  return (
    <div className="p-4 pt-16 pb-24 lg:p-8 lg:pt-8 min-h-screen" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Package className="h-6 w-6 text-[#ff5c00]" />
          تحميل الشحنة
        </h1>
        <p className="mt-1 text-sm text-gray-500">قم بمسح جميع الطلبيات الموجودة في سيارتك قبل الانطلاق</p>
      </div>

      <div className="mx-auto max-w-lg space-y-4">
        {/* عداد المسح */}
        <div className="rounded-xl border-2 border-[#ff5c00] bg-[#fff4ed] p-4 text-center">
          <div className="text-sm font-bold text-gray-700">تم مسح</div>
          <div className="mt-1 text-3xl font-black text-[#ff5c00]">
            {scannedOrders.length} <span className="text-lg text-gray-500">/ {totalItems || "؟"}</span>
          </div>
        </div>

        {/* الماسح */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          {!scanning ? (
            <button onClick={startScanner} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3.5 text-sm font-bold text-white hover:bg-[#e64a00]">
              <Scan className="h-5 w-5" /> فتح الكاميرا للمسح
            </button>
          ) : (
            <button onClick={stopScanner} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-600">
              <X className="h-5 w-5" /> إيقاف الماسح
            </button>
          )}

          {scanning && (
            <div className="mt-4 overflow-hidden rounded-xl">
              <div id={scannerDivId} className="relative w-full min-h-[300px] bg-black" />
            </div>
          )}

          {error && <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}
        </div>

        {/* قائمة الطلبيات الممسوحة */}
        {scannedOrders.length > 0 && (
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-black">الطلبيات التي تم مسحها</h3>
            <div className="space-y-2">
              {scannedOrders.map((o, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg bg-green-50 p-2 text-sm text-green-800 border border-green-100">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-mono font-bold">{o.orderNumber}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* زر الإكمال */}
        {isComplete && (
          <button onClick={completeLoading} disabled={loading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 py-4 text-base font-black text-white shadow-lg hover:bg-green-700">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            إكمال التحميل والانطلاق
          </button>
        )}
      </div>
    </div>
  );
}

export default function DeliveryLoadingPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#ff5c00]" /></div>}>
      <LoadingContent />
    </Suspense>
  );
}