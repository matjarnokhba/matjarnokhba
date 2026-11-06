"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  RotateCcw,
  Building2,
  Calendar,
  Package,
  FileText,
  AlertCircle,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReturnStatusTimeline } from "./ReturnStatusTimeline";
import { ReturnActions } from "./ReturnActions";
import {
  RETURN_STATUS_LABEL,
  RETURN_STATUS_VARIANT,
  RETURN_ITEM_CONDITION_LABEL,
  RETURN_ITEM_CONDITION_VARIANT,
  BU_TYPE_LABEL,
  formatDateTime,
  formatMoney,
  type ReturnDetail as ReturnDetailType,
} from "./types";

export interface ReturnDetailProps {
  returnOrder: ReturnDetailType;
  isBuyer: boolean;
  isSeller: boolean;
  isAdmin: boolean;
}

export function ReturnDetail({
  returnOrder,
  isBuyer,
  isSeller,
  isAdmin,
}: ReturnDetailProps) {
  const [currentStatus, setCurrentStatus] = useState(returnOrder.status);

  return (
    <div className="space-y-5">
      <Link
        href="/wholesale/returns"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للمرتجعات
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <RotateCcw className="h-5 w-5 text-gray-400" />
            <span className="font-mono">{returnOrder.returnNumber}</span>
            <Badge
              variant={RETURN_STATUS_VARIANT[currentStatus] ?? "gray"}
              dot
            >
              {RETURN_STATUS_LABEL[currentStatus] ?? currentStatus}
            </Badge>
          </span>
        }
        description={`${formatDateTime(returnOrder.createdAt)} · طلب أصلي ${returnOrder.originalOrderNumber}`}
      />

      {/* Timeline */}
      <Card>
        <ReturnStatusTimeline status={currentStatus} />
      </Card>

      {/* Rejected banner */}
      {currentStatus === "REJECTED" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="text-sm text-red-900">
              <p className="font-semibold">تم رفض طلب الإرجاع</p>
              {returnOrder.rejectionReason && (
                <p className="mt-1 text-red-800">
                  {returnOrder.rejectionReason}
                </p>
              )}
              {returnOrder.rejectedAt && (
                <p className="mt-1 text-xs text-red-700">
                  {formatDateTime(returnOrder.rejectedAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Completed banner */}
      {(currentStatus === "COMPLETED" ||
        currentStatus === "PARTIALLY_ACCEPTED") && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
            <div className="text-sm text-emerald-900">
              <p className="font-semibold">
                {currentStatus === "PARTIALLY_ACCEPTED"
                  ? "تم قبول جزء من المرتجع"
                  : "تم إكمال المرتجع"}
              </p>
              {returnOrder.approvedRefundAmount !== null && (
                <p className="mt-1 text-emerald-800">
                  المبلغ المعتمد:{" "}
                  <strong>
                    {formatMoney(returnOrder.approvedRefundAmount)} د.م
                  </strong>
                </p>
              )}
              {returnOrder.completedAt && (
                <p className="mt-1 text-xs text-emerald-700">
                  {formatDateTime(returnOrder.completedAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Parties */}
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              الأطراف
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">المشتري (مُرسل المرتجع)</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {returnOrder.buyer.name}
                </p>
                <p className="text-xs text-gray-500">
                  {BU_TYPE_LABEL[returnOrder.buyer.type] ??
                    returnOrder.buyer.type}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">البائع (مستلم المرتجع)</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {returnOrder.seller.name}
                </p>
                <p className="text-xs text-gray-500">
                  {BU_TYPE_LABEL[returnOrder.seller.type] ??
                    returnOrder.seller.type}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
              طلب أصلي{" "}
              <Link
                href={`/wholesale/orders/${returnOrder.originalOrderId}`}
                className="font-medium underline"
              >
                {returnOrder.originalOrderNumber}
              </Link>{" "}
              · {formatMoney(returnOrder.originalOrder.total)} د.م
            </div>
          </Card>

          {/* Reason */}
          <Card>
            <h3 className="mb-2 text-sm font-bold text-gray-900">
              سبب الإرجاع
            </h3>
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {returnOrder.reason}
            </p>
          </Card>

          {/* Items */}
          <Card padding="none">
            <div className="border-b border-gray-100 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Package className="h-4 w-4 text-gray-400" />
                المنتجات ({returnOrder.items.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {returnOrder.items.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">
                        {item.productName}
                      </p>
                      {item.variantAttributes.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.variantAttributes.map((a, i) => (
                            <span
                              key={i}
                              className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                            >
                              {a.name}: <strong>{a.value}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {formatMoney(item.unitPrice)} د.م/قطعة
                      </p>
                    </div>
                  </div>

                  {/* Quantities grid */}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded bg-gray-50 p-2">
                      <p className="text-gray-500">مطلوب</p>
                      <p className="font-bold text-gray-900">
                        {item.quantityRequested}
                      </p>
                    </div>
                    <div className="rounded bg-blue-50 p-2">
                      <p className="text-blue-700">مُستلَم</p>
                      <p className="font-bold text-blue-900">
                        {item.quantityReceived}
                      </p>
                    </div>
                    <div className="rounded bg-emerald-50 p-2">
                      <p className="text-emerald-700">مقبول</p>
                      <p className="font-bold text-emerald-900">
                        {item.quantityAccepted}
                      </p>
                    </div>
                  </div>

                  {(item.quantityReceived > 0 ||
                    item.quantityAccepted > 0) && (
                    <div className="mt-2 flex justify-end">
                      <Badge
                        variant={
                          RETURN_ITEM_CONDITION_VARIANT[item.condition] ??
                          "gray"
                        }
                        size="sm"
                      >
                        {RETURN_ITEM_CONDITION_LABEL[item.condition] ??
                          item.condition}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Refund summary */}
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              المبالغ
            </h3>
            <dl className="space-y-2 text-sm">
              {returnOrder.expectedRefundAmount !== null && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">المتوقع</dt>
                  <dd className="font-medium text-gray-900">
                    {formatMoney(returnOrder.expectedRefundAmount)} د.م
                  </dd>
                </div>
              )}
              {returnOrder.approvedRefundAmount !== null && (
                <div className="flex justify-between border-t border-gray-100 pt-2">
                  <dt className="text-gray-600">المعتمد</dt>
                  <dd className="text-lg font-black text-emerald-700">
                    {formatMoney(returnOrder.approvedRefundAmount)} د.م
                  </dd>
                </div>
              )}
              {returnOrder.expectedRefundAmount === null &&
                returnOrder.approvedRefundAmount === null && (
                  <p className="text-xs text-gray-500">
                    لم يُحدد مبلغ بعد
                  </p>
                )}
            </dl>
          </Card>

          {/* Timeline info */}
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              التسلسل الزمني
            </h3>
            <dl className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <div>
                  <dt className="text-gray-500">تم الإنشاء</dt>
                  <dd className="text-gray-900">
                    {formatDateTime(returnOrder.createdAt)}
                  </dd>
                </div>
              </div>
              {returnOrder.approvedAt && (
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  <div>
                    <dt className="text-gray-500">تم الاعتماد</dt>
                    <dd className="text-gray-900">
                      {formatDateTime(returnOrder.approvedAt)}
                    </dd>
                  </div>
                </div>
              )}
              {returnOrder.completedAt && (
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                  <div>
                    <dt className="text-gray-500">تم الإكمال</dt>
                    <dd className="font-medium text-emerald-700">
                      {formatDateTime(returnOrder.completedAt)}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </Card>

          {/* Credit notes */}
          {returnOrder.creditNotes.length > 0 && (
            <Card>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                <FileText className="h-4 w-4 text-gray-400" />
                الإشعارات الدائنة
              </h3>
              <div className="space-y-2">
                {returnOrder.creditNotes.map((cn) => (
                  <div
                    key={cn.id}
                    className="rounded-lg bg-red-50 p-2 text-xs"
                  >
                    <p className="font-bold text-red-900">
                      {formatMoney(cn.amount)} د.م
                    </p>
                    <p className="text-red-700">{cn.reasonCode}</p>
                    <p className="text-gray-500">
                      {formatDateTime(cn.issuedAt)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Actions */}
          <ReturnActions
            returnId={returnOrder.id}
            currentStatus={currentStatus}
            isBuyer={isBuyer}
            isSeller={isSeller}
            isAdmin={isAdmin}
            items={returnOrder.items}
            onStatusChange={setCurrentStatus}
          />
        </div>
      </div>
    </div>
  );
}