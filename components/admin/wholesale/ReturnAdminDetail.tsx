"use client";

import Link from "next/link";
import {
  ArrowRight,
  RotateCcw,
  Building2,
  Calendar,
  Package,
  FileText,
  Receipt,
  Info,
  AlertCircle,
  XCircle,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  RETURN_STATUS_LABEL,
  RETURN_STATUS_VARIANT,
  RETURN_ITEM_CONDITION_LABEL,
  RETURN_ITEM_CONDITION_VARIANT,
  BU_TYPE_LABEL,
  formatDateTime,
  formatMoney,
} from "@/components/wholesale/returns/types";
import { ReturnStatusTimeline } from "@/components/wholesale/returns/ReturnStatusTimeline";

type ReturnAdminOrder = {
  id: number;
  returnNumber: string;
  originalOrderId: number;
  originalOrderNumber: string;
  buyerBusinessUnitId: number;
  sellerBusinessUnitId: number;
  status: string;
  reason: string;
  expectedRefundAmount: number | null;
  approvedRefundAmount: number | null;
  totalQtyRequested: number;
  totalQtyAccepted: number;
  itemsCount: number;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  completedAt: string | null;
  buyer: {
    id: number;
    name: string;
    slug: string;
    type: string;
    verificationStatus: string;
    ownerName: string;
    ownerEmail: string;
  };
  seller: {
    id: number;
    name: string;
    slug: string;
    type: string;
    verificationStatus: string;
    ownerName: string;
    ownerEmail: string;
  };
  originalOrder: {
    id: number;
    orderNumber: string;
    status: string;
    total: number;
    deliveredAt: string | null;
  };
  items: Array<{
    id: number;
    productName: string;
    variantAttributes: Array<{ name: string; value: string }>;
    unitPrice: number;
    quantityRequested: number;
    quantityReceived: number;
    quantityAccepted: number;
    condition: string;
    inventoryReturns: Array<{
      id: number;
      condition: string;
      quantity: number;
      sourceBatchId: number | null;
    }>;
  }>;
  creditNotes: Array<{
    id: number;
    amount: number;
    reasonCode: string;
    issuedAt: string;
  }>;
  invoices: Array<{
    id: number;
    invoiceNumber: string;
    invoiceType: string;
    total: number;
    paidAmount: number;
    status: string;
    businessUnitId: number;
  }>;
};

export interface ReturnAdminDetailProps {
  returnOrder: ReturnAdminOrder;
}

export function ReturnAdminDetail({ returnOrder }: ReturnAdminDetailProps) {
  const status = returnOrder.status;

  return (
    <div className="space-y-5">
      <Link
        href="/admin/wholesale/returns"
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
            <Badge variant={RETURN_STATUS_VARIANT[status] ?? "gray"} dot>
              {RETURN_STATUS_LABEL[status] ?? status}
            </Badge>
          </span>
        }
        description={`${formatDateTime(returnOrder.createdAt)} · طلب ${returnOrder.originalOrderNumber}`}
      />

      {/* Admin notice */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">أنت تشاهد كأدمن</p>
            <p className="text-xs text-blue-800">
              المرتجعات تُدار بين البائع والمشتري. هذه الصفحة للمراقبة والتدقيق
              فقط.
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <ReturnStatusTimeline status={status} />
      </Card>

      {/* Rejected banner */}
      {status === "REJECTED" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="text-sm text-red-900">
              <p className="font-semibold">تم رفض المرتجع</p>
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
      {(status === "COMPLETED" || status === "PARTIALLY_ACCEPTED") && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
            <div className="text-sm text-emerald-900">
              <p className="font-semibold">
                {status === "PARTIALLY_ACCEPTED"
                  ? "قُبل جزء من المرتجع"
                  : "تم إكمال المرتجع"}
              </p>
              {returnOrder.approvedRefundAmount !== null && (
                <p className="mt-1">
                  المبلغ المعتمد:{" "}
                  <strong>
                    {formatMoney(returnOrder.approvedRefundAmount)} د.م
                  </strong>
                </p>
              )}
              {returnOrder.completedAt && (
                <p className="mt-1 text-xs">
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
            <h3 className="mb-3 text-sm font-bold text-gray-900">الأطراف</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">المشتري (مُرسل المرتجع)</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {returnOrder.buyer.name}
                </p>
                <p className="text-xs text-gray-600">
                  {BU_TYPE_LABEL[returnOrder.buyer.type] ??
                    returnOrder.buyer.type}
                  {returnOrder.buyer.verificationStatus === "VERIFIED" && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-emerald-600">
                      <ShieldCheck className="h-3 w-3" />
                      موثق
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[11px] text-gray-500">
                  {returnOrder.buyer.ownerName}
                </p>
                <p className="text-[11px] text-gray-400">
                  {returnOrder.buyer.ownerEmail}
                </p>
                <Link
                  href={`/admin/wholesale/business-units`}
                  className="mt-1 inline-block text-[11px] text-[#ff5c00] hover:underline"
                >
                  عرض النشاط
                </Link>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">البائع (مستلم المرتجع)</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {returnOrder.seller.name}
                </p>
                <p className="text-xs text-gray-600">
                  {BU_TYPE_LABEL[returnOrder.seller.type] ??
                    returnOrder.seller.type}
                  {returnOrder.seller.verificationStatus === "VERIFIED" && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-emerald-600">
                      <ShieldCheck className="h-3 w-3" />
                      موثق
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[11px] text-gray-500">
                  {returnOrder.seller.ownerName}
                </p>
                <p className="text-[11px] text-gray-400">
                  {returnOrder.seller.ownerEmail}
                </p>
                <Link
                  href={`/admin/wholesale/business-units`}
                  className="mt-1 inline-block text-[11px] text-[#ff5c00] hover:underline"
                >
                  عرض النشاط
                </Link>
              </div>
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
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
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
                    <p className="text-xs text-gray-500">
                      {formatMoney(item.unitPrice)} د.م/قطعة
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
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
                    <div className="mt-2">
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
          {/* Summary */}
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">الملخص</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">إجمالي مطلوب</dt>
                <dd className="font-bold text-gray-900">
                  {returnOrder.totalQtyRequested} قطعة
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">إجمالي مقبول</dt>
                <dd className="font-bold text-emerald-700">
                  {returnOrder.totalQtyAccepted} قطعة
                </dd>
              </div>
              {returnOrder.expectedRefundAmount !== null && (
                <div className="flex justify-between border-t border-gray-100 pt-2">
                  <dt className="text-gray-600">المتوقع</dt>
                  <dd className="text-gray-900">
                    {formatMoney(returnOrder.expectedRefundAmount)} د.م
                  </dd>
                </div>
              )}
              {returnOrder.approvedRefundAmount !== null && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">المعتمد</dt>
                  <dd className="text-lg font-black text-emerald-700">
                    {formatMoney(returnOrder.approvedRefundAmount)} د.م
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Order link */}
          <Card>
            <h3 className="mb-2 text-sm font-bold text-gray-900">الطلب الأصلي</h3>
            <Link
              href={`/wholesale/orders/${returnOrder.originalOrder.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg bg-gray-50 p-2 text-xs hover:bg-gray-100"
            >
              <span className="font-mono font-medium text-gray-900">
                {returnOrder.originalOrder.orderNumber}
              </span>
              <span className="text-[#ff5c00]">فتح →</span>
            </Link>
            <p className="mt-1 text-[11px] text-gray-500">
              {formatMoney(returnOrder.originalOrder.total)} د.م ·{" "}
              {returnOrder.originalOrder.status}
            </p>
          </Card>

          {/* Invoices */}
          {returnOrder.invoices.length > 0 && (
            <Card>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
                <Receipt className="h-4 w-4 text-gray-400" />
                الفواتير ({returnOrder.invoices.length})
              </h3>
              <div className="space-y-1">
                {returnOrder.invoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/wholesale/invoices/${inv.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded bg-gray-50 p-2 text-xs hover:bg-gray-100"
                  >
                    <span className="font-mono text-gray-900">
                      {inv.invoiceNumber}
                    </span>
                    <span className="text-gray-600">
                      {formatMoney(inv.total)} د.م
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Credit notes */}
          {returnOrder.creditNotes.length > 0 && (
            <Card>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
                <FileText className="h-4 w-4 text-gray-400" />
                الإشعارات الدائنة
              </h3>
              <div className="space-y-1">
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

          {/* Timeline events */}
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">الأحداث</h3>
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
                  <Calendar className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                  <div>
                    <dt className="text-gray-500">تم الاعتماد</dt>
                    <dd className="text-gray-900">
                      {formatDateTime(returnOrder.approvedAt)}
                    </dd>
                  </div>
                </div>
              )}
              {returnOrder.rejectedAt && (
                <div className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />
                  <div>
                    <dt className="text-gray-500">تم الرفض</dt>
                    <dd className="text-gray-900">
                      {formatDateTime(returnOrder.rejectedAt)}
                    </dd>
                  </div>
                </div>
              )}
              {returnOrder.completedAt && (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
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

          {/* Audit note */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertCircle className="inline h-3.5 w-3.5" /> كل التغييرات مسجلة
            في سجل التدقيق (OperationAuditLog) للرجوع إليها عند النزاع.
          </div>
        </div>
      </div>
    </div>
  );
}