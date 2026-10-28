"use client";

import { useState } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
} from "lucide-react";

type EditLog = {
  id: number;
  changedFields: string[];
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  requiresReapproval: boolean;
  reason: string | null;
  reviewedAt: string | null;
  reviewAction: string | null;
  createdAt: string;
};

const SENSITIVE = new Set([
  "الاسم",
  "الوصف",
  "الصور",
  "الماركة",
  "الشارة",
  "التصنيف",
]);

type Props = {
  logs: EditLog[];
  total: number;
  loading: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
};

export default function EditHistoryList({
  logs,
  total,
  loading,
  onLoadMore,
  loadingMore,
}: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl bg-white p-12 text-center shadow-sm">
        <Clock className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">لا توجد تعديلات مسجلة</p>
        <p className="mt-1 text-xs text-gray-400">
          سجل التعديلات يبدأ عندما تُعدّل المنتج لأول مرة
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
      <div className="text-xs text-gray-500">
        عرض {logs.length} من {total} تعديل
      </div>

      {logs.map((log) => {
        const isOpen = expanded.has(log.id);
        const hasVariantChanges = log.changedFields.includes("المتغيرات");
        const standardFields = log.changedFields.filter(
          (f) => f !== "المتغيرات"
        );
        const sensitiveChanged = standardFields.filter((f) =>
          SENSITIVE.has(f)
        );
        const hasSensitive = sensitiveChanged.length > 0;

        return (
          <div
            key={log.id}
            className={`overflow-hidden rounded-xl bg-white shadow-sm ring-1 ${
              log.requiresReapproval
                ? "ring-amber-300"
                : hasSensitive
                  ? "ring-gray-200"
                  : "ring-gray-100"
            }`}
          >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-[#ff5c00]" />
                  <span className="text-sm font-black text-gray-900">
                    {new Date(log.createdAt).toLocaleDateString("ar-MA", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {log.requiresReapproval && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      طلب مراجعة
                    </span>
                  )}
                  {log.reviewAction === "approved" && (
                    <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                      <CheckCircle2 className="h-3 w-3" />
                      مُراجَع — مقبول
                    </span>
                  )}
                  {log.reviewAction === "rejected" && (
                    <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      <XCircle className="h-3 w-3" />
                      مُراجَع — مرفوض
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {log.changedFields.map((f, i) => (
                    <span
                      key={i}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        SENSITIVE.has(f)
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {f}
                    </span>
                  ))}
                </div>

                {log.reason && (
                  <div className="mt-1.5 text-[10px] text-gray-500">
                    السبب: {log.reason}
                  </div>
                )}
              </div>

              <button
                onClick={() => toggle(log.id)}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                {isOpen ? (
                  <>
                    إخفاء <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    التفاصيل <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            </div>

            {/* Details */}
            {isOpen && (
              <div className="border-t border-gray-100 bg-gray-50 p-4">
                {standardFields.length > 0 && (
                  <div className="mb-3 overflow-hidden rounded-lg bg-white ring-1 ring-gray-200">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-right font-bold text-gray-600">
                            الحقل
                          </th>
                          <th className="px-3 py-2 text-right font-bold text-gray-600">
                            قبل
                          </th>
                          <th className="px-3 py-2 text-right font-bold text-gray-600">
                            بعد
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {standardFields.map((field) => (
                          <tr key={field}>
                            <td className="px-3 py-2 font-bold">
                              <span
                                className={
                                  SENSITIVE.has(field)
                                    ? "text-amber-700"
                                    : "text-gray-700"
                                }
                              >
                                {field}
                                {SENSITIVE.has(field) && " ⚠️"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              <ValueDisplay
                                value={getByArabicName(log.oldValues, field)}
                              />
                            </td>
                            <td className="px-3 py-2 font-bold text-gray-900">
                              <ValueDisplay
                                value={getByArabicName(log.newValues, field)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {hasVariantChanges && (
                  <VariantDiff
                    changes={(log.newValues as any)?.variants || []}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {logs.length < total && onLoadMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            تحميل المزيد ({total - logs.length} متبقي)
          </button>
        </div>
      )}
    </div>
  );
}

function getByArabicName(obj: Record<string, any>, arabic: string): unknown {
  const map: Record<string, string> = {
    الاسم: "name",
    الوصف: "description",
    الصور: "imageUrls",
    الماركة: "brand",
    الشارة: "badge",
    التصنيف: "categoryId",
    "الشحن المجاني": "freeShipping",
    "بلد المنشأ": "originCountry",
    الفيديو: "videoUrl",
    "الحد الأدنى": "minOrderQty",
    "الحد الأقصى": "maxOrderQty",
    السعر: "price",
    المخزون: "stock",
    الباركود: "barcode",
  };
  return obj[map[arabic] || arabic];
}

function ValueDisplay({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">—</span>;
  }
  if (typeof value === "boolean") {
    return <span>{value ? "نعم" : "لا"}</span>;
  }
  if (typeof value === "number") {
    return <span>{value}</span>;
  }
  if (typeof value === "string") {
    if (value.startsWith("http")) {
      return (
        <img
          src={value}
          alt=""
          className="h-8 w-8 rounded object-cover"
        />
      );
    }
    return <span>{value.length > 80 ? value.slice(0, 80) + "..." : value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400">—</span>;
    if (typeof value[0] === "string" && value[0].startsWith("http")) {
      return (
        <div className="flex gap-1">
          {value.slice(0, 4).map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="h-8 w-8 rounded object-cover"
            />
          ))}
          {value.length > 4 && (
            <span className="text-gray-400">+{value.length - 4}</span>
          )}
        </div>
      );
    }
    return <span>{value.join(", ")}</span>;
  }
  return <span>{JSON.stringify(value)}</span>;
}

function VariantDiff({
  changes,
}: {
  changes: Array<{
    variantId: number;
    price?: { before: number; after: number };
    stock?: { before: number; after: number };
    barcode?: { before: string | null; after: string | null };
  }>;
}) {
  if (changes.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg bg-white ring-1 ring-gray-200">
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-black text-gray-700">
        تغييرات المتغيرات ({changes.length})
      </div>
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-right font-bold text-gray-600">
              Variant
            </th>
            <th className="px-3 py-2 text-right font-bold text-gray-600">
              الحقل
            </th>
            <th className="px-3 py-2 text-right font-bold text-gray-600">
              قبل
            </th>
            <th className="px-3 py-2 text-right font-bold text-gray-600">
              بعد
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {changes.map((change) =>
            (["price", "stock", "barcode"] as const).map((field) => {
              const diff = change[field];
              if (!diff) return null;
              const label =
                field === "price"
                  ? "السعر"
                  : field === "stock"
                    ? "المخزون"
                    : "الباركود";
              return (
                <tr key={`${change.variantId}-${field}`}>
                  <td className="px-3 py-1.5 font-mono text-gray-400">
                    #{change.variantId}
                  </td>
                  <td className="px-3 py-1.5 font-bold text-gray-700">
                    {label}
                  </td>
                  <td className="px-3 py-1.5 text-gray-600">
                    {diff.before ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 font-bold text-gray-900">
                    {diff.after ?? "—"}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}