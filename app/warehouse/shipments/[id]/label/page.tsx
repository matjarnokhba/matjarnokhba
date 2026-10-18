"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, Printer, AlertCircle } from "lucide-react";
import QRCode from "qrcode";

type Label = {
  id: number;
  shipmentNumber: string;
  status: string;
  totalCOD: number | string;
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
  ordersCount?: number;
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
  const [qrGenerating, setQrGenerating] = useState(false);

  // ═══ تحميل البيانات ═══
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
    if (loading || !label || !label.qrToken || !canvasRef.current) return;
    if (qrDataUrl) return;

    async function generate() {
      setQrGenerating(true);
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const origin = window.location.origin;
        const url = `${origin}/sd/${label!.qrToken}`;

        await QRCode.toCanvas(canvas, url, {
          width: 800,
          margin: 1,
          color: { dark: "#0a1f44", light: "#ffffff" },
          errorCorrectionLevel: "H",
        });

        setQrDataUrl(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("QR generation failed:", err);
      } finally {
        setQrGenerating(false);
      }
    }
    generate();
  }, [loading, label, qrDataUrl]);

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
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

  const total = Number(label.totalCOD || 0);
  const orderCount = label.ordersCount || label.parcelCount || 1;
  const cityColor = label.cityColor || null;
  const districtColor = label.districtColor || null;
  const cityTextColor = cityColor ? getContrastText(cityColor) : "#fff";
  const districtTextColor = districtColor
    ? getContrastText(districtColor)
    : "#fff";

  return (
    <div className="min-h-screen bg-gray-200 p-4 print:bg-white print:p-0">
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* ═══ Toolbar ═══ */}
      <div className="mx-auto mb-2 flex w-full max-w-[500px] gap-2 print:hidden">
        <Link
          href={`/warehouse/shipments/${shipmentId}`}
          className="flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          رجوع
        </Link>
        <div className="ml-auto">
          <button
            onClick={handlePrint}
            disabled={qrGenerating}
            className="flex items-center gap-2 rounded-lg bg-[#0a1f44] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#1a2f54] disabled:opacity-50"
          >
            {qrGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            طباعة الملصق
          </button>
        </div>
      </div>

      {/* ═══ الملصق ═══ */}
      <div
        className="mx-auto rounded-xl bg-white p-2 shadow-xl print:shadow-none"
        style={{ width: "33%", minWidth: "320px", maxWidth: "500px" }}
      >
        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between gap-2 border-b-2 border-[#0a1f44] pb-1">
          <div className="min-w-0 flex-1 truncate text-2xl font-black leading-none text-[#0a1f44]">
            متجر نخبة
          </div>
          <div className="shrink-0 font-mono text-xl font-black leading-none text-[#ff5c00]">
            {label.shipmentNumber}
          </div>
        </div>

        {/* ═══ QR + Color Bars ═══ */}
        <div className="mt-1 flex items-stretch justify-center gap-1">
          {/* شريط المدينة (يمين) */}
          {cityColor && (
            <div
              className="flex w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: cityColor }}
            >
              <span
                className="text-xl font-black"
                style={{ color: cityTextColor }}
              >
                M
              </span>
            </div>
          )}

          {/* QR */}
          <div className="flex-1">
            <div className="flex justify-center">
              <div className="rounded-lg border-2 border-[#0a1f44] bg-white p-0.5">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR"
                    className="h-44 w-44 object-contain"
                  />
                ) : (
                  <div className="flex h-44 w-44 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-[#ff5c00]" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* شريط الحي (يسار) */}
          {districtColor && (
            <div
              className="flex w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: districtColor }}
            >
              <span
                className="text-xl font-black"
                style={{ color: districtTextColor }}
              >
                H
              </span>
            </div>
          )}
        </div>

        <div className="mt-1 text-center text-sm font-bold leading-none text-gray-600">
          📱 امسح الرمز لبدء التوصيل
        </div>

        {/* ═══ Recipient ═══ */}
        <div className="mt-1 rounded-lg border-2 border-gray-300 p-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="shrink-0 text-[10px] font-black uppercase leading-none text-gray-400">
              إلى
            </span>
            <span className="text-2xl font-black leading-none text-[#0a1f44]">
              {label.customerName || "—"}
            </span>
          </div>

          {label.customerPhone && (
            <div
              className="mt-1 font-mono text-xl font-bold leading-none text-gray-800"
              dir="ltr"
            >
              {label.customerPhone}
            </div>
          )}

          <div className="mt-1 text-base leading-tight text-gray-700">
            {label.street && <div>{label.street}</div>}
            {label.district && <div className="font-bold">{label.district}</div>}
            {label.city && <div className="font-bold">{label.city}</div>}
            {label.postalCode && (
              <div className="font-mono text-sm" dir="ltr">
                {label.postalCode}
              </div>
            )}
          </div>
        </div>

        {/* ═══ Totals ═══ */}
        <div className="mt-1 flex items-center justify-between gap-2 border-t-2 border-dashed border-gray-300 pt-1">
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold leading-none text-gray-500">
              عدد:
            </span>
            <span className="text-4xl font-black leading-none text-[#0a1f44]">
              {label.itemsCount}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold leading-none text-gray-500">
              المبلغ:
            </span>
            <span className="text-4xl font-black leading-none text-[#ff5c00]">
              {total.toFixed(2)}
            </span>
            <span className="text-sm font-bold leading-none text-gray-500">
              د.م
            </span>
          </div>
        </div>

        {/* ═══ Order Count (if > 1) ═══ */}
        {orderCount > 1 && (
          <div className="mt-1 rounded bg-[#fff4ed] py-0.5 text-center text-xs font-black leading-none text-[#ff5c00]">
            {orderCount} طلبات
          </div>
        )}

        {/* ═══ Footer ═══ */}
        <div className="mt-0.5 border-t border-gray-200 pt-0.5 text-center text-xs leading-none text-gray-400">
          متجر نخبة — Matjar Nokhba
        </div>
      </div>

      {/* ═══ Print styles ═══ */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
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
  if (!hex) return "#FFFFFF";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#FFFFFF";
}