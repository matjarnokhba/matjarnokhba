"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Package,
  Layers,
  Calendar,
  AlertCircle,
  Barcode,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import {
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_VARIANT,
  BATCH_SOURCE_LABEL,
  BATCH_SOURCE_VARIANT,
  formatDateTime,
  formatNumber,
} from "./types";

type VariantDetail = {
  variant: {
    id: number;
    sku: string | null;
    barcode: string | null;
    displayAttributes: Array<{ name: string; value: string }>;
    product: { id: number; displayName: string; masterId: number };
  };
  balances: Array<{
    inventoryAccountId: number;
    accountType: string;
    location: { id: number; name: string };
    onHand: number;
    reserved: number;
    available: number;
    updatedAt: string;
  }>;
  batches: Array<{
    id: number;
    inventoryAccountId: number;
    sourceType: string;
    sourceReferenceId: number | null;
    quantityReceived: number;
    quantityRemaining: number;
    unitCost: number;
    receivedAt: string;
  }>;
  reservations: Array<{
    id: number;
    inventoryAccountId: number;
    quantity: number;
    stage: string;
    status: string;
    expiresAt: string | null;
    referenceType: string;
    referenceId: number;
    createdAt: string;
  }>;
};

export interface VariantDetailDialogProps {
  open: boolean;
  onClose: () => void;
  businessUnitId: number;
  merchantVariantId: number | null;
}

export function VariantDetailDialog({
  open,
  onClose,
  businessUnitId,
  merchantVariantId,
}: VariantDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VariantDetail | null>(null);

  useEffect(() => {
    if (!open || !merchantVariantId) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/wholesale/business-units/${businessUnitId}/inventory/${merchantVariantId}`
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.message || "فشل تحميل التفاصيل");
          return;
        }
        setData(json);
      } catch {
        setError("خطأ في الاتصال");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, businessUnitId, merchantVariantId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={data?.variant.product.displayName || "تفاصيل المتغير"}
      description={
        data?.variant.sku ? `SKU: ${data.variant.sku}` : undefined
      }
      size="xl"
    >
      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="inline h-4 w-4" /> {error}
        </div>
      )}

      {data && !loading && (
        <div className="space-y-5">
          {/* Variant identity */}
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {data.variant.displayAttributes.length === 0 ? (
                <span className="text-xs text-gray-500">متغير افتراضي</span>
              ) : (
                data.variant.displayAttributes.map((a, i) => (
                  <span
                    key={i}
                    className="rounded bg-white px-2 py-0.5 text-xs text-gray-700 shadow-sm"
                  >
                    {a.name}: <strong>{a.value}</strong>
                  </span>
                ))
              )}
              {data.variant.barcode && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Barcode className="h-3 w-3" />
                  {data.variant.barcode}
                </span>
              )}
            </div>
          </div>

          {/* Balances */}
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
              <Package className="h-4 w-4 text-gray-400" />
              الأرصدة ({data.balances.length})
            </h3>
            {data.balances.length === 0 ? (
              <p className="text-sm text-gray-500">لا توجد أرصدة</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-right text-xs text-gray-600">
                      <th className="px-3 py-2">الموقع</th>
                      <th className="px-3 py-2">النوع</th>
                      <th className="px-3 py-2">المتوفر</th>
                      <th className="px-3 py-2">محجوز</th>
                      <th className="px-3 py-2">الإجمالي</th>
                      <th className="px-3 py-2">آخر تحديث</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.balances.map((b) => (
                      <tr
                        key={b.inventoryAccountId}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="px-3 py-2 text-gray-900">
                          {b.location.name}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={
                              ACCOUNT_TYPE_VARIANT[b.accountType] ?? "gray"
                            }
                            size="sm"
                          >
                            {ACCOUNT_TYPE_LABEL[b.accountType] ?? b.accountType}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-bold text-emerald-700">
                          {formatNumber(b.available)}
                        </td>
                        <td className="px-3 py-2 text-amber-600">
                          {formatNumber(b.reserved)}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {formatNumber(b.onHand)}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {formatDateTime(b.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active batches */}
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
              <Layers className="h-4 w-4 text-gray-400" />
              الدفعات النشطة ({data.batches.length})
            </h3>
            {data.batches.length === 0 ? (
              <p className="text-sm text-gray-500">لا توجد دفعات نشطة</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-right text-xs text-gray-600">
                      <th className="px-3 py-2">المصدر</th>
                      <th className="px-3 py-2">المرجع</th>
                      <th className="px-3 py-2">المستلم</th>
                      <th className="px-3 py-2">المتبقي</th>
                      <th className="px-3 py-2">تكلفة الوحدة</th>
                      <th className="px-3 py-2">تاريخ الاستلام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.batches.map((b) => (
                      <tr
                        key={b.id}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="px-3 py-2">
                          <Badge
                            variant={
                              BATCH_SOURCE_VARIANT[b.sourceType] ?? "gray"
                            }
                            size="sm"
                          >
                            {BATCH_SOURCE_LABEL[b.sourceType] ?? b.sourceType}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">
                          {b.sourceReferenceId ? `#${b.sourceReferenceId}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {formatNumber(b.quantityReceived)}
                        </td>
                        <td className="px-3 py-2 font-bold text-emerald-700">
                          {formatNumber(b.quantityRemaining)}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {b.unitCost.toFixed(2)} د.م
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateTime(b.receivedAt)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active reservations */}
          <div>
            <h3 className="mb-2 text-sm font-bold text-gray-900">
              الحجوزات النشطة ({data.reservations.length})
            </h3>
            {data.reservations.length === 0 ? (
              <p className="text-sm text-gray-500">لا توجد حجوزات</p>
            ) : (
              <div className="space-y-1">
                {data.reservations.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded bg-gray-50 px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-gray-900">
                      {formatNumber(r.quantity)} قطعة · {r.stage}
                    </span>
                    <span className="text-gray-500">
                      {r.referenceType} #{r.referenceId}
                    </span>
                    {r.expiresAt && (
                      <span className="text-amber-600">
                        ينتهي {formatDateTime(r.expiresAt)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}