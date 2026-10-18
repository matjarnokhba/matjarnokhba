"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Scan,
  Trash2,
  Plus,
  Minus,
  Check,
  X,
  ShoppingBag,
  AlertCircle,
  Printer,
  Package,
  CheckCircle2,
  Truck,
} from "lucide-react";

// ═══════ الأنواع ═══════
type OptionValue = {
  id: number;
  value: string;
  colorHex: string | null;
  order: number;
};

type Option = {
  id: number;
  name: string;
  type: string;
  order: number;
  values: OptionValue[];
};

type Variant = {
  id: number;
  sku: string;
  price: number;
  available: number;
  isDefault: boolean;
  optionValueIds: number[];
  optionValueLabels: string[];
};

type ScannedProduct = {
  id: number;
  productCode: string;
  name: string;
  image: string | null;
  price: number;
  options: Option[];
  variants: Variant[];
};

type CartLine = {
  variantId: number;
  productId: number;
  productName: string;
  variantLabel: string;
  image: string | null;
  price: number;
  quantity: number;
  available: number;
};

type Mode = "product" | "order";

type OrderScanResult =
  | { status: "success"; orderNumber: string; orderId: number }
  | { status: "already_ready"; orderNumber: string; orderId: number }
  | { status: "error"; message: string };

// ═══════ Component ═══════
function ScannerContent() {
  const searchParams = useSearchParams();
  const initialOrderToken = searchParams.get("orderToken") || "";
  const initialOrderId = searchParams.get("orderId") || "";

  const [mode, setMode] = useState<Mode>(
    initialOrderToken ? "order" : "product"
  );

  // Product-mode state
  const [products, setProducts] = useState<ScannedProduct[]>([]);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");
  const [successOrder, setSuccessOrder] = useState<{
    id: number;
    orderNumber: string;
    total: number;
  } | null>(null);

  // Order-mode state
  const [orderResult, setOrderResult] = useState<OrderScanResult | null>(null);

  // Shared state
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const scannerRef = useRef<any>(null);
  const scannerDivId = "qr-reader";

  // ═══ لا تنفيذ تلقائي — فقط عرض ملخص الطلب (بدون إجراء) ═══
  const [orderSummary, setOrderSummary] = useState<{
    id: number;
    orderNumber: string;
    itemsCount: number;
    total: string;
  } | null>(null);

  useEffect(() => {
    if (!initialOrderId) return;

    let cancelled = false;
    async function loadSummary() {
      try {
        const res = await fetch(`/api/seller/orders/${initialOrderId}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.success && data.order) {
          setOrderSummary({
            id: data.order.id,
            orderNumber: data.order.orderNumber,
            itemsCount: data.order.items?.length ?? 0,
            total: data.order.total,
          });
        }
      } catch {
        // silent — summary is optional
      }
    }
    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [initialOrderId]);

  // ═══ Cleanup on unmount ═══
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch {}
      }
    };
  }, []);

  // ═══ Start Scanner ═══
  async function startScanner() {
    setScanError("");
    setScanning(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      await new Promise((r) => setTimeout(r, 100));

      const scanner = new Html5Qrcode(scannerDivId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          if (mode === "product") {
            handleProductScan(decodedText);
          } else {
            handleOrderScan(decodedText);
          }
        },
        () => {}
      );
    } catch (err: any) {
      console.error(err);
      setScanError(
        err?.message?.includes("NotAllowedError")
          ? "تم رفض الإذن للكاميرا. افتح الإعدادات واسمح بالوصول."
          : "فشل تشغيل الماسح. تأكد من وجود كاميرا."
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

  // ═══════════════════════════════════════════
  // PRODUCT MODE (existing)
  // ═══════════════════════════════════════════
  async function handleProductScan(text: string) {
    await stopScanner();
    let code = text.trim();

    if (code.includes("/p/")) {
      const match = code.match(/\/p\/([A-Za-z0-9_-]+)/);
      if (match) code = match[1];
    }

    if (code.includes("/product/")) {
      setScanError("استخدم QR جديد من زر (بطاقة المنتج)");
      return;
    }

    await loadByCode(code);
  }

  async function loadByCode(code: string) {
    setLoading(true);
    setScanError("");

    try {
      const res = await fetch(`/api/seller/products/by-code/${code}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setScanError(data.message || "المنتج غير موجود");
        return;
      }

      const product: ScannedProduct = data.product;

      if (!product.variants || product.variants.length === 0) {
        setScanError(
          `⚠️ المنتج "${product.name}" لا يحتوي على أي variant نشط.`
        );
        return;
      }

      setProducts((prev) => {
        const exists = prev.some((p) => p.id === product.id);
        return exists ? prev : [...prev, product];
      });

      const dv =
        product.variants.find((v) => v.isDefault) || product.variants[0];
      addLine(product, dv);
    } catch (err) {
      console.error(err);
      setScanError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  function addLine(product: ScannedProduct, variant: Variant) {
    const label = variant.optionValueLabels.join(" / ");

    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if (existing) {
        const max = existing.available;
        return prev.map((l) =>
          l.variantId === variant.id
            ? { ...l, quantity: Math.min(l.quantity + 1, max) }
            : l
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          productId: product.id,
          productName: product.name,
          variantLabel: label,
          image: product.image,
          price: variant.price,
          quantity: 1,
          available: variant.available,
        },
      ];
    });
  }

  function changeVariant(productId: number, newVariant: Variant) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setLines((prev) => {
      const others = prev.filter((l) => l.productId !== productId);
      return [
        ...others,
        {
          variantId: newVariant.id,
          productId: product.id,
          productName: product.name,
          variantLabel: newVariant.optionValueLabels.join(" / "),
          image: product.image,
          price: newVariant.price,
          quantity: 1,
          available: newVariant.available,
        },
      ];
    });
  }

  function updateQty(variantId: number, delta: number) {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (l.variantId !== variantId) return [l];
        const q = l.quantity + delta;
        if (q <= 0) return [];
        return [{ ...l, quantity: Math.min(q, l.available) }];
      })
    );
  }

  function removeLine(variantId: number) {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);

  async function submitOrder() {
    if (lines.length === 0) return;
    setSubmitting(true);
    setScanError("");

    try {
      const res = await fetch("/api/seller/in-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
          })),
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          note: note.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setScanError(data.message || "فشل إنشاء الطلب");
        return;
      }

      setSuccessOrder({
        id: data.order.id,
        orderNumber: data.order.orderNumber,
        total: data.order.total,
      });
      setLines([]);
      setProducts([]);
      setCustomerName("");
      setCustomerPhone("");
      setNote("");
      setShowCheckout(false);
    } catch {
      setScanError("فشل الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  }

  // ═══════════════════════════════════════════
  // ORDER MODE (new)
  // ═══════════════════════════════════════════
  async function handleOrderScan(text: string) {
    await stopScanner();
    let token = text.trim();

    // Extract from /d/[token]
    if (token.includes("/d/")) {
      const match = token.match(/\/d\/([A-Za-z0-9_-]+)/);
      if (match) token = match[1];
    }

    await handleOrderToken(token);
  }

  async function handleOrderToken(rawToken: string) {
  if (loading) return;

  // ═══ استخراج UUID من أي رابط ملصق ═══
  let token = rawToken.trim();

  // إذا كان رابط كامل → استخرج UUID
  if (token.includes("/d/")) {
    const match = token.match(/\/d\/([A-Za-z0-9_-]+)/);
    if (match) token = match[1];
  } else if (token.includes("/r/")) {
    setOrderResult({
      status: "error",
      message: "هذا رمز إرجاع — ليس طلبية. استخدم الماسح العام.",
    });
    return;
  } else if (token.includes("/p/")) {
    setOrderResult({
      status: "error",
      message: "هذا رمز منتج — ليس طلبية.",
    });
    return;
  } else if (token.includes("/sd/") || token.includes("/cb/")) {
    setOrderResult({
      status: "error",
      message: "هذا رمز شحنة/دفعة — ليس طلبية.",
    });
    return;
  }

  // ═══ تحقق الطول ═══
  if (!token || token.length < 20) {
    setOrderResult({
      status: "error",
      message: "رمز غير صحيح — امسح QR الطلبية (UUID طويل)",
    });
    return;
  }

  setLoading(true);
  setScanError("");

  try {
    const res = await fetch(
      `/api/seller/orders/by-token/${encodeURIComponent(token)}/ready`,
      { method: "POST" }
    );

    // ═══ قراءة آمنة (حتى لو استجابة فارغة) ═══
    const rawText = await res.text();
    let data: any = null;

    if (rawText.trim().length > 0) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }
    }

    if (!res.ok || !data || !data.success) {
      setOrderResult({
        status: "error",
        message:
          data?.message ||
          `فشل الاتصال بالخادم (${res.status}) — جرّب مرة أخرى`,
      });
      return;
    }

    // ═══ نجاح ═══
    if (data.alreadyReady) {
      setOrderResult({
        status: "already_ready",
        orderNumber: data.orderNumber,
        orderId: data.orderId,
      });
    } else {
      setOrderResult({
        status: "success",
        orderNumber: data.orderNumber,
        orderId: data.orderId,
      });
    }
  } catch (err) {
    setOrderResult({
      status: "error",
      message: "فشل الاتصال بالخادم",
    });
  } finally {
    setLoading(false);
  }
}

  // ═══════════════════════════════════════════
  // SUCCESS SCREEN (Product Mode)
  // ═══════════════════════════════════════════
  if (successOrder && mode === "product") {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <Check className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="mt-5 text-2xl font-black">تم إنشاء الطلب!</h1>
          <p className="mt-2 text-sm text-gray-500">
            رقم الطلب:{" "}
            <strong className="font-mono text-[#ff5c00]">
              {successOrder.orderNumber}
            </strong>
          </p>
          <p className="mt-1 text-lg font-black text-[#ff5c00]">
            {successOrder.total.toFixed(2)} د.م
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => {
                window.open(
                  `/seller/orders/${successOrder.id}/invoice?print=1`,
                  "_blank"
                );
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#0a1f44] py-3 text-sm font-bold text-white transition hover:bg-[#1a2f54]"
            >
              <Printer className="h-4 w-4" />
              طباعة الفاتورة
            </button>
            <button
              onClick={() => setSuccessOrder(null)}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
            >
              <Scan className="h-4 w-4" />
              طلب جديد
            </button>
            <Link
              href="/seller/orders"
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
            >
              عرض الطلبات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // ORDER MODE RESULT SCREEN
  // ═══════════════════════════════════════════
  if (mode === "order" && orderResult) {
    const isSuccess = orderResult.status === "success";
    const isAlreadyReady = orderResult.status === "already_ready";
    const isError = orderResult.status === "error";

    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
            {isSuccess && (
              <>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <h1 className="mt-5 text-2xl font-black text-green-700">
                  الطرد جاهز!
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  تم إبلاغ المستودع بأن الطلب جاهز للجمع.
                </p>
                <div className="mt-4 rounded-xl bg-[#fff4ed] p-3">
                  <div className="text-xs text-gray-500">رقم الطلب</div>
                  <div className="mt-1 font-mono text-base font-black text-[#ff5c00]">
                    {orderResult.orderNumber}
                  </div>
                </div>
              </>
            )}

            {isAlreadyReady && (
              <>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
                  <Package className="h-10 w-10 text-blue-600" />
                </div>
                <h1 className="mt-5 text-2xl font-black text-blue-700">
                  جاهز للشحن
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  هذا الطرد جاهز مسبقًا. بانتظار مسؤول الجمع.
                </p>
                <div className="mt-4 rounded-xl bg-blue-50 p-3">
                  <div className="text-xs text-gray-500">رقم الطلب</div>
                  <div className="mt-1 font-mono text-base font-black text-blue-700">
                    {orderResult.orderNumber}
                  </div>
                </div>
              </>
            )}

            {isError && (
              <>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                  <AlertCircle className="h-10 w-10 text-red-600" />
                </div>
                <h1 className="mt-5 text-2xl font-black text-red-700">
                  تعذّر التحديث
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  {orderResult.message}
                </p>
              </>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() => {
                  setOrderResult(null);
                  setScanError("");
                }}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
              >
                <Scan className="h-4 w-4" />
                مسح طرد آخر
              </button>
              {!isError && (
                <Link
                  href={`/seller/orders/${orderResult.orderId}`}
                  className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                >
                  <ArrowRight className="h-4 w-4" />
                  عرض الطلب
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // MAIN UI
  // ═══════════════════════════════════════════
  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Scan className="h-6 w-6 text-[#ff5c00]" />
          الماسح
        </h1>
      </div>

      {/* ═══ Mode Toggle ═══ */}
      <div className="mb-5 flex gap-2 rounded-xl bg-gray-100 p-1">
        <button
          onClick={() => {
            setMode("product");
            setScanError("");
            setOrderResult(null);
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition ${
            mode === "product"
              ? "bg-white text-[#ff5c00] shadow-sm"
              : "text-gray-500"
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          بيع في المتجر
        </button>
        <button
          onClick={() => {
            setMode("order");
            setScanError("");
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition ${
            mode === "order"
              ? "bg-white text-[#ff5c00] shadow-sm"
              : "text-gray-500"
          }`}
        >
          <Truck className="h-4 w-4" />
          تجهيز طلب
        </button>
      </div>

      {/* ═══ ORDER MODE UI ═══ */}
      {mode === "order" && !orderResult && (
        <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-sm">
          {/* ═══ Order Summary (if navigated from order page) ═══ */}
          {orderSummary && (
            <div className="mb-4 rounded-xl border-2 border-[#ff5c00] bg-[#fff4ed] p-4">
              <div className="text-xs font-bold text-gray-700">
                الطلب الذي ستُجهّزه
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-lg font-black text-[#ff5c00]">
                    {orderSummary.orderNumber}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-600">
                    {orderSummary.itemsCount} منتج —{" "}
                    {Number(orderSummary.total).toFixed(2)} د.م
                  </div>
                </div>
                <Link
                  href={`/seller/orders/${orderSummary.id}`}
                  className="text-[11px] font-bold text-[#ff5c00] underline"
                >
                  عرض
                </Link>
              </div>
            </div>
          )}

          <div className="mb-5 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100">
                <Truck className="h-5 w-5 text-purple-700" />
              </div>
              <div>
                <div className="text-sm font-black text-purple-900">
                  امسح ملصق الطلبية
                </div>
                <p className="mt-1 text-xs text-purple-700">
                  امسح QR الموجود على ملصق الطرد المطبوع لإبلاغ النظام بأنه
                  جاهز للشحن.
                </p>
              </div>
            </div>
          </div>

          {!scanning ? (
            <button
              onClick={startScanner}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-3.5 text-sm font-bold text-white transition hover:bg-purple-700 disabled:opacity-50"
            >
              <Scan className="h-5 w-5" />
              فتح الكاميرا للمسح
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-600 transition hover:bg-red-100"
            >
              <X className="h-5 w-5" />
              إيقاف الماسح
            </button>
          )}

          {scanning && (
            <div className="mt-4 overflow-hidden rounded-xl">
              <div id={scannerDivId} className="w-full" />
              <p className="mt-3 text-center text-xs text-gray-500">
                وجّه الكاميرا نحو QR الملصق
              </p>
            </div>
          )}

          {/* Manual input */}
          {!scanning && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="mb-2 text-xs font-bold text-gray-700">
                أو إدخال يدوي للرمز
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!manualCode.trim()) return;
                  handleOrderToken(manualCode.trim());
                  setManualCode("");
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="الصق رمز الطلبية..."
                  dir="ltr"
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-purple-500 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim() || loading}
                  className="rounded-lg bg-purple-600 px-4 text-xs font-bold text-white transition hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "تأكيد"
                  )}
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
      )}

      {/* ═══ PRODUCT MODE UI ═══ */}
      {mode === "product" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              {!scanning ? (
                <button
                  onClick={startScanner}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3.5 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
                >
                  <Scan className="h-5 w-5" />
                  فتح الكاميرا للمسح
                </button>
              ) : (
                <button
                  onClick={stopScanner}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-600 transition hover:bg-red-100"
                >
                  <X className="h-5 w-5" />
                  إيقاف الماسح
                </button>
              )}

              {scanning && (
                <div className="mt-4 overflow-hidden rounded-xl">
                  <div id={scannerDivId} className="w-full" />
                  <p className="mt-3 text-center text-xs text-gray-500">
                    وجّه الكاميرا نحو QR المنتج
                  </p>
                </div>
              )}

              {!scanning && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="mb-2 text-xs font-bold text-gray-700">
                    إدخال يدوي للكود
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!manualCode.trim()) return;
                      loadByCode(manualCode.trim());
                      setManualCode("");
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="الصق كود المنتج..."
                      dir="ltr"
                      className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-[#ff5c00] focus:bg-white"
                    />
                    <button
                      type="submit"
                      disabled={!manualCode.trim() || loading}
                      className="rounded-lg bg-[#ff5c00] px-4 text-xs font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "جلب"
                      )}
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

            {products.length > 0 && (
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-black text-gray-700">
                  المنتجات الممسوحة ({products.length})
                </h3>
                <div className="space-y-2">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg border border-gray-100 p-2"
                    >
                      {p.image && (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="h-10 w-10 shrink-0 rounded object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold">
                          {p.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-black">
                <ShoppingBag className="h-5 w-5 text-[#ff5c00]" />
                الطلب الحالي
              </h2>
              {lines.length > 0 && (
                <span className="rounded-full bg-[#fff4ed] px-2 py-0.5 text-xs font-bold text-[#ff5c00]">
                  {lines.length} منتج
                </span>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="py-12 text-center">
                <div className="text-5xl">📷</div>
                <p className="mt-3 text-sm font-bold text-gray-500">
                  ابدأ بمسح المنتجات
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 max-h-[400px] space-y-3 overflow-y-auto">
                  {lines.map((l) => {
                    const product = products.find(
                      (p) => p.id === l.productId
                    );

                    return (
                      <div
                        key={l.variantId}
                        className="rounded-lg border border-gray-200 p-3"
                      >
                        <div className="flex items-start gap-2">
                          {l.image && (
                            <img
                              src={l.image}
                              alt={l.productName}
                              className="h-14 w-14 shrink-0 rounded object-cover"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold">
                              {l.productName}
                            </div>
                            {l.variantLabel && (
                              <div className="mt-0.5 text-[10px] text-gray-500">
                                {l.variantLabel}
                              </div>
                            )}
                            <div className="mt-1 text-xs font-black text-[#ff5c00]">
                              {l.price.toFixed(2)} د.م
                            </div>
                          </div>
                          <button
                            onClick={() => removeLine(l.variantId)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {product && product.variants.length > 1 && (
                          <div className="mt-2">
                            <select
                              value={l.variantId}
                              onChange={(e) => {
                                const v = product.variants.find(
                                  (x) => x.id === Number(e.target.value)
                                );
                                if (v) changeVariant(l.productId, v);
                              }}
                              className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px] outline-none focus:border-[#ff5c00]"
                            >
                              {product.variants.map((v) => (
                                <option
                                  key={v.id}
                                  value={v.id}
                                  disabled={v.available === 0}
                                >
                                  {v.optionValueLabels.join(" / ") ||
                                    "افتراضي"}{" "}
                                  — {v.price.toFixed(2)} د.م
                                  {v.available === 0 ? " (نفد)" : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center overflow-hidden rounded-full border border-gray-200">
                            <button
                              onClick={() => updateQty(l.variantId, -1)}
                              disabled={l.quantity <= 1}
                              className="flex h-6 w-6 items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="min-w-[2rem] border-x border-gray-200 py-0.5 text-center text-xs font-bold">
                              {l.quantity}
                            </span>
                            <button
                              onClick={() => updateQty(l.variantId, 1)}
                              disabled={l.quantity >= l.available}
                              className="flex h-6 w-6 items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="text-[10px] text-gray-400">
                            متاح: {l.available}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <div className="mb-3 flex justify-between text-sm">
                    <span className="font-bold">الإجمالي</span>
                    <span className="text-lg font-black text-[#ff5c00]">
                      {total.toFixed(2)} د.م
                    </span>
                  </div>

                  <button
                    onClick={() => setShowCheckout(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
                  >
                    <Check className="h-4 w-4" />
                    إتمام الطلب
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ Checkout Modal (product mode) ═══ */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-black">إتمام طلب المحل</h3>
            <p className="mt-1 text-xs text-gray-500">
              {lines.length} منتج — {total.toFixed(2)} د.م
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  اسم العميل (اختياري)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  رقم الهاتف (اختياري)
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  ملاحظة (اختياري)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>
            </div>

            {scanError && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {scanError}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={submitOrder}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                تأكيد الطلب
              </button>
              <button
                onClick={() => setShowCheckout(false)}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ Wrapper with Suspense (required for useSearchParams) ═══
export default function SellerScannerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
        </div>
      }
    >
      <ScannerContent />
    </Suspense>
  );
}