"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, Printer, QrCode } from "lucide-react";

type ShipmentData = {
  id: number;
  shipmentNumber: string;
  status: string;
  totalCOD: number;
  totalOrders: number;
  customer: { name: string; phone: string | null } | null;
  orders: Array<{
    orderId: number;
    orderNumber: string;
    shippingAddressSnapshot: any;
    items: Array<{ quantity: number }>;
  }>;
};

export default function ShipmentLabelPage() {
  const params = useParams();
  const shipmentId = params.id as string;

  const [shipment, setShipment] = useState<ShipmentData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [shipRes, qrRes] = await Promise.all([
          fetch(`/api/admin/shipments/${shipmentId}`),
          fetch(`/api/admin/shipments/${shipmentId}/qr`),
        ]);

        const shipData = await shipRes.json();
        const qrData = await qrRes.json();

        if (!shipRes.ok || !shipData.success) {
          setError(shipData.message || "الشحنة غير موجودة");
          return;
        }
        if (!qrRes.ok || !qrData.success) {
          setError(qrData.message || "QR غير متاح");
          return;
        }

        setShipment(shipData.shipment);
        setQrDataUrl(qrData.qrDataUrl);
      } catch (err) {
        console.error(err);
        setError("فشل التحميل");
      } finally {
        setLoading(false);
      }
    }
    if (shipmentId) load();
  }, [shipmentId]);

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

  if (error || !shipment) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center text-red-700">
          {error || "حدث خطأ"}
        </div>
      </div>
    );
  }

  // ═══ العنوان (من أول طلب) ═══
  const firstOrder = shipment.orders[0];
  const address = firstOrder?.shippingAddressSnapshot || {};

  const totalItems = shipment.orders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
    0
  );

  return (
    <div className="min-h-screen bg-gray-200 p-4 print:bg-white print:p-0">
      <div className="mx-auto mb-2 flex w-full max-w-[500px] gap-2 print:hidden">
        <Link
          href={`/admin/shipments/${shipmentId}`}
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
          <div className="min-w-0 flex-1 truncate text-lg font-black leading-none text-[#0a1f44]">
            شحنة توصيل
          </div>
          <div className="shrink-0 font-mono text-sm font-black leading-none text-[#ff5c00]">
            {shipment.shipmentNumber}
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

        <div className="text-center text-xs font-bold leading-none text-gray-600">
          📱 امسح الرمز لبدء التوصيل
        </div>

        {/* Customer Info */}
        {firstOrder && (
          <div className="mt-1 rounded-lg border-2 border-gray-300 p-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="shrink-0 text-[10px] font-black uppercase leading-none text-gray-400">
                إلى
              </span>
              <span className="truncate text-xl font-black leading-none text-[#0a1f44]">
                {address.fullName || shipment.customer?.name || "—"}
              </span>
            </div>

            {address.phone && (
              <div
                className="mt-1 font-mono text-base font-bold leading-none text-gray-800"
                dir="ltr"
              >
                {address.phone}
              </div>
            )}

            <div className="mt-1 text-sm leading-tight text-gray-700">
              {address.street && <span>{address.street}، </span>}
              <span>{address.city}</span>
              {address.postalCode && <span> - {address.postalCode}</span>}
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="mt-1 flex items-center justify-between gap-2 border-t-2 border-dashed border-gray-300 pt-1">
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold leading-none text-gray-500">
              عدد:
            </span>
            <span className="text-3xl font-black leading-none text-[#0a1f44]">
              {totalItems}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold leading-none text-gray-500">
              المبلغ:
            </span>
            <span className="text-3xl font-black leading-none text-[#ff5c00]">
              {shipment.totalCOD.toFixed(2)}
            </span>
            <span className="text-xs font-bold leading-none text-gray-500">
              د.م
            </span>
          </div>
        </div>

        {/* Orders count */}
        {shipment.totalOrders > 1 && (
          <div className="mt-0.5 text-center text-[10px] font-bold text-gray-500">
            تشمل {shipment.totalOrders} طلبات
          </div>
        )}

        {/* Footer */}
        <div className="mt-0.5 border-t border-gray-200 pt-0.5 text-center text-[10px] leading-none text-gray-400">
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