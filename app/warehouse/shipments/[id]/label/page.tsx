"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, Printer, AlertCircle } from "lucide-react";
import QRCode from "qrcode";

type Label = {
  id: number;
  shipmentNumber: string;
  status: string;
  totalCOD: number;
  totalOrders: number;
  itemsCount: number;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  street: string | null;
  district: string | null;
  city: string | null;
  postalCode: string | null;
  parcelCount: number;
  sellers: Array<{ id: number; storeName: string; city: string | null }>;
  cityColor: string | null;
  districtColor: string | null;
  qrToken: string | null;
  qrPreview: string;
};

export default function ShipmentLabelPage() {
  const params = useParams();
  const shipmentId = params.id as string;

  const [label, setLabel] = useState<Label | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/warehouse/shipments/${shipmentId}/label`
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.message || "فشل التحميل");
          return;
        }
        setLabel(data.label);
      } catch {
        setError("فشل الاتصال");
      } finally {
        setLoading(false);
      }
    }
    if (shipmentId) load();
  }, [shipmentId]);

  // ═══ توليد QR ═══
  useEffect(() => {
    if (!label || !label.qrToken || !canvasRef.current) return;
    if (qrDataUrl) return;

    const canvas = canvasRef.current;
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/sd/${label.qrToken}`;

    QRCode.toCanvas(canvas, url, {
      width: 800,
      margin: 1,
      color: { dark: "#0a1f44", light: "#ffffff" },
      errorCorrectionLevel: "H",
    })
      .then(() => setQrDataUrl(canvas.toDataURL("image/png")))
      .catch((err) => console.error("QR gen failed:", err));
  }, [label, qrDataUrl]);

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    );
  }

  if (error || !label) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-3 text-lg font-black">{error}</h2>
          <Link
            href="/warehouse/shipments"
            className="mt-6 inline-block rounded-full bg-teal-600 px-6 py-2.5 text-sm font-bold text-white"
          >
            العودة
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 p-4 print:bg-white print:p-0">
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* ═══ Toolbar (يختفي عند الطباعة) ═══ */}
      <div className="mx-auto mb-4 flex w-full max-w-[600px] items-center justify-between gap-2 print:hidden">
        <Link
          href={`/warehouse/shipments/${shipmentId}`}
          className="flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-teal-600"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          رجوع
        </Link>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-lg bg-[#0a1f44] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#1a2f54]"
        >
          <Printer className="h-4 w-4" />
          طباعة الملصق
        </button>
      </div>

      {/* ═══ الملصق ═══ */}
      <div
        className="mx-auto bg-white shadow-xl print:shadow-none"
        style={{ width: "100%", maxWidth: "600px" }}
      >
        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between border-b-4 border-[#0a1f44] bg-white px-5 py-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              متجر نخبة
            </div>
            <div className="mt-0.5 text-lg font-black text-[#0a1f44]">
              ملصق شحن
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              رقم الشحنة
            </div>
            <div className="font-mono text-xl font-black text-[#ff5c00]">
              {label.shipmentNumber}
            </div>
          </div>
        </div>

        {/* ═══ QR + Parcel Count + Color Bars ═══ */}
        <div className="flex items-stretch border-b-2 border-gray-200">
          {/* ═══ شريط المدينة (يمين) ═══ */}
          {label.cityColor && (
            <div
              className="flex w-12 flex-col items-center justify-center gap-2 py-4"
              style={{ backgroundColor: label.cityColor }}
            >
              <div
                className="text-3xl font-black"
                style={{ color: getContrastText(label.cityColor) }}
              >
                M
              </div>
            </div>
          )}

          {/* QR */}
          <div className="flex flex-1 items-center justify-center bg-white p-4">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR"
                className="h-44 w-44 object-contain"
              />
            ) : (
              <div className="flex h-44 w-44 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              </div>
            )}
          </div>

          {/* ═══ شريط الحي (يسار) ═══ */}
          {label.districtColor && (
            <div
              className="flex w-12 flex-col items-center justify-center gap-2 py-4"
              style={{ backgroundColor: label.districtColor }}
            >
              <div
                className="text-3xl font-black"
                style={{ color: getContrastText(label.districtColor) }}
              >
                H
              </div>
            </div>
          )}

          {/* Parcel count */}
          <div className="flex w-32 flex-col items-center justify-center border-l-2 border-gray-200 bg-[#fff4ed] p-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-gray-500">
              عدد الطرود
            </div>
            <div className="mt-1 text-6xl font-black leading-none text-[#ff5c00]">
              {label.parcelCount}
            </div>
            <div className="mt-2 text-[10px] font-bold text-gray-500">
              {label.itemsCount} منتج
            </div>
          </div>
        </div>

        {/* ═══ Recipient ═══ */}
        <div className="border-b-2 border-gray-200 px-5 py-4">
          <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
            المستلم
          </div>

          <div className="mt-1 text-3xl font-black leading-tight text-[#0a1f44]">
            {label.customerName}
          </div>

          {label.customerPhone && (
            <div
              className="mt-2 font-mono text-2xl font-bold text-gray-800"
              dir="ltr"
            >
              {label.customerPhone}
            </div>
          )}

          <div className="mt-3 text-base leading-snug text-gray-700">
            {label.street && <div>{label.street}</div>}
            {label.district && (
              <div className="text-lg font-bold">{label.district}</div>
            )}
            <div className="text-lg font-black text-[#0a1f44]">
              {label.city}
            </div>
            {label.postalCode && (
              <div
                className="mt-1 font-mono text-sm text-gray-500"
                dir="ltr"
              >
                {label.postalCode}
              </div>
            )}
          </div>
        </div>

        {/* ═══ COD Amount ═══ */}
        <div className="flex items-center justify-between border-b-2 border-gray-200 bg-gray-50 px-5 py-4">
          <div className="text-sm font-black text-gray-700">
            المبلغ المطلوب (COD)
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-[#ff5c00]">
              {label.totalCOD.toFixed(2)}
            </span>
            <span className="mr-1 text-sm font-bold text-gray-500">د.م</span>
          </div>
        </div>

        {/* ═══ Sellers ═══ */}
        {label.sellers.length > 0 && (
          <div className="border-b-2 border-gray-200 px-5 py-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              من
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {label.sellers.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-700"
                >
                  {s.storeName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Footer ═══ */}
        <div className="flex items-center justify-between bg-[#0a1f44] px-5 py-2.5 text-white">
          <div className="text-[10px] font-bold">
            متجر نخبة — Matjar Nokhba
          </div>
          <div className="font-mono text-[10px] opacity-75">
            {new Date(label.createdAt).toLocaleDateString("ar-MA", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* ═══ Print styles ═══ */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            margin: 0 !important;
          }
          @page {
            margin: 8mm;
            size: auto;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}

function getContrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#FFFFFF";
}