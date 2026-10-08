"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Printer,
  QrCode,
} from "lucide-react";
import QRCode from "qrcode";

type OrderItem = {
  id: number;
  productName: string;
  variantName: string | null;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type Order = {
  id: number;
  orderNumber: string;
  source: string;
  status: string;
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  createdAt: string;
  deliveredAt: string | null;
  customerSnapshot: any;
  shippingAddressSnapshot: any;
  items: OrderItem[];
};

type Seller = {
  storeName: string;
  slug: string;
};

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ═══ طباعة تلقائية عند ?print=1 ═══
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1" && !loading && order) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, order]);

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

        // ═══ توليد QR للفاتورة ═══
        // يحتوي على رابط يفتح ملف الفاتورة
        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : "https://matjarnokhba-lyart.vercel.app";
        const url = `${origin}/seller/orders/${orderId}/invoice`;

        if (qrCanvasRef.current) {
          await QRCode.toCanvas(qrCanvasRef.current, url, {
            width: 400,
            margin: 1,
            color: { dark: "#0a1f44", light: "#ffffff" },
            errorCorrectionLevel: "M",
          });
          setQrDataUrl(qrCanvasRef.current.toDataURL("image/png"));
        }
      } catch (err) {
        console.error(err);
        setError("فشل تحميل البيانات");
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

  const customer = order.customerSnapshot || {};
  const address = order.shippingAddressSnapshot || {};
  const isInStore = order.source === "IN_STORE";

  return (
    <div className="min-h-screen bg-gray-100 p-4 print:bg-white print:p-0">
      {/* Canvas مخفي */}
      <canvas ref={qrCanvasRef} style={{ display: "none" }} />

      {/* ═══ أزرار (تُخفى عند الطباعة) ═══ */}
      <div className="mx-auto mb-4 flex max-w-2xl gap-2 print:hidden">
        <Link
          href={`/seller/orders/${orderId}`}
          className="flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          رجوع
        </Link>

        <div className="ml-auto flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
          >
            <Printer className="h-4 w-4" />
            طباعة الفاتورة
          </button>
        </div>
      </div>

      {/* ═══ الفاتورة ═══ */}
      <div className="mx-auto max-w-2xl bg-white p-8 shadow-lg print:shadow-none">
        {/* ═══ Header ═══ */}
        <div className="mb-6 flex items-start justify-between gap-4 border-b-2 border-[#0a1f44] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#0a1f44] to-purple-600 text-lg font-black text-white">
                ن
              </div>
              <div>
                <div className="text-xl font-black text-[#0a1f44]">
                  {seller.storeName}
                </div>
                <div className="text-[11px] text-gray-500">
                  متجر نخبة — Matjar Nokhba
                </div>
              </div>
            </div>
          </div>

          <div className="text-left">
            <div className="text-2xl font-black text-[#ff5c00]">فاتورة</div>
            <div className="mt-1 font-mono text-sm font-bold text-[#0a1f44]">
              {order.orderNumber}
            </div>
            <div className="mt-0.5 text-[11px] text-gray-500">
              {new Date(order.createdAt).toLocaleDateString("ar-MA", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
        </div>

        {/* ═══ شارة نوع الطلب ═══ */}
        <div className="mb-5 flex items-center justify-between">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
              isInStore
                ? "bg-[#fff4ed] text-[#ff5c00]"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            {isInStore ? "🏪 طلب من المحل" : "🌐 طلب إلكتروني"}
          </div>

          <div className="text-[11px] text-gray-500">
            الحالة:{" "}
            <strong className="text-[#0a1f44]">
              {order.status === "DELIVERED"
                ? "تم التسليم"
                : order.status === "NEW"
                  ? "جديد"
                  : order.status}
            </strong>
          </div>
        </div>

        {/* ═══ معلومات العميل ═══ */}
        <div className="mb-5 rounded-lg bg-gray-50 p-4">
          <div className="mb-2 text-xs font-black text-[#0a1f44]">
            بيانات العميل
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <span className="text-gray-500">الاسم:</span>{" "}
              <strong>{customer.name || "—"}</strong>
            </div>
            {customer.phone && (
              <div>
                <span className="text-gray-500">الهاتف:</span>{" "}
                <strong dir="ltr">{customer.phone}</strong>
              </div>
            )}
            {address.city && (
              <div className="sm:col-span-2">
                <span className="text-gray-500">العنوان:</span>{" "}
                <strong>
                  {address.city}
                  {address.street ? ` — ${address.street}` : ""}
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* ═══ جدول المنتجات ═══ */}
        <div className="mb-5 overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-[#0a1f44] text-white">
              <tr>
                <th className="px-3 py-2.5 text-right font-bold">#</th>
                <th className="px-3 py-2.5 text-right font-bold">المنتج</th>
                <th className="px-3 py-2.5 text-center font-bold">الكمية</th>
                <th className="px-3 py-2.5 text-left font-bold">السعر</th>
                <th className="px-3 py-2.5 text-left font-bold">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="px-3 py-2.5 text-gray-500">{idx + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-[#0a1f44]">
                      {item.productName}
                    </div>
                    {item.variantName && (
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        {item.variantName}
                      </div>
                    )}
                    <div className="font-mono text-[9px] text-gray-400">
                      {item.sku}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-2.5 text-left font-mono">
                    {Number(item.unitPrice).toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-left font-mono font-bold">
                    {Number(item.total).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ═══ الإجمالي + QR ═══ */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* QR */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR"
                className="h-24 w-24 shrink-0 rounded-lg border-2 border-[#0a1f44] p-1"
              />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-white">
                <QrCode className="h-8 w-8 text-gray-300" />
              </div>
            )}
            <div className="text-[10px] leading-relaxed text-gray-600">
              <strong className="block text-[11px] text-[#0a1f44]">
                📱 امسح الرمز
              </strong>
              لعرض نسخة رقمية من الفاتورة
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">المجموع الفرعي</span>
                <span className="font-mono font-bold">
                  {Number(order.subtotal).toFixed(2)} د.م
                </span>
              </div>

              {!isInStore && Number(order.shippingCost) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">الشحن</span>
                  <span className="font-mono font-bold">
                    {Number(order.shippingCost).toFixed(2)} د.م
                  </span>
                </div>
              )}

              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>الخصم</span>
                  <span className="font-mono font-bold">
                    -{Number(order.discount).toFixed(2)} د.م
                  </span>
                </div>
              )}

              <div className="mt-2 flex justify-between border-t-2 border-[#0a1f44] pt-2.5 text-sm">
                <span className="font-black text-[#0a1f44]">الإجمالي</span>
                <span className="font-mono text-lg font-black text-[#ff5c00]">
                  {Number(order.total).toFixed(2)} د.م
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Footer ═══ */}
        <div className="mt-6 border-t border-dashed border-gray-300 pt-4 text-center">
          <div className="text-[10px] text-gray-500">
            شكراً لتعاملكم معنا — {seller.storeName}
          </div>
          <div className="mt-1 text-[9px] text-gray-400">
            هذه الفاتورة صادرة إلكترونياً من متجر نخبة
          </div>
        </div>
      </div>

      {/* ═══ أنماط الطباعة ═══ */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          @page {
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}