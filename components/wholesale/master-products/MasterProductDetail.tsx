"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Package,
  Tag,
  Barcode,
  Calendar,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  History,
  Info,
  Star,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/ui/cn";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  formatDateTime,
  type SerializedDetail,
} from "./types";

type Tab = "info" | "variants" | "history";

export interface MasterProductDetailProps {
  master: SerializedDetail;
  isAdmin: boolean;
  isOwner: boolean;
}

export function MasterProductDetail({
  master,
  isAdmin,
  isOwner,
}: MasterProductDetailProps) {
  const [tab, setTab] = useState<Tab>("info");

  const tabs: Array<{ key: Tab; label: string; icon: typeof Info }> = [
    { key: "info", label: "المعلومات", icon: Info },
    { key: "variants", label: `المتغيرات (${master.variants.length})`, icon: Package },
    { key: "history", label: `السجل (${master.versions.length})`, icon: History },
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/wholesale/master-products"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للمنتجات الأصلية
      </Link>

      <PageHeader
        title={master.name}
        description={
          (master.brand ? master.brand + " · " : "") + master.category.name
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={STATUS_VARIANT[master.status] ?? "gray"}
              dot
            >
              {STATUS_LABEL[master.status] ?? master.status}
            </Badge>
            <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              v{master.version}
            </span>
          </div>
        }
      />

      {master.status === "PENDING_REVIEW" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">المنتج قيد المراجعة</p>
              <p className="mt-1 text-amber-800">
                فريقنا يراجع المنتج حاليًا. عادةً ما تتم المراجعة خلال 24 ساعة.
                ستصلك إشعار عند الاعتماد أو الرفض.
              </p>
            </div>
          </div>
        </div>
      )}

      {master.status === "ARCHIVED" && master.rejectionReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="text-sm text-red-900">
              <p className="font-semibold">تم رفض المنتج</p>
              <p className="mt-1 text-red-800">{master.rejectionReason}</p>
            </div>
          </div>
        </div>
      )}

      {master.status === "SUSPENDED" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="text-sm text-red-900">
              <p className="font-semibold">المنتج موقوف إداريًا</p>
              <p className="mt-1 text-red-800">
                يرجى التواصل مع الدعم لمعرفة السبب.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-[#ff5c00] text-[#ff5c00]"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "info" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <h3 className="mb-3 text-sm font-bold text-gray-900">
                الصور
              </h3>
              {master.images.length === 0 ? (
                <p className="text-sm text-gray-500">لا توجد صور</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {master.images.map((url, i) => (
                    <div
                      key={i}
                      className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                    >
                      <img
                        src={url}
                        alt={`${master.name} ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-bold text-gray-900">الوصف</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {master.description || "لا يوجد وصف"}
              </p>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <h3 className="mb-3 text-sm font-bold text-gray-900">
                التفاصيل
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex items-start gap-2 text-gray-700">
                  <Tag className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                  <div>
                    <dt className="text-xs text-gray-500">الفئة</dt>
                    <dd className="font-medium">{master.category.name}</dd>
                  </div>
                </div>
                {master.barcode && (
                  <div className="flex items-start gap-2 text-gray-700">
                    <Barcode className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    <div>
                      <dt className="text-xs text-gray-500">الباركود</dt>
                      <dd className="font-mono text-xs">{master.barcode}</dd>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2 text-gray-700">
                  <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                  <div>
                    <dt className="text-xs text-gray-500">تاريخ الإنشاء</dt>
                    <dd className="text-xs">
                      {formatDateTime(master.createdAt)}
                    </dd>
                  </div>
                </div>
              </dl>
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-bold text-gray-900">
                مقدم الطلب
              </h3>
              <p className="text-sm text-gray-900">{master.createdByUser.name}</p>
              <p className="text-xs text-gray-500">
                {master.createdByUser.email}
              </p>
              {master.approvedByUser && master.approvedAt && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="flex items-center gap-1 text-xs text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    اعتمده: {master.approvedByUser.name}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatDateTime(master.approvedAt)}
                  </p>
                </div>
              )}
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-bold text-gray-900">
                الإحصائيات
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-gray-600">المتغيرات</dt>
                  <dd className="font-bold text-gray-900">
                    {master.variantCount}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-600">تجار نشطون</dt>
                  <dd className="font-bold text-gray-900">
                    {master.merchantProductCount}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>
        </div>
      )}

      {tab === "variants" && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-right text-xs font-medium text-gray-600">
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">الخصائص</th>
                  <th className="px-4 py-3">الباركود</th>
                  <th className="px-4 py-3">الافتراضي</th>
                </tr>
              </thead>
              <tbody>
                {master.variants.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {v.sku || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {v.attributes.length === 0 ? (
                        <span className="text-xs text-gray-400">
                          بدون خصائص
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {v.attributes.map((a, i) => (
                            <span
                              key={i}
                              className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                            >
                              {a.name}: <strong>{a.value}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {v.barcode || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {v.isDefault && (
                        <Badge variant="orange">
                          <Star className="h-3 w-3" />
                          افتراضي
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "history" && (
        <Card>
          {master.versions.length === 0 ? (
            <p className="text-sm text-gray-500">لا يوجد سجل بعد</p>
          ) : (
            <ol className="space-y-3">
              {master.versions.map((v, idx) => (
                <li
                  key={v.id}
                  className="flex items-start gap-3 border-r-2 border-[#ff5c00] pr-3"
                >
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-[#ff5c00]">
                    v{v.version}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {v.changeReason || "تحديث"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDateTime(v.createdAt)}
                      {idx === 0 && (
                        <span className="mr-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          الحالي
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}
    </div>
  );
}