"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Search,
  Package,
  Check,
  Truck,
  AlertCircle,
  Store,
  Globe,
  QrCode,
  X,
  CheckCircle2,
  ListChecks,
} from "lucide-react";

// ═══════ الأنواع ═══════
type AvailableItem = {
  id: number;
  orderItemId: number;
  orderId: number;
  orderNumber: string;
  orderSource: string;
  orderStatus: string;
  orderCreatedAt: string;
  sellerId: number;
  sellerName: string;
  sellerSlug: string;
  productName: string;
  variantName: string | null;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  status: string;
  verifiedAt: string | null;
  codAmount: number;
};

type OrderGroup = {
  orderId: number;
  orderNumber: string;
  source: string;
  status: string;
  createdAt: string;
  totalCOD: number;
  items: AvailableItem[];
};

type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
};

type Summary = {
  totalItems: number;
  totalOrders: number;
  totalCOD: number;
};

type ScanMode = "qr" | "id";

export default function NewShipmentPage() {
  const router = useRouter();

  const [mode, setMode] = useState<ScanMode>("id");

  // ═══ QR Scanner ═══
  const [scanning, setScanning] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const scannerRef = useRef<any>(null);
  const scannerDivId = "shipment-qr-reader";

  // ═══ البحث بالمعرّف ═══
  const [searchId, setSearchId] = useState("");

  // ═══ النتائج ═══
  const [searching, setSearching] = useState(false);
  const [scanError, setScanError] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<OrderGroup[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scannedOrderNumber, setScannedOrderNumber] = useState<string | null>(
    null
  );

  // ═══ الاختيارات ═══
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(
    new Set()
  );

  // ═══ الحفظ ═══
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ═══ تنظيف الماسح ═══
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch {}
      }
    };
  }, []);

  // ═══ إعادة تعيين كل شيء ═══
  function resetResults() {
    setCustomer(null);
    setOrders([]);
    setSummary(null);
    setSelectedItemIds(new Set());
    setScanError("");
    setScannedOrderNumber(null);
  }

  // ═══ البحث بمعرّف العميل ═══
  async function handleSearchById(e: React.FormEvent) {
    e.preventDefault();
    setScanError("");

    const id = parseInt(searchId.trim());
    if (isNaN(id) || id <= 0) {
      setScanError("أدخل معرّف عميل صحيح (رقم)");
      return;
    }

    setSearching(true);
    resetResults();

    try {
      const res = await fetch(`/api/admin/customers/${id}/orders`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setScanError(data.message || "العميل غير موجود");
        return;
      }

      setCustomer(data.customer);
      setOrders(data.orders);
      setSummary(data.summary);

      if (data.orders.length === 0) {
        setScanError(
          "لا توجد عناصر متاحة للشحن لهذا العميل (يجب استلامها في المستودع أولاً)"
        );
      }
    } catch {
      setScanError("فشل الاتصال");
    } finally {
      setSearching(false);
    }
  }

  // ═══ الماسح ═══
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
          handleScanResult(decodedText);
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

  async function handleScanResult(text: string) {
    await stopScanner();

    let token = text.trim();

    if (token.includes("/d/")) {
      const match = token.match(/\/d\/([A-Za-z0-9_-]+)/);
      if (match) token = match[1];
    }

    if (token.includes("/")) {
      const parts = token.split("/");
      token = parts[parts.length - 1];
    }

    await loadByToken(token);
  }

  async function handleManualToken(e: React.FormEvent) {
    e.preventDefault();
    if (!manualToken.trim()) return;
    await loadByToken(manualToken.trim());
    setManualToken("");
  }

  async function loadByToken(token: string) {
    setSearching(true);
    resetResults();

    try {
      const res = await fetch(`/api/admin/orders/by-token/${token}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setScanError(data.message || "الطلب غير موجود");
        return;
      }

      setCustomer(data.customer);
      setOrders(data.orders);
      setSummary(data.summary);
      setScannedOrderNumber(data.scannedOrder?.orderNumber || null);

      if (data.orders.length === 0) {
        setScanError(
          "لا توجد عناصر متاحة للشحن (يجب استلامها في المستودع أولاً)"
        );
      }
    } catch {
      setScanError("فشل الاتصال");
    } finally {
      setSearching(false);
    }
  }

  // ═══ تحديد/إلغاء عنصر ═══
  function toggleItem(itemId: number) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  // ═══ تحديد/إلغاء كل عناصر طلب ═══
  function toggleAllInOrder(order: OrderGroup) {
    const allSelected = order.items.every((i) =>
      selectedItemIds.has(i.id)
    );
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      for (const item of order.items) {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  }

  // ═══ إنشاء الشحنة ═══
  async function handleCreate() {
    if (!customer) return;
    if (selectedItemIds.size === 0) {
      setSaveError("اختر عنصراً واحداً على الأقل");
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      const res = await fetch("/api/admin/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillmentItemIds: Array.from(selectedItemIds),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setSaveError(data.message || "فشل الإنشاء");
        return;
      }

      router.push(`/admin/shipments/${data.shipment.id}`);
    } catch {
      setSaveError("فشل الاتصال");
    } finally {
      setSaving(false);
    }
  }

  // ═══ الإجمالي المعروض ═══
  const selectedCOD =
    Math.round(
      orders
        .flatMap((o) => o.items)
        .filter((i) => selectedItemIds.has(i.id))
        .reduce((s, i) => s + i.codAmount, 0) * 100
    ) / 100;

  const selectedOrdersCount = new Set(
    orders
      .filter((o) => o.items.some((i) => selectedItemIds.has(i.id)))
      .map((o) => o.orderId)
  ).size;// ═══ العرض ═══
  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/admin/shipments"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للشحنات
      </Link>

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Truck className="h-6 w-6 text-[#ff5c00]" />
          شحنة جديدة
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          اختر العناصر المتاحة للشحن (المستلمة في المستودع)
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ═══ العمود الأيسر ═══ */}
        <div className="space-y-4 lg:col-span-2">
          {/* Tabs */}
          <div className="flex gap-2 rounded-xl bg-gray-100 p-1">
            <button
              onClick={() => setMode("qr")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition ${
                mode === "qr"
                  ? "bg-white text-[#ff5c00] shadow-sm"
                  : "text-gray-600"
              }`}
            >
              <QrCode className="h-4 w-4" />
              مسح QR
            </button>
            <button
              onClick={() => setMode("id")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition ${
                mode === "id"
                  ? "bg-white text-[#ff5c00] shadow-sm"
                  : "text-gray-600"
              }`}
            >
              <Search className="h-4 w-4" />
              بحث بالمعرّف
            </button>
          </div>

          {/* Panels */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            {mode === "qr" ? (
              <>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
                  <QrCode className="h-4 w-4 text-[#ff5c00]" />
                  امسح QR طلب العميل
                </h2>

                {!scanning ? (
                  <button
                    onClick={startScanner}
                    disabled={searching}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[#ff5c00] to-orange-500 py-3.5 text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-50"
                  >
                    <QrCode className="h-5 w-5" />
                    فتح الكاميرا للمسح
                  </button>
                ) : (
                  <button
                    onClick={stopScanner}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-600"
                  >
                    <X className="h-5 w-5" />
                    إيقاف الماسح
                  </button>
                )}

                {scanning && (
                  <div className="mt-4 overflow-hidden rounded-xl">
                    <div id={scannerDivId} className="w-full" />
                    <p className="mt-3 text-center text-xs text-gray-500">
                      وجّه الكاميرا نحو QR الطلب
                    </p>
                  </div>
                )}

                {!scanning && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <div className="mb-2 text-xs font-bold text-gray-700">
                      إدخال يدوي للتوكن
                    </div>
                    <form
                      onSubmit={handleManualToken}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        placeholder="الصق توكن الطلب..."
                        dir="ltr"
                        className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-[#ff5c00] focus:bg-white"
                      />
                      <button
                        type="submit"
                        disabled={!manualToken.trim() || searching}
                        className="rounded-lg bg-[#ff5c00] px-4 text-xs font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
                      >
                        {searching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "جلب"
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
                  <Search className="h-4 w-4 text-[#ff5c00]" />
                  البحث بمعرّف العميل
                </h2>

                <form onSubmit={handleSearchById} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                      placeholder="معرّف العميل (مثال: 5)"
                      dir="ltr"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 font-mono text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searching || !searchId.trim()}
                    className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
                  >
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    بحث
                  </button>
                </form>
              </>
            )}

            {scanError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{scanError}</span>
              </div>
            )}
          </div>

          {/* معلومات العميل */}
          {customer && (
            <div className="rounded-xl border-2 border-[#ff5c00] bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black">العميل</h2>
                {scannedOrderNumber && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                    ✓ من QR: {scannedOrderNumber}
                  </span>
                )}
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="font-black text-gray-900">
                  {customer.name}
                </div>
                <div className="text-xs text-gray-500">
                  {customer.email}
                </div>
                {customer.phone && (
                  <div
                    className="text-xs text-gray-500"
                    dir="ltr"
                  >
                    📞 {customer.phone}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* قائمة الطلبات */}
          {customer && orders.length > 0 && (
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-black">
                <ListChecks className="h-4 w-4 text-[#ff5c00]" />
                العناصر المتاحة للشحن ({summary?.totalItems || 0})
              </h2>

              {orders.map((order) => {
                const allSelected = order.items.every((i) =>
                  selectedItemIds.has(i.id)
                );
                const someSelected = order.items.some((i) =>
                  selectedItemIds.has(i.id)
                );
                const isOnline = order.source === "ONLINE";

                return (
                  <div
                    key={order.orderId}
                    className={`rounded-xl bg-white p-5 shadow-sm ${
                      someSelected ? "ring-2 ring-[#ff5c00]" : ""
                    }`}
                  >
                    {/* رأس الطلب */}
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-gray-900">
                            {order.orderNumber}
                          </span>
                          <span
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isOnline
                                ? "bg-blue-50 text-blue-700"
                                : "bg-[#fff4ed] text-[#ff5c00]"
                            }`}
                          >
                            {isOnline ? (
                              <>
                                <Globe className="h-2.5 w-2.5" />
                                إلكتروني
                              </>
                            ) : (
                              <>
                                <Store className="h-2.5 w-2.5" />
                                محل
                              </>
                            )}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-gray-500">
                          {new Date(order.createdAt).toLocaleDateString(
                            "ar-MA"
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => toggleAllInOrder(order)}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                          allSelected
                            ? "bg-[#ff5c00] text-white hover:bg-[#e64a00]"
                            : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {allSelected ? "إلغاء الكل" : "تحديد الكل"}
                      </button>
                    </div>

                    {/* العناصر */}
                    <div className="space-y-2">
                      {order.items.map((item) => {
                        const isSelected = selectedItemIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleItem(item.id)}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition ${
                              isSelected
                                ? "border-[#ff5c00] bg-[#fff4ed]/30"
                                : "border-gray-100 bg-white hover:border-gray-200"
                            }`}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleItem(item.id);
                              }}
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition ${
                                isSelected
                                  ? "border-[#ff5c00] bg-[#ff5c00] text-white"
                                  : "border-gray-300 bg-white"
                              }`}
                            >
                              {isSelected && (
                                <Check className="h-4 w-4" />
                              )}
                            </button>

                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.productName}
                                className="h-14 w-14 shrink-0 rounded object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-gray-100">
                                <Package className="h-5 w-5 text-gray-400" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-bold">
                                {item.productName}
                              </div>
                              {item.variantName && (
                                <div className="text-[10px] text-gray-500">
                                  {item.variantName}
                                </div>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 font-bold text-blue-700">
                                  {item.sellerName}
                                </span>
                                <span className="text-green-700">
                                  ✓ متحقق
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 text-left">
                              <div className="text-xs font-bold text-gray-600">
                                ×{item.quantity}
                              </div>
                              <div className="text-xs font-black text-[#ff5c00]">
                                {item.codAmount.toFixed(2)}
                              </div>
                              <div className="text-[9px] text-gray-500">
                                د.م
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ العمود الأيمن — الملخص ═══ */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black">
              <Truck className="h-4 w-4 text-[#ff5c00]" />
              ملخص الشحنة
            </h2>

            <div className="space-y-2 border-b border-dashed border-gray-200 pb-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">العميل</span>
                <span className="font-bold">
                  {customer ? customer.name : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">
                  العناصر المختارة
                </span>
                <span className="font-bold">
                  {selectedItemIds.size}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">
                  الطلبات المشمولة
                </span>
                <span className="font-bold">
                  {selectedOrdersCount}
                </span>
              </div>
            </div>

            <div className="mt-3 flex justify-between">
              <span className="text-sm font-bold">إجمالي COD</span>
              <div className="text-left">
                <span className="text-xl font-black text-[#ff5c00]">
                  {selectedCOD.toFixed(2)}
                </span>
                <span className="mr-1 text-xs text-gray-500">د.م</span>
              </div>
            </div>

            {saveError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={
                saving ||
                selectedItemIds.size === 0 ||
                !customer
              }
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              إنشاء الشحنة
            </button>

            <p className="mt-3 text-[10px] leading-relaxed text-gray-400">
              💡 العناصر المختارة يجب أن تكون بحالة "متاح للشحن"
              (تم استلامها في المستودع).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}