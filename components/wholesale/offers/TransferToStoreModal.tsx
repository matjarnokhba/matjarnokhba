"use client";

import { useEffect, useState } from "react";
import { Loader2, X, Store, AlertCircle, Package, CheckCircle2 } from "lucide-react";

type PrepareVariant = {
  merchantVariantId: number;
  sku: string;
  barcode: string | null;
  baseUnitPrice: number;
  wholesaleStock: number;
  retailExists: boolean;
};

type PrepareData = {
  offer: { id: number; status: string; businessUnitId: number };
  merchantProduct: { id: number; name: string; masterName: string };
  variants: PrepareVariant[];
  hasSeller: boolean;
};

type Props = {
  offerId: number;
  onClose: () => void;
  onSuccess: (result: { productId: number; totalQty: number; remainingQty: number }) => void;
};

export default function TransferToStoreModal({ offerId, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PrepareData | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transferMap, setTransferMap] = useState<Record<number, string>>({});

  useEffect(() => {
    setLoading(true);
    setError("");
    (async () => {
      try {
        const res = await fetch(`/api/wholesale/offers/${offerId}/transfer-to-store/prepare`);
        const d = await res.json();
        if (!d.success) { setError(d.message || "فشل التحميل"); return; }
        setData(d);
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [offerId]);

  const transfers = Object.entries(transferMap)
    .map(([id, q]) => ({ merchantVariantId: parseInt(id), quantity: parseInt(q || "0") }))
    .filter((t) => t.quantity > 0);

  const totalSelected = transfers.reduce((s, t) => s + t.quantity, 0);

  async function handleSubmit() {
    if (!data || transfers.length === 0) return;
    for (const t of transfers) {
      const v = data.variants.find((x) => x.merchantVariantId === t.merchantVariantId);
      if (!v || t.quantity > v.wholesaleStock) {
        setError(`الكمية المطلوبة أكبر من المتاح للخيار "${v?.sku || t.merchantVariantId}"`);
        return;
      }
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/wholesale/offers/${offerId}/transfer-to-store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transfers }),
      });
      const d = await res.json();
      if (d.success) onSuccess({ productId: d.productId, totalQty: d.totalQty, remainingQty: d.remainingQty });
      else setError(d.message || "فشل النقل");
    } catch { setError("خطأ في الاتصال"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Store className="h-5 w-5 text-emerald-600" /> نقل إلى المتجر
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>}

        {!loading && error && !data && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {!loading && data && !data.hasSeller && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">لا يوجد متجر تجزئة</p>
                <p className="mt-1">يجب أن يكون لديك متجر تجزئة (Seller) لاستقبال المنتجات.</p>
              </div>
            </div>
          </div>
        )}

        {!loading && data && data.hasSeller && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{data.merchantProduct.name}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">هوية أصلية: {data.merchantProduct.masterName}</p>
            </div>

            {data.variants.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                لا يوجد مخزون جملة متاح للنقل.
              </div>
            )}

            {data.variants.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium">الكميات التي ستُنقل إلى متجرك</label>
                <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg border p-2">
                  {data.variants.map((v) => (
                    <div key={v.merchantVariantId} className="flex items-center justify-between gap-3 rounded-lg bg-white p-2 text-sm">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{v.sku}</p>
                          {v.retailExists ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
                              <CheckCircle2 className="h-3 w-3" /> موجود
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-500">سيُنشأ</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">مخزون الجملة: {v.wholesaleStock}</p>
                      </div>
                      <input
                        type="number" min="0" max={v.wholesaleStock}
                        value={transferMap[v.merchantVariantId] ?? ""}
                        onChange={(e) => setTransferMap({ ...transferMap, [v.merchantVariantId]: e.target.value })}
                        placeholder="0"
                        className="w-24 rounded border p-1.5 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalSelected > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-800">
                سيُنقل <strong>{totalSelected}</strong> قطعة
              </div>
            )}

            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">إلغاء</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || transfers.length === 0}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "جارٍ النقل..." : "تأكيد النقل"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}