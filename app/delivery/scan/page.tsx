"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  QrCode,
  X,
  Check,
  AlertCircle,
  MapPin,
  Phone,
  User,
  Package,
  Clock,
  XCircle,
  RotateCcw,
} from "lucide-react";

type OrderData = {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  customerName: string;
  customerPhone: string | null;
  city: string | null;
  street: string | null;
  postalCode: string | null;
  itemsCount: number;
  items: {
    id: number;
    productName: string;
    variantName: string | null;
    imageUrl: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
};

type ActionModal =
  | { type: "deferred"; order: OrderData }
  | { type: "rejected"; order: OrderData }
  | { type: "returned"; order: OrderData }
  | { type: "delivered"; order: OrderData }
  | null;

export default function DeliveryScanPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [reason, setReason] = useState("");

  const scannerRef = useRef<any>(null);
  const scannerDivId = "delivery-qr-reader";

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch {}
      }
    };
  }, []);

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
    // لو كان رابط
    if (token.includes("/d/")) {
      const match = token.match(/\/d\/([A-Za-z0-9-]+)/);
      if (match) token = match[1];
    }
    // لو UUID مباشرة
    if (token.includes("/")) {
      const parts = token.split("/");
      token = parts[parts.length - 1];
    }

    await loadByToken(token);
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await loadByToken(manualCode.trim());
    setManualCode("");
  }

  async function loadByToken(token: string) {
    setLoading(true);
    setScanError("");
    setOrder(null);
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/delivery/orders/by-token/${token}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setScanError(data.message || "الطلب غير موجود");
        return;
      }

      setOrder(data.order);
    } catch {
      setScanError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  async function executeAction(action: string, actionReason?: string) {
    if (!order) return;
    setSubmitting(true);
    setScanError("");

    try {
      const res = await fetch(`/api/delivery/orders/${order.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(actionReason && { reason: actionReason }),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setScanError(data.message || "فشل التنفيذ");
        return;
      }

      setSuccessMsg(data.message || "تم بنجاح");
      setOrder(null);
      setActionModal(null);
      setReason("");

      setTimeout(() => {
        setSuccessMsg("");
      }, 3000);
    } catch {
      setScanError("فشل الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  function openActionModal(type: "deferred" | "rejected" | "returned" | "delivered") {
    if (!order) return;
    setReason("");
    setActionModal({ type, order } as ActionModal);
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <QrCode className="h-6 w-6 text-green-600" />
          مسح QR الطلب
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          امسح رمز QR الموجود على الطلب
        </p>
      </div>

      {/* ═══ الماسح ═══ */}
      {!order && (
        <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
          {!scanning ? (
            <button
              onClick={startScanner}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 py-4 text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-50"
            >
              <QrCode className="h-5 w-5" />
              فتح الكاميرا للمسح
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 py-4 text-sm font-bold text-red-600"
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
                إدخال يدوي للكود
              </div>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="الصق كود الطلب..."
                  dir="ltr"
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-green-500 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim() || loading}
                  className="rounded-lg bg-green-500 px-4 text-xs font-bold text-white transition hover:bg-green-600 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "جلب"}
                </button>
              </form>
            </div>
          )}

          {scanError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{scanError}</span>
            </div>
          )}

          {successMsg && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-xs text-green-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ تفاصيل الطلب ═══ */}
      {order && (
        <>
          <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-gray-500">رقم الطلب</div>
                <div className="mt-1 font-mono text-lg font-black">
                  {order.orderNumber}
                </div>
              </div>
              <button
                onClick={() => setOrder(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* العميل */}
            <div className="mb-4 rounded-lg bg-gray-50 p-3">
              <div className="mb-2 text-xs font-black">بيانات العميل</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  <span className="font-bold">{order.customerName}</span>
                </div>
                {order.customerPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    <span dir="ltr">{order.customerPhone}</span>
                  </div>
                )}
                {order.city && (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 text-gray-400" />
                    <span>
                      {order.street}، {order.city}
                      {order.postalCode && ` - ${order.postalCode}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* المنتجات */}
            <div className="mb-4">
              <div className="mb-2 text-xs font-black">
                المنتجات ({order.itemsCount})
              </div>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-100 p-2"
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gray-100">
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
                    </div>
                    <div className="text-xs font-bold">×{item.quantity}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* الإجمالي */}
            <div className="flex items-center justify-between rounded-lg bg-[#fff4ed] px-4 py-3">
              <span className="text-xs font-bold text-gray-700">
                المجموع المطلوب تحصيله
              </span>
              <span className="text-lg font-black text-[#ff5c00]">
                {order.total.toFixed(2)} د.م
              </span>
            </div>
          </div>

          {/* ═══ الإجراءات ═══ */}
          <div className="space-y-2">
            <button
              onClick={() => openActionModal("delivered")}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 py-4 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
            >
              <Check className="h-5 w-5" />
              تم التوصيل
            </button>

            <button
              onClick={() => openActionModal("deferred")}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-500 bg-amber-50 py-3.5 text-sm font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
            >
              <Clock className="h-5 w-5" />
              تأجيل التوصيل
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => openActionModal("rejected")}
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-red-50 py-3.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                <XCircle className="h-5 w-5" />
                رفض العميل
              </button>

              <button
                onClick={() => openActionModal("returned")}
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-gray-400 bg-gray-50 py-3.5 text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
              >
                <RotateCcw className="h-5 w-5" />
                إرجاع
              </button>
            </div>

            {scanError && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{scanError}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ Modal ═══ */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            {actionModal.type === "delivered" ? (
              <>
                <div className="mb-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="mt-4 text-lg font-black">تأكيد التوصيل</h3>
                  <p className="mt-2 text-xs text-gray-600">
                    هل تم تسليم الطلب للعميل واستلام المبلغ (
                    {actionModal.order.total.toFixed(2)} د.م)؟
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => executeAction("delivered")}
                    disabled={submitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-500 py-3 text-sm font-bold text-white transition hover:bg-green-600 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    نعم، تم التوصيل
                  </button>
                  <button
                    onClick={() => setActionModal(null)}
                    disabled={submitting}
                    className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-bold text-gray-700"
                  >
                    إلغاء
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <h3 className="text-lg font-black">
                    {actionModal.type === "deferred"
                      ? "تأجيل التوصيل"
                      : actionModal.type === "rejected"
                        ? "رفض العميل"
                        : "إرجاع الطلب"}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {actionModal.type === "deferred"
                      ? "اذكر سبب تأجيل التوصيل"
                      : actionModal.type === "rejected"
                        ? "اذكر سبب رفض العميل"
                        : "اذكر سبب الإرجاع"}
                  </p>
                </div>

                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  placeholder="السبب..."
                  className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:bg-white"
                  autoFocus
                />

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => executeAction(actionModal.type, reason)}
                    disabled={submitting || reason.trim().length < 3}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white transition disabled:opacity-50 ${
                      actionModal.type === "deferred"
                        ? "bg-amber-500 hover:bg-amber-600"
                        : actionModal.type === "rejected"
                          ? "bg-red-500 hover:bg-red-600"
                          : "bg-gray-700 hover:bg-gray-800"
                    }`}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "تأكيد"
                    )}
                  </button>
                  <button
                    onClick={() => setActionModal(null)}
                    disabled={submitting}
                    className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-bold text-gray-700"
                  >
                    إلغاء
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}