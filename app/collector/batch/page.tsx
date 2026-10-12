"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ArrowRight,
  QrCode,
  Store,
  MapPin,
  CheckCircle2,
  Truck,
} from "lucide-react";
import QRCode from "qrcode";

type BatchItem = {
  seller: { id: number; storeName: string; city: string | null };
  orderNumber: string;
};

type ActiveBatch = {
  id: number;
  batchNumber: string;
  itemsCount: number;
  totalOrders: number;
  departedAt: string;
  preview: string;
  items: BatchItem[];
};

export default function CollectorBatchPage() {
  const [batch, setBatch] = useState<ActiveBatch | null>(null);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/collector/batches/active");
        const data = await res.json();

        if (!data.success || !data.hasActiveBatch) {
          setError("لا توجد دفعة نشطة");
          return;
        }

        setBatch(data.batch);

        // ═══ توليد رابط QR كامل ═══
        const origin = window.location.origin;
        const fullUrl = data.qrUrl ? `${origin}${data.qrUrl}` : "";
        setQrUrl(fullUrl);
      } catch {
        setError("فشل التحميل");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ═══ Generate QR ═══
  useEffect(() => {
    if (!qrUrl || !canvasRef.current) return;
    if (qrDataUrl) return;

    const canvas = canvasRef.current;

    QRCode.toCanvas(canvas, qrUrl, {
      width: 600,
      margin: 2,
      color: {
        dark: "#1e3a8a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    })
      .then(() => {
        setQrDataUrl(canvas.toDataURL("image/png"));
      })
      .catch((err) => {
        console.error("QR generation failed:", err);
      });
  }, [qrUrl, qrDataUrl]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <Truck className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-3 text-base font-black">لا توجد دفعة نشطة</h2>
          <p className="mt-2 text-xs text-gray-500">{error}</p>
          <Link
            href="/collector"
            className="mt-6 inline-block rounded-full bg-purple-600 px-6 py-2.5 text-sm font-bold text-white"
          >
            العودة للوحة الجمع
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <Link
        href="/collector"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-purple-600"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع
      </Link>

      {/* ═══ Header ═══ */}
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-black">دفعة في الطريق</h1>
            <p className="mt-0.5 text-xs opacity-90">
              أظهر هذا QR لمسؤول المستودع
            </p>
          </div>
        </div>
      </div>

      {/* ═══ QR Card ═══ */}
      <div className="rounded-2xl border-4 border-blue-600 bg-white p-6 shadow-lg">
        <div className="text-center">
          <div className="text-[11px] text-gray-500">رقم الدفعة</div>
          <div className="mt-0.5 font-mono text-lg font-black text-blue-900">
            {batch.batchNumber}
          </div>
        </div>

        {/* QR */}
        <div className="mx-auto my-6 flex max-w-[320px] justify-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Batch QR"
              className="block h-auto w-full rounded-xl"
              style={{ maxWidth: "100%" }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-xl bg-gray-100"
              style={{ width: "100%", aspectRatio: "1 / 1" }}
            >
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          )}
        </div>

        {/* Counters */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-center">
            <div className="text-2xl font-black text-blue-900">
              {batch.totalOrders}
            </div>
            <div className="mt-1 text-[10px] text-blue-700">طلبات</div>
          </div>
          <div className="rounded-xl bg-blue-50 p-3 text-center">
            <div className="text-2xl font-black text-blue-900">
              {batch.itemsCount}
            </div>
            <div className="mt-1 text-[10px] text-blue-700">عنصر</div>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-center text-xs font-bold text-blue-800">
          🔒 لن يعمل هذا الرمز بعد استلامه في المستودع
        </div>
      </div>

      {/* ═══ Items List ═══ */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-black text-gray-700">
          الطرود في هذه الدفعة ({batch.items.length})
        </h2>

        <div className="space-y-2">
          {batch.items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-lg bg-gray-50 p-2.5"
            >
              <Store className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold">
                  {item.seller.storeName}
                </div>
                <div className="text-[10px] text-gray-500">
                  <span className="font-mono">{item.orderNumber}</span>
                  {item.seller.city && <> · {item.seller.city}</>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Info ═══ */}
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
        📋 عند وصولك إلى المستودع:
        <ol className="mt-2 space-y-1 pr-4">
          <li>1. افتح هذه الصفحة</li>
          <li>2. أظهر QR لمسؤول المستودع</li>
          <li>3. سيمسحه ويُكمل الاستلام تلقائيًا</li>
          <li>4. سيصلك إشعار "تم إكمال المهمة"</li>
        </ol>
      </div>
    </div>
  );
}