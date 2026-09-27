"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Package, AlertCircle } from "lucide-react";

type ReturnableItem = {
  orderItemId: number;
  productName: string;
  variantName: string | null;
  imageUrl: string | null;
  originalQuantity: number;
  alreadyRequested: number;
  availableQuantity: number;
};

type ReturnModalProps = {
  orderId: number;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ReturnModal({
  orderId,
  onClose,
  onSuccess,
}: ReturnModalProps) {
  const [items, setItems] = useState<ReturnableItem[]>([]);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ═══ تحميل المنتجات القابلة للإرجاع ═══
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/orders/${orderId}/returnable`);
        const data = await res.json();
        if (data.success) {
          setItems(data.items.filter((i: ReturnableItem) => i.availableQuantity > 0));
        } else {
          setError(data.message || "فشل التحميل");
        }
      } catch {
        setError("فشل الاتصال");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orderId]);

  // ═══ تعديل الكمية ═══
  function setQty(orderItemId: number, qty: number) {
    setSelected((prev) => {
      if (qty <= 0) {
        const copy = { ...prev };
        delete copy[orderItemId];
        return copy;
      }
      return { ...prev, [orderItemId]: qty };
    });
  }

  // ═══ إرسال ═══
  async function handleSubmit() {
    setError("");

    const selectedItems = Object.entries(selected)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({
        orderItemId: Number(id),
        quantity: qty,
      }));

    if (selectedItems.length === 0) {
      setError("اختر منتجاً واحداً على الأقل");
      return;
    }
    if (reason.trim().length < 5) {
      setError("اكتب سبباً واضحاً (5 أحرف على الأقل)");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reason: reason.trim(),
          items: selectedItems,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل الإرسال");
        return;
      }

      onSuccess();
    } catch {
      setError("فشل الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCount = Object.values(selected).filter((q) => q > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        {/* رأس */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-black">طلب إرجاع</h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* المحتوى */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#ff5c00]" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center">
              <div className="text-4xl">📦</div>
              <p className="mt-3 text-sm text-gray-600">
                لا توجد منتجات قابلة للإرجاع
              </p>
            </div>
          ) : (
            <>
              {/* قائمة المنتجات */}
              <div className="mb-4">
                <div className="mb-2 text-xs font-bold text-gray-700">
                  اختر المنتجات وكمياتها:
                </div>
                <div className="space-y-2">
                  {items.map((item) => {
                    const qty = selected[item.orderItemId] || 0;
                    return (
                      <div
                        key={item.orderItemId}
                        className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-200">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-400">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-xs font-bold">
                            {item.productName}
                          </div>
                          {item.variantName && (
                            <div className="text-[10px] text-gray-500">
                              {item.variantName}
                            </div>
                          )}
                          <div className="mt-0.5 text-[10px] text-gray-500">
                            متاح للإرجاع: {item.availableQuantity}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setQty(item.orderItemId, Math.max(0, qty - 1))}
                            disabled={qty === 0}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-bold">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setQty(
                                item.orderItemId,
                                Math.min(item.availableQuantity, qty + 1)
                              )
                            }
                            disabled={qty >= item.availableQuantity}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* السبب */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  سبب الإرجاع <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  disabled={submitting}
                  placeholder="مثال: المنتج لا يناسبني، أو وصل تالفاً..."
                  className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
                />
                <div className="mt-1 text-left text-[10px] text-gray-400">
                  {reason.length} / 500
                </div>
              </div>
            </>
          )}

          {/* خطأ */}
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* أزرار */}
        <div className="flex gap-2 border-t border-gray-100 p-4">
          <button
            onClick={handleSubmit}
            disabled={
              submitting ||
              loading ||
              items.length === 0 ||
              selectedCount === 0 ||
              reason.trim().length < 5
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              `إرسال الطلب (${selectedCount})`
            )}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}