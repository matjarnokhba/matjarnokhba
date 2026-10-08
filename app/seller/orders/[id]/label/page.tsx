"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, Printer } from "lucide-react";
import QRCode from "qrcode";

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  total: number | string;
  shippingCost: number | string;
  createdAt: string;
  deliveryToken: string | null;
  shippingAddressSnapshot: any;
  customerSnapshot: any;
  items: {
    id: number;
    productName: string;
    variantName: string | null;
    quantity: number;
  }[];
};

type Seller = {
  storeName: string;
  slug: string;
};

export default function OrderLabelPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [orderRes, sellerRes] = await Promise.all([
          fetch(`/api/seller/orders/${orderId}`),
          fetch("/api/seller/profile"),
        ]);

        const orderData = await orderRes.json();
        const sellerData = await sellerRes.json();

        if (!orderRes.ok || !orderData.success) {
          setError(orderData.message || "الطلب غير موجود");
          return;
        }
        if (!sellerRes.ok || !sellerData.success || !sellerData.seller) {
          setError("يجب تسجيل الدخول كتاجر");
          return;
        }

        setOrder(orderData.order);
        setSeller({
          storeName: sellerData.seller.storeName,
          slug: sellerData.seller.slug,
        });

        const token = orderData.order.deliveryToken;
        if (!token) {
          setError("الطلب لا يحتوي على deliveryToken");
          return;
        }

        const origin = window.location.origin;
        const url = `${origin}/d/${token}`;

        if (canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, url, {
            width: 800,
            margin: 1,
            color: { dark: "#0a1f44", light: "#ffffff" },
            errorCorrectionLevel: "H",
          });
          setQrDataUrl(canvasRef.current.toDataURL("image/png"));
        }
      } catch (err) {
        console.error(err);
        setError("فشل التحميل");
      } finally {
        setLoading(false);
      }
    }
    if (orderId) load();
  }, [orderId]);

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

  if (error || !order || !seller) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center text-red-700">
          {error || "حدث خطأ"}
        </div>
      </div>
    );
  }

  const address = order.shippingAddressSnapshot || {};
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-200 p-4 print:bg-white print:p-0">
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* أزرار */}
      <div className="mx-auto mb-2 flex w-full max-w-[500px] gap-2 print:hidden">
        <Link
          href={`/seller/orders/${orderId}`}
          className="flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          رجوع
        </Link>
        <div className="ml-auto">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg bg-[#0a1f44] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#1a2f54]"
          >
            <Printer className="h-4 w-4" />
            طباعة الملصق
          </button>
        </div>
      </div>

      {/* ═══ الملصق ═══ */}
      <div
        className="mx-auto rounded-xl bg-white p-2 shadow-xl print:shadow-none"
        style={{ width: "33%", minWidth: "320px", maxWidth: "500px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b-2 border-[#0a1f44] pb-1">
          <div className="min-w-0 flex-1 truncate text-2xl font-black leading-none text-[#0a1f44]">
            {seller.storeName}
          </div>
          <div className="shrink-0 font-mono text-xl font-black leading-none text-[#ff5c00]">
            {order.orderNumber}
          </div>
        </div>

        {/* QR */}
        <div className="flex justify-center pt-1">
          <div className="rounded-lg border-2 border-[#0a1f44] bg-white p-0.5">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR"
                className="h-48 w-48 object-contain"
              />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#ff5c00]" />
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-sm font-bold leading-none text-gray-600">
          📱 امسح الرمز لبدء التوصيل
        </div>

        {/* Customer Info */}
        <div className="mt-1 rounded-lg border-2 border-gray-300 p-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="shrink-0 text-[10px] font-black uppercase leading-none text-gray-400">
              إلى
            </span>
            <span className="truncate text-2xl font-black leading-none text-[#0a1f44]">
              {address.fullName || "—"}
            </span>
          </div>

          {address.phone && (
            <div
              className="mt-1 font-mono text-xl font-bold leading-none text-gray-800"
              dir="ltr"
            >
              {address.phone}
            </div>
          )}

          {/* العنوان: الشارع + المدينة + الرمز في سطر واحد */}
          <div className="mt-1 text-base leading-tight text-gray-700">
            {address.street && <span>{address.street}، </span>}
            <span>{address.city}</span>
            {address.postalCode && <span> - {address.postalCode}</span>}
          </div>
        </div>

        {/* Totals — سطر واحد */}
        <div className="mt-1 flex items-center justify-between gap-2 border-t-2 border-dashed border-gray-300 pt-1">
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold leading-none text-gray-500">
              عدد:
            </span>
            <span className="text-4xl font-black leading-none text-[#0a1f44]">
              {totalQty}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold leading-none text-gray-500">
              المبلغ:
            </span>
            <span className="text-4xl font-black leading-none text-[#ff5c00]">
              {Number(order.total).toFixed(2)}
            </span>
            <span className="text-sm font-bold leading-none text-gray-500">
              د.م
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-0.5 border-t border-gray-200 pt-0.5 text-center text-xs leading-none text-gray-400">
          متجر نخبة — Matjar Nokhba
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          @page {
            margin: 8mm;
            size: auto;
          }
        }
      `}</style>
    </div>
  );
}